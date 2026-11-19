require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const mongoClient = new MongoClient(process.env.MONGODB_URI || "");
let db;
let requests;
let admins;

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin(origin, cb) { if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true); cb(new Error("Origen no permitido")); }, credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

async function initDb() {
  if (!process.env.MONGODB_URI) throw new Error("Falta configurar MONGODB_URI.");
  await mongoClient.connect();
  db = mongoClient.db(process.env.MONGODB_DB_NAME || "roma");
  await db.command({ ping: 1 });
  requests = db.collection("requests");
  admins = db.collection("admins");
  await requests.createIndex({ created_at: -1 });
  await requests.createIndex({ type: 1, status: 1 });
  await admins.createIndex({ email: 1 }, { unique: true });
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await admins.updateOne({ email }, { $setOnInsert: { email, password_hash: hash, created_at: new Date() } }, { upsert: true });
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies.roma_session;
    if (!token) return res.status(401).json({ error: "Iniciá sesión para continuar." });
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie("roma_session");
    return res.status(401).json({ error: "La sesión venció. Volvé a ingresar." });
  }
}
const clean = value => String(value || "").trim();

app.get("/api/health", async (req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ status: "ok", service: "ROMA API", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.post("/api/requests", async (req, res) => {
  const { type = "contacto", name, email, phone = "", city = "", subject = "", message } = req.body || {};
  if (!["contacto", "adopcion", "transitorio"].includes(type)) return res.status(400).json({ error: "Tipo de solicitud inválido." });
  if (!clean(name) || !/^\\S+@\\S+\\.\\S+$/.test(clean(email)) || !clean(message)) return res.status(400).json({ error: "Completá nombre, un correo válido y el mensaje." });
  if (clean(name).length > 120 || clean(email).length > 180 || clean(message).length > 4000) return res.status(400).json({ error: "Revisá la longitud de los campos." });
  try {
    const document = {
      type, name: clean(name), email: clean(email).toLowerCase(), phone: clean(phone),
      city: clean(city), subject: clean(subject), message: clean(message),
      status: "pendiente", created_at: new Date()
    };
    const result = await requests.insertOne(document);
    res.status(201).json({ message: "¡Gracias! Tu solicitud fue recibida por ROMA.", request: { id: result.insertedId.toString(), created_at: document.created_at } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No pudimos registrar tu solicitud. Intentá nuevamente." });
  }
});

app.post("/api/admin/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8 }), async (req, res) => {
  const email = clean(req.body?.email).toLowerCase(), password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Ingresá correo y contraseña." });
  try {
    const admin = await admins.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    const token = jwt.sign({ id: admin._id.toString(), email: admin.email }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.cookie("roma_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", maxAge: 8 * 60 * 60 * 1000 });
    res.json({ admin: { email: admin.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("roma_session", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax" });
  res.json({ message: "Sesión cerrada." });
});
app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ admin: req.admin }));

app.get("/api/admin/requests", requireAdmin, async (req, res) => {
  try {
    const rows = await requests.find({}, { projection: { type: 1, name: 1, email: 1, phone: 1, city: 1, subject: 1, message: 1, status: 1, created_at: 1 } }).sort({ created_at: -1 }).toArray();
    res.json({ requests: rows.map(row => ({ id: row._id.toString(), type: row.type, name: row.name, email: row.email, phone: row.phone, city: row.city, subject: row.subject, message: row.message, status: row.status, created_at: row.created_at })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron cargar las solicitudes." });
  }
});

app.patch("/api/admin/requests/:id", requireAdmin, async (req, res) => {
  const status = clean(req.body?.status);
  if (!["pendiente", "en_revision", "resuelta"].includes(status)) return res.status(400).json({ error: "Estado inválido." });
  if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ error: "Solicitud no encontrada." });
  try {
    const result = await requests.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status } });
    if (!result.matchedCount) return res.status(404).json({ error: "Solicitud no encontrada." });
    res.json({ request: { id: req.params.id, status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar." });
  }
});

app.post("/api/assistant", rateLimit({ windowMs: 60 * 1000, limit: 15 }), async (req, res) => {
  const question = clean(req.body?.question);
  if (!question || question.length > 1000) return res.status(400).json({ error: "Escribí una consulta de hasta 1000 caracteres." });
  if (!geminiApiKey) return res.status(503).json({ error: "El asistente IA aún no está configurado. El equipo puede activarlo agregando GEMINI_API_KEY al servidor." });
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Sos el asistente virtual de ROMA, un proyecto de rescate y adopción responsable de Paysandú, Uruguay. Respondé en español rioplatense, cálido, claro y breve. Orientá sobre adopción responsable, hogares transitorios y colaboración. No inventes disponibilidad, requisitos particulares ni datos de contacto no confirmados. Para iniciar una solicitud, indicá que completen el formulario del sitio. No des consejos veterinarios de urgencia; recomendá consultar un veterinario." }] },
        contents: [{ role: "user", parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 260, temperature: 0.5 }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API:", data);
      return res.status(502).json({ error: "El asistente no está disponible en este momento." });
    }
    const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    res.json({ answer: answer || "No pude preparar una respuesta. Probá nuevamente." });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "El asistente no está disponible en este momento." });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado." });
});

initDb()
  .then(() => app.listen(PORT, () => console.log("ROMA API conectada a MongoDB y escuchando en " + PORT)))
  .catch(err => {
    console.error("No se pudo inicializar MongoDB:", err);
    process.exit(1);
  });

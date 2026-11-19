require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const OpenAI = require("openai");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : undefined });
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "").split(",").map(x => x.trim()).filter(Boolean);
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin(origin, cb) { if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true); cb(new Error("Origen no permitido")); }, credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY, type VARCHAR(30) NOT NULL, name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL, phone VARCHAR(40), city VARCHAR(100),
    subject VARCHAR(100), message TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY, email VARCHAR(180) UNIQUE NOT NULL, password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await pool.query("INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING", [process.env.ADMIN_EMAIL.toLowerCase(), hash]);
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies.roma_session;
    if (!token) return res.status(401).json({ error: "Iniciá sesión para continuar." });
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.clearCookie("roma_session"); return res.status(401).json({ error: "La sesión venció. Volvé a ingresar." }); }
}
const clean = value => String(value || "").trim();
app.get("/api/health", async (req,res) => { try { await pool.query("SELECT 1"); res.json({ status:"ok", service:"ROMA API", database:"connected" }); } catch { res.status(503).json({ status:"error", database:"unavailable" }); } });

app.post("/api/requests", async (req,res) => {
  const { type="contacto", name, email, phone="", city="", subject="", message } = req.body || {};
  if (!["contacto","adopcion","transitorio"].includes(type)) return res.status(400).json({error:"Tipo de solicitud inválido."});
  if (!clean(name) || !/^\S+@\S+\.\S+$/.test(clean(email)) || !clean(message)) return res.status(400).json({error:"Completá nombre, un correo válido y el mensaje."});
  if (clean(name).length>120 || clean(email).length>180 || clean(message).length>4000) return res.status(400).json({error:"Revisá la longitud de los campos."});
  try {
    const q=await pool.query("INSERT INTO requests(type,name,email,phone,city,subject,message) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,created_at", [type,clean(name),clean(email).toLowerCase(),clean(phone),clean(city),clean(subject),clean(message)]);
    res.status(201).json({message:"¡Gracias! Tu solicitud fue recibida por ROMA.",request:q.rows[0]});
  } catch(err) { console.error(err); res.status(500).json({error:"No pudimos registrar tu solicitud. Intentá nuevamente."}); }
});

app.post("/api/admin/login", rateLimit({windowMs:15*60*1000,limit:8}), async (req,res) => {
  const email=clean(req.body?.email).toLowerCase(), password=String(req.body?.password||"");
  if(!email || !password) return res.status(400).json({error:"Ingresá correo y contraseña."});
  try {
    const q=await pool.query("SELECT id,email,password_hash FROM admins WHERE email=$1",[email]);
    const admin=q.rows[0];
    if(!admin || !(await bcrypt.compare(password,admin.password_hash))) return res.status(401).json({error:"Correo o contraseña incorrectos."});
    const token=jwt.sign({id:admin.id,email:admin.email},process.env.JWT_SECRET,{expiresIn:"8h"});
    res.cookie("roma_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:8*60*60*1000});
    res.json({admin:{email:admin.email}});
  } catch(err) { console.error(err); res.status(500).json({error:"No se pudo iniciar sesión."}); }
});
app.post("/api/admin/logout",(req,res)=>{res.clearCookie("roma_session",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax"});res.json({message:"Sesión cerrada."});});
app.get("/api/admin/me",requireAdmin,(req,res)=>res.json({admin:req.admin}));
app.get("/api/admin/requests",requireAdmin,async(req,res)=>{try{const q=await pool.query("SELECT id,type,name,email,phone,city,subject,message,status,created_at FROM requests ORDER BY created_at DESC");res.json({requests:q.rows});}catch(err){console.error(err);res.status(500).json({error:"No se pudieron cargar las solicitudes."});}});
app.patch("/api/admin/requests/:id",requireAdmin,async(req,res)=>{const status=clean(req.body?.status);if(!["pendiente","en_revision","resuelta"].includes(status))return res.status(400).json({error:"Estado inválido."});try{const q=await pool.query("UPDATE requests SET status=$1 WHERE id=$2 RETURNING id,status",[status,req.params.id]);if(!q.rowCount)return res.status(404).json({error:"Solicitud no encontrada."});res.json({request:q.rows[0]});}catch(err){console.error(err);res.status(500).json({error:"No se pudo actualizar."});}});
app.post("/api/assistant",rateLimit({windowMs:60*1000,limit:15}),async(req,res)=>{
  const question=clean(req.body?.question);
  if(!question || question.length>1000)return res.status(400).json({error:"Escribí una consulta de hasta 1000 caracteres."});
  if(!openai)return res.status(503).json({error:"El asistente IA aún no está configurado. El equipo puede activarlo agregando OPENAI_API_KEY al servidor."});
  try{const completion=await openai.chat.completions.create({model:process.env.OPENAI_MODEL||"gpt-4o-mini",messages:[
    {role:"system",content:"Sos el asistente virtual de ROMA, un proyecto de rescate y adopción responsable de Paysandú, Uruguay. Respondé en español rioplatense, cálido, claro y breve. Orientá sobre adopción responsable, hogares transitorios y colaboración. No inventes disponibilidad, requisitos particulares ni datos de contacto no confirmados. Para iniciar una solicitud, indicá que completen el formulario del sitio. No des consejos veterinarios de urgencia; recomendá consultar un veterinario."},
    {role:"user",content:question}],max_tokens:260,temperature:0.5});
    res.json({answer:completion.choices[0]?.message?.content||"No pude preparar una respuesta. Probá nuevamente."});
  }catch(err){console.error(err);res.status(502).json({error:"El asistente no está disponible en este momento."});}
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Ocurrió un error inesperado."});});
initDb().then(()=>app.listen(PORT,()=>console.log("ROMA API escuchando en "+PORT))).catch(err=>{console.error("No se pudo inicializar la base de datos",err);process.exit(1);});
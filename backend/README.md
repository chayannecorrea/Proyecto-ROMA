# ROMA API

API REST con Node.js, Express y MongoDB para registrar consultas, solicitudes de adopción y hogares transitorios; proteger el panel administrativo y ofrecer un asistente con IA mediante Google Gemini.

## Desarrollo local
1. Instalar Node.js 20 o superior.
2. Crear un cluster gratuito en MongoDB Atlas y un usuario de base de datos.
3. Copiar `.env.example` a `.env` y completar `MONGODB_URI`, `MONGODB_DB_NAME` y las demás variables.
4. Ejecutar `npm install` y `npm start`.
5. Comprobar `GET /api/health`.

## Endpoints
- `GET /api/health`: estado de API y conexión con MongoDB.
- `POST /api/requests`: registra contacto, adopción u hogar transitorio.
- `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`: sesión administrativa.
- `GET /api/admin/requests`: lista solicitudes (requiere sesión).
- `PATCH /api/admin/requests/:id`: cambia estado (requiere sesión).
- `POST /api/assistant`: responde consultas con Google Gemini mediante `GEMINI_API_KEY`.

## Despliegue
El archivo `render.yaml` en la raíz define el servicio web. La base se aloja en MongoDB Atlas. Configurar en Render `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `GEMINI_API_KEY` como variables de entorno secretas. Configurar `FRONTEND_ORIGIN` con el origen exacto de GitHub Pages. No subir secretos al repositorio.

Al iniciar, la API crea las colecciones e índices necesarios. La contraseña inicial se guarda como hash bcrypt. La cookie de sesión es HttpOnly y tiene una duración de ocho horas. El asistente utiliza el modelo indicado en `GEMINI_MODEL` (por defecto, `gemini-2.5-flash`).

## Colecciones
- `requests`: solicitudes de contacto, adopción y hogar transitorio, con estado y fecha.
- `admins`: usuarios administradores y hashes de contraseña.

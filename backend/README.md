# ROMA API

API REST con Node.js, Express y PostgreSQL para registrar consultas, solicitudes de adopción y hogares transitorios; proteger el panel administrativo y ofrecer un asistente con IA.

## Desarrollo local
1. Instalar Node.js 20 o superior y PostgreSQL.
2. Crear una base de datos llamada `roma`.
3. Copiar `.env.example` a `.env` y completar las variables.
4. Ejecutar `npm install` y `npm start`.
5. Comprobar `GET /api/health`.

## Endpoints
- `GET /api/health`: estado de API y base de datos.
- `POST /api/requests`: registra contacto, adopción u hogar transitorio.
- `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`: sesión administrativa.
- `GET /api/admin/requests`: lista solicitudes (requiere sesión).
- `PATCH /api/admin/requests/:id`: cambia estado (requiere sesión).
- `POST /api/assistant`: responde con OpenAI si se configura `OPENAI_API_KEY`.

## Despliegue
El archivo `render.yaml` en la raíz define el servicio web y PostgreSQL. En Render, crear un Blueprint desde el repositorio y completar `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `OPENAI_API_KEY` cuando el panel los solicite. Configurar `FRONTEND_ORIGIN` con el dominio exacto de GitHub Pages. No subir secretos al repositorio.

La contraseña inicial se crea desde variables de entorno y se guarda como hash bcrypt. La cookie de sesión es HttpOnly y tiene una duración de ocho horas.
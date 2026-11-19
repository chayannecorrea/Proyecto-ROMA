# ROMA — Rescate, Oportunidad, Amor

Plataforma digital de adopción responsable y hogares transitorios en Paysandú, Uruguay.

## Producto
- Sitio público responsive: inicio, catálogo de animales, historias, detalle y formularios.
- Formularios conectados a una API REST para registrar consultas, adopciones y hogares transitorios.
- Panel privado para administrar solicitudes y actualizar su estado.
- Asistente conversacional con IA.
- MongoDB para guardar solicitudes y administradores; sesiones administrativas protegidas mediante cookie HttpOnly.

## Estructura
- `index.html`, `adoptar.html`, `violeta.html`, `historias.html`, `hogartransitorio.html`, `contacto.html`: frontend estático.
- `assets/css` y `assets/js`: estilos y comportamiento del frontend.
- `admin/`: login y panel de gestión.
- `backend/`: API Express, conexión MongoDB y asistente Google Gemini.
- `render.yaml`: configuración del servicio backend en Render.
- `.github/workflows/deploy.yml`: publicación del frontend en GitHub Pages.

## Publicación
### Frontend
En GitHub: Settings → Pages → Build and deployment → Source: GitHub Actions. El workflow publica la rama `revision-profesional`.
URL: https://chayannecorrea.github.io/Proyecto-ROMA/

### Backend + MongoDB Atlas
1. Crear una cuenta gratuita en MongoDB Atlas y un cluster.
2. Crear un usuario de base de datos y permitir el acceso de red desde Render. Para una prueba inicial se puede habilitar `0.0.0.0/0`, usando siempre una contraseña fuerte.
3. Copiar el URI de conexión de Atlas y configurarlo como variable secreta `MONGODB_URI` en Render. No guardar el URI ni la contraseña en GitHub.
4. En Render, crear el servicio web desde este repositorio y usar `render.yaml`.
5. Completar `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `GEMINI_API_KEY` en las variables de entorno.
6. Mantener `MONGODB_DB_NAME=roma` y configurar `FRONTEND_ORIGIN` con el origen del sitio GitHub Pages.
7. Esperar el despliegue y comprobar `/api/health`. Si Render asigna otro dominio, reemplazar `https://roma-api.onrender.com` en `assets/js/main.js` y `assets/js/admin.js` por la URL real del servicio.

La API crea automáticamente las colecciones e índices necesarios al iniciar y crea el administrador inicial si las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD` están configuradas.

## Desarrollo local del backend
Requiere Node.js 20+ y una instancia de MongoDB. En `backend/`: copiar `.env.example` a `.env`, configurar `MONGODB_URI`, ejecutar `npm install` y `npm start`. Health check: `GET /api/health`.

## Seguridad
No guardar claves, contraseñas ni URI de conexión en el repositorio. Configurar una contraseña de administrador fuerte y un `JWT_SECRET` único. La IA requiere una clave válida de Google Gemini; sin ella el endpoint informa que está pendiente de configuración.

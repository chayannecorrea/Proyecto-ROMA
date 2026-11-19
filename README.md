# ROMA — Rescate, Oportunidad, Amor

Plataforma digital de adopción responsable y hogares transitorios en Paysandú, Uruguay.

## Producto
- Sitio público responsive: inicio, catálogo de animales, historias, detalle y formularios.
- Formularios conectados a una API REST para registrar consultas, adopciones y hogares transitorios.
- Panel privado para administrar solicitudes y actualizar su estado.
- Asistente conversacional con IA para orientar a visitantes.
- PostgreSQL para persistencia y sesiones administrativas protegidas mediante cookie HttpOnly.

## Estructura
- `index.html`, `adoptar.html`, `violeta.html`, `historias.html`, `hogartransitorio.html`, `contacto.html`: frontend estático.
- `assets/css` y `assets/js`: estilos y comportamiento del frontend.
- `admin/`: login y panel de gestión.
- `backend/`: API Express, conexión PostgreSQL y asistente Google Gemini.
- `render.yaml`: blueprint de despliegue del backend y base de datos.
- `.github/workflows/deploy.yml`: publicación del frontend en GitHub Pages.

## Publicación
### Frontend
En GitHub: Settings → Pages → Build and deployment → Source: GitHub Actions. El workflow publica la rama `revision-profesional`. URL prevista: https://chayannecorrea.github.io/Proyecto-ROMA/

### Backend + PostgreSQL
1. En Render, crear un Blueprint desde este repositorio y seleccionar `render.yaml`.
2. Completar `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `GEMINI_API_KEY` como secretos/variables de entorno.
3. Esperar que el servicio `roma-api` y la base `roma-db` queden disponibles.
4. Configurar `FRONTEND_ORIGIN` con el origen del sitio GitHub Pages.
5. Si Render asigna otro dominio, reemplazar `https://roma-api.onrender.com` en `assets/js/main.js` y `assets/js/admin.js` por la URL real del servicio.

## Desarrollo local del backend
Requiere Node.js 20+ y PostgreSQL. En `backend/`: copiar `.env.example` a `.env`, configurar variables, ejecutar `npm install` y `npm start`. Health check: `GET /api/health`.

## Seguridad
No guardar claves en el repositorio. Configurar una contraseña de administrador fuerte y un `JWT_SECRET` único. La IA requiere una clave válida de Google Gemini; sin ella el endpoint devuelve un mensaje de configuración pendiente. La publicación del frontend no sustituye el despliegue del backend.

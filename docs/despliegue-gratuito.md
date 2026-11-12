# BioAtlas en internet

La aplicación conserva su backend propio. Render ejecuta la API, Supabase aloja PostgreSQL/PostGIS y los archivos privados, y MongoDB Atlas guarda los metadatos multimedia. La versión Android instalable debe apuntar a la URL HTTPS pública de Render.

## Estado verificado: 12 de noviembre de 2026

El backend está publicado en https://bioatlas-api-1vcg.onrender.com con Render Free. Se comprobaron desde internet `/health`, `/map`, las 14 zonas, la búsqueda de avistamientos y el acceso a MongoDB desde la API. También se probó subir, descargar mediante enlace firmado y eliminar una imagen de prueba en el bucket privado de Supabase.

La restauración conservó 1 cuenta, 1 reporte, 1.138 avistamientos y 1.150 referencias de fotos. El respaldo completo del 11 de noviembre indicó 0 archivos multimedia en MongoDB local; no había videos o fotos subidos por usuarios que migrar. Los originales locales se conservaron. Las 22 pruebas automatizadas pasaron antes de publicar.

Pendiente: generar el APK con la cuenta Expo del propietario y probar inicio de sesión, envío de fotos/videos y moderación desde el teléfono con datos móviles. La publicación del backend no equivale a haber completado esa prueba final del teléfono.

## Configuración

1. Crear un proyecto Supabase en una organización Free, preferentemente en US East para mantener la API y las bases próximas. Habilitar PostGIS. Usar la conexión de PostgreSQL del pooler en modo sesión si la conexión directa IPv6 no está disponible. Verificar el certificado TLS; no desactivar su comprobación.
2. Crear el bucket **privado** `bioatlas-media`. Admitir solamente JPEG, PNG y MP4. El máximo actual de la aplicación es 10 MB para fotos y 50 MB para videos. Estos límites no significan almacenamiento ilimitado: el plan gratuito tiene cuotas compartidas.
3. Conservar las credenciales de servidor únicamente en Render. Nunca usar el prefijo `EXPO_PUBLIC_` para claves de Supabase, contraseñas de bases o claves de servicio.
4. Usar el clúster **Free** de MongoDB Atlas. El usuario de la API solo necesita `readWrite` sobre `bioatlas`. Autorizar las direcciones de salida de Render en Atlas; no abrir a todo internet por comodidad.
5. Conectar el repositorio privado a Render y seleccionar el servicio Docker de `render.yaml`, con plan Free. Completar las variables que figuran como `sync: false`. El proceso verifica la configuración, aplica las migraciones pendientes e inicia la API. No crear una base PostgreSQL gratuita de Render: es temporal.

Variables privadas del backend: `DATABASE_URL`, `MONGODB_URI`, `SUPABASE_SERVICE_ROLE_KEY`.
`SUPABASE_SERVICE_ROLE_KEY` admite la nueva Secret key (`sb_secret_...`); el nombre se conserva por compatibilidad. El Dockerfile carga el certificado público oficial `apps/api/certs/supabase-ca.crt` mediante `NODE_EXTRA_CA_CERTS`, manteniendo `sslmode=verify-full` en PostgreSQL.
Variables de configuración: `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET=bioatlas-media`, `MONGODB_DATABASE=bioatlas`, `MEDIA_STORAGE=supabase`.

Las migraciones habilitan RLS y retiran permisos de lectura directa de las tablas de la aplicación a los roles públicos de Supabase. Las cuentas y la moderación siguen pasando por nuestra API. El adaptador rechaza un bucket público, mantiene los archivos pendientes privados y devuelve enlaces firmados de dos minutos solo después de verificar permisos.

## Migración de datos

Con las dos bases locales encendidas, ejecutar desde `apps/api`:

```powershell
node --env-file=.env scripts/backup-cloud.ts
```

El respaldo queda en `apps/api/data/backups/FECHA/`, excluido de Git. `postgres.json` contiene la copia de PostgreSQL; `backup.json` y la carpeta `media` se completan cuando también responde MongoDB. Una copia solo de PostgreSQL no es un respaldo multimedia completo. No compartir estos archivos: contienen cuentas, hashes y datos de usuarios. Las sesiones no se migran; se debe iniciar sesión nuevamente.

Antes de cambiar la app, copiar los datos a las bases nuevas, conservar IDs y relaciones, cargar los archivos existentes al bucket privado y comprobar cantidades y permisos. Mantener el entorno local hasta verificar la copia. No publicar apuntando a una base vacía ni eliminar los originales.

## Android

Configurar `EXPO_PUBLIC_API_URL` con la URL HTTPS del backend en el entorno utilizado por EAS y generar el perfil `preview` de `apps/mobile/eas.json`. El perfil ya produce un APK instalable. La compilación rechaza una URL ausente o sin HTTPS. Las credenciales privadas del servidor no forman parte de este archivo.

## Comprobación final

- `/health`, mapa, zonas y búsqueda responden desde internet.
- La cuenta existente funciona y los datos migrados coinciden.
- Un usuario puede subir una foto y un video, ver sus pendientes y eliminarlos.
- Otro usuario no puede abrir contenido pendiente; tras la moderación puede ver el contenido publicado.
- Los archivos siguen disponibles después de reiniciar Render.
- El APK abre usando datos móviles y con el computador apagado.

Render Free puede tardar en despertar; Supabase puede pausar proyectos inactivos. El arranque móvil espera hasta 90 segundos y permite reintentar. Las cuotas gratuitas no son una garantía de disponibilidad continua ni de capacidad ilimitada.

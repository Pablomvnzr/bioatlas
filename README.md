# BioAtlas

Aplicación para conocer la biodiversidad de los humedales de Valdivia. Proyecto Cóndor, Grupo 1.
Product Owner: Carlos Valenzuela. Scrum Master: Pablo Muñoz.

## Stack y estructura

- **React Native + Expo + TypeScript**: una app móvil para Android e iOS.
- **Fastify + Node.js + TypeScript**: backend propio con consultas validadas y errores controlados.
- **PostgreSQL + PostGIS**: registros geográficos con índice espacial y consultas por zona.
- **Leaflet + OpenStreetMap en WebView**: mapa común para Android e iOS sin clave de Google Maps; Leaflet se sirve desde el backend propio.
- **Expo SecureStore**: sesión guardada en el almacenamiento seguro del teléfono.
- **TanStack Query**: carga, cancelación, caché y reintentos de las consultas.
- **Zod**: contrato de consulta y respuesta compartido entre la API y el móvil.
- **pnpm workspaces**: un repositorio, un lockfile y dependencias compartidas.

```text
apps/mobile/          Interfaz y acceso a la API
apps/api/src/         Servidor, rutas y consultas PostgreSQL
apps/api/db/          Migraciones SQL
apps/api/scripts/     Migración e importación administrativa de GBIF
apps/api/test/        Pruebas del contrato HTTP y consultas
packages/contracts/  Esquemas y tipos compartidos
compose.yaml         Base de datos para desarrollo
```

La consulta del catálogo es pública. Las cuentas permiten enviar avistamientos; solo un administrador puede revisarlos. La importación de GBIF se ejecuta en el servidor y no se expone por HTTP. No hay frontend separado por sistema operativo, backend de Supabase, ORM ni microservicios.

## Ejecutar localmente

Requisitos: Node.js 24, pnpm 11 y Docker Desktop con el motor Linux activo.

1. Ejecutar `pnpm install` en la raíz.
2. Copiar `apps/api/.env.example` a `apps/api/.env` y `apps/mobile/.env.example` a `apps/mobile/.env`.
3. Ejecutar `docker compose --profile media up -d` y esperar a que la base esté saludable.
4. Ejecutar `pnpm db:migrate`. Es repetible; registra las migraciones aplicadas.
5. Ejecutar `pnpm api` en una terminal.
6. En el `.env` móvil, reemplazar la IP de ejemplo por la IP local real del equipo que ejecuta la API. El teléfono y el equipo deben compartir red. Android Emulator utiliza normalmente `http://10.0.2.2:3000`.
7. Ejecutar `pnpm mobile` en otra terminal y abrir el proyecto con una versión compatible de Expo Go o un development build.

No hay datos ficticios precargados. Para cargar una muestra pública real de hasta 300 registros en el área inicial de Valdivia, ejecutar desde `apps/api`: `node --env-file=.env scripts/fetch-gbif.ts`. Conserva la consulta, fecha, registros y licencias en `data/gbif-sample.json` (fuera de Git). No equivale a una descarga científica de GBIF con DOI ni certifica que las especies sean nativas. Para un conjunto validado del proyecto, usar el importador TSV siguiente.

## Importar GBIF

Descargar registros de la zona acordada de Valdivia desde GBIF, conservar la referencia/DOI de la descarga y descomprimir su `occurrence.txt` tabulado fuera del repositorio. No se descargan datos automáticamente.

```sh
pnpm import:gbif /ruta/absoluta/occurrence.txt
```

Columnas mínimas: `gbifID`, `scientificName`, `decimalLatitude`, `decimalLongitude`. Opcionales: `vernacularName`, `license`, `eventDate`. Los campos de fecha se conservan como texto de origen porque Darwin Core admite distinta precisión. La importación informa aceptados/actualizados y rechazados. Es transaccional y usa la clave `(source, source_id)` para evitar duplicados al reimportar. Un error de estructura del archivo revierte toda la carga.

Seleccionar previamente el área y los datos aptos para difusión pública. La importación no clasifica especies como nativas ni generaliza coordenadas sensibles. La meta del SRS de 300 registros y 40 especies nativas requiere validación del conjunto real y una fuente para la condición de nativa. Hacer respaldo antes de reemplazar datos.

## API

`GET /health` comprueba que el proceso responde. El inicio del servidor comprueba conectividad con PostgreSQL; `/health` no es una prueba continua de base de datos. `/map` sirve el visor; `/map/leaflet.js` y `/map/leaflet.css` sirven sus dependencias locales.

```text
GET /v1/observations?west=-73.4&south=-40&east=-73&north=-39&q=cisne&limit=300&offset=0
```

Devuelve `{items, hasMore}`. Cada registro incluye identificador, nombre científico, nombre común opcional, latitud, longitud, fuente, enlace, licencia y fecha. Límites invertidos, faltantes, fuera de rango o más de 300 resultados por página: HTTP 400. Una zona sin registros devuelve HTTP 200 con una lista vacía. La app pide hasta 300 y avisa cuando hay más para que el usuario acerque el mapa o filtre.

Las consultas son parametrizadas. El servidor limita a 120 consultas por minuto por IP. No habilitar `trustProxy` sin configurar los proxies confiables. CORS no se habilita porque el cliente inicial es móvil nativo.

## Comprobaciones

```sh
pnpm typecheck
pnpm test
pnpm --filter @bioatlas/mobile exec expo install --check
pnpm --filter @bioatlas/mobile exec expo export --platform android --output-dir dist/android
pnpm --filter @bioatlas/mobile exec expo export --platform ios --output-dir dist/ios
```

Exportar JavaScript no equivale a compilar un APK/IPA ni a probar la aplicación en un dispositivo. Antes de entregar, verificar en Android e iPhone: carga inicial, paneo del mapa, búsqueda, selección, cierre del detalle, zona vacía, red caída y reintento. Probar PostGIS e importación con datos reales y medir rendimiento según el SRS.

## Builds y publicación

El mapa no necesita una clave de Google Maps. Usa teselas de OpenStreetMap, muestra su atribución, identifica la app como BioAtlas y respeta la caché del WebView. No descarga zonas para uso offline. El servicio comunitario no ofrece garantía de disponibilidad: antes de una distribución amplia, elegir un proveedor adecuado al tráfico. Los identificadores `cl.bioatlas.mobile` son iniciales y deben confirmarse antes de publicar.

EAS Build permite compilar en la nube desde Windows. El simulador iOS local requiere macOS/Xcode. Las builds iOS para dispositivos y la distribución requieren configurar las credenciales de Apple correspondientes; no se han creado cuentas, firmado binarios ni publicado en tiendas.

La configuración `apps/mobile/eas.json` incluye `preview` para APK Android y distribución interna iOS, `ios-simulator` para simulador de Mac y `production` para tiendas. Desde `apps/mobile`, iniciar sesión con `pnpm dlx eas-cli login`, vincular el proyecto con `pnpm dlx eas-cli init` y configurar `EXPO_PUBLIC_API_URL` con una API HTTPS accesible desde el dispositivo. Después, ejecutar `pnpm dlx eas-cli build --platform android --profile preview` o el equivalente con `--platform ios`. Revisar el plan de Expo antes de lanzar builds; no se han solicitado compilaciones de pago. El perfil iOS interno necesita credenciales y registro de dispositivos.

Para producción: desplegar la API detrás de HTTPS, usar credenciales de base de datos distintas de las de desarrollo y un usuario con permisos de consulta del catálogo y escritura de cuentas, sesiones, reportes y publicaciones aprobadas. Mantener la cuenta de migración/importación separada y restringir sus permisos. Las credenciales del compose son únicamente locales, con el puerto restringido a localhost. No enviar `DATABASE_URL` al cliente ni guardar `.env` en Git.

## Cuentas y avistamientos

En Comunidad se puede crear una cuenta, iniciar/cerrar sesión, enviar un avistamiento con especie, fecha, descripción y ubicación elegida en el mapa, y consultar sus estados. Las contraseñas usan scrypt con sal aleatoria; los tokens aleatorios se guardan como SHA-256 en el servidor, caducan a los siete días y se revocan al cerrar sesión. El teléfono usa SecureStore. Nunca se acepta el rol enviado por un usuario al registrarse.

Para habilitar un administrador, registrar primero su cuenta desde el teléfono y ejecutar localmente desde `apps/api`:

```sh
node --env-file=.env scripts/promote-admin.ts correo-del-administrador
```

Al volver a iniciar sesión aparece Revisar. El administrador debe escribir una nota y aceptar o rechazar. Solo los aceptados se publican en el catálogo, como `BioAtlas comunitario`, sin certificar origen nativo ni validación científica. Una transacción impide publicar dos veces el mismo reporte. Los correos y reportes pendientes no se exponen por la API pública. No se crean administradores ni contraseñas predeterminadas.

Rutas: `POST /v1/auth/register`, `POST /v1/auth/login`, `GET /v1/auth/me`, `POST /v1/auth/logout`, `POST /v1/reports`, `GET /v1/reports/mine`, `GET /v1/admin/reports` y `PATCH /v1/admin/reports/:id`. Las rutas privadas usan `Authorization: Bearer <token>`. Las listas de reportes entregan 50 por página con `offset` y `hasMore`. Registro/inicio de sesión y envío tienen límites propios de frecuencia.

## Alcance

Implementado: mapa, consulta por zona, búsqueda por nombre, detalle, estados de carga/error/vacío, contrato compartido, migraciones, importación GBIF, cuentas, avistamientos y revisión administrativa. Corresponde a RF-01 a RF-07 del SRS, con fotografía opcional aplazada y sujeto a verificación en dispositivos.

Fuera de esta versión: fotografía, recuperación de contraseña por correo, revisión científica especializada, detección de avistamientos similares, consulta offline y filtros especializados. No hay envío de correo, cobros ni publicación en tiendas. Antes de una distribución pública se requiere desplegar por HTTPS, definir recuperación/eliminación de cuentas y la política de privacidad, validar el conjunto de especies nativas y completar las pruebas en Android e iPhone.

## Referencias técnicas

- https://docs.expo.dev/versions/latest/sdk/webview/
- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://operations.osmfoundation.org/policies/tiles/
- https://docs.expo.dev/build/setup/
- https://fastify.dev/docs/latest/
- https://postgis.net/documentation/

## Zonas y archivos de usuarios

Se incluyen macrozonas de Valdivia con sus colores y exploración por polígono. Los usuarios adjuntan fotos y videos a sus avistamientos; después de su revisión se consultan desde el punto del mapa y la zona. MongoDB guarda los metadatos y el almacenamiento local o Google Cloud Storage conserva los archivos. Consultar [configuración y límites](docs/zonas-y-videos.md). Google Cloud y MongoDB Atlas requieren configuración posterior; las cuentas aún no están creadas.

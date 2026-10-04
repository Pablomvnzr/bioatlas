# BioAtlas

Aplicación para conocer la biodiversidad de los humedales de Valdivia. Proyecto Cóndor, Grupo 1.
Product Owner: Carlos Valenzuela. Scrum Master: Pablo Muñoz.

## Stack y estructura

- **React Native + Expo + TypeScript**: una app móvil para Android e iOS.
- **Fastify + Node.js + TypeScript**: backend propio con consultas validadas y errores controlados.
- **PostgreSQL + PostGIS**: registros geográficos con índice espacial y consultas por zona.
- **React Native Maps**: Google Maps en Android y Apple Maps en iOS.
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

La API es de solo lectura. La importación se ejecuta en el servidor con credenciales administrativas y no se expone por HTTP. No hay frontend separado por sistema operativo, backend de Supabase, ORM, microservicios ni capas vacías. Agregar un módulo cuando exista una necesidad real.

## Ejecutar localmente

Requisitos: Node.js 24, pnpm 11 y Docker Desktop con el motor Linux activo.

1. Ejecutar `pnpm install` en la raíz.
2. Copiar `apps/api/.env.example` a `apps/api/.env` y `apps/mobile/.env.example` a `apps/mobile/.env`.
3. Ejecutar `docker compose up -d` y esperar a que la base esté saludable.
4. Ejecutar `pnpm db:migrate`. Es repetible; registra las migraciones aplicadas.
5. Ejecutar `pnpm api` en una terminal.
6. En el `.env` móvil, reemplazar la IP de ejemplo por la IP local real del equipo que ejecuta la API. El teléfono y el equipo deben compartir red. Android Emulator utiliza normalmente `http://10.0.2.2:3000`.
7. Ejecutar `pnpm mobile` en otra terminal y abrir el proyecto con una versión compatible de Expo Go o un development build.

No hay datos ficticios cargados. La aplicación muestra ausencia de resultados hasta importar un conjunto real.

## Importar GBIF

Descargar registros de la zona acordada de Valdivia desde GBIF, conservar la referencia/DOI de la descarga y descomprimir su `occurrence.txt` tabulado fuera del repositorio. No se descargan datos automáticamente.

```sh
pnpm import:gbif /ruta/absoluta/occurrence.txt
```

Columnas mínimas: `gbifID`, `scientificName`, `decimalLatitude`, `decimalLongitude`. Opcionales: `vernacularName`, `license`, `eventDate`. Los campos de fecha se conservan como texto de origen porque Darwin Core admite distinta precisión. La importación informa aceptados/actualizados y rechazados. Es transaccional y usa la clave `(source, source_id)` para evitar duplicados al reimportar. Un error de estructura del archivo revierte toda la carga.

Seleccionar previamente el área y los datos aptos para difusión pública. La importación no clasifica especies como nativas ni generaliza coordenadas sensibles. La meta del SRS de 300 registros y 40 especies nativas requiere validación del conjunto real y una fuente para la condición de nativa. Hacer respaldo antes de reemplazar datos.

## API

`GET /health` comprueba que el proceso responde. El inicio del servidor comprueba conectividad con PostgreSQL; `/health` no es una prueba continua de base de datos.

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

Para builds Android propios se necesita una clave de Google Maps restringida por paquete y certificado, configurada mediante `GOOGLE_MAPS_API_KEY`. Expo Go permite comenzar las pruebas sin configurar esta clave propia. iOS usa Apple Maps por defecto. Los identificadores `cl.bioatlas.mobile` son iniciales y deben confirmarse antes de publicar.

EAS Build permite compilar en la nube desde Windows. El simulador iOS local requiere macOS/Xcode. Las builds iOS para dispositivos y la distribución requieren configurar las credenciales de Apple correspondientes; no se han creado cuentas, firmado binarios ni publicado en tiendas.

La configuración `apps/mobile/eas.json` incluye `preview` para APK Android y distribución interna iOS, `ios-simulator` para simulador de Mac y `production` para tiendas. Desde `apps/mobile`, iniciar sesión con `pnpm dlx eas-cli login`, vincular el proyecto con `pnpm dlx eas-cli init` y configurar `EXPO_PUBLIC_API_URL` con una API HTTPS accesible desde el dispositivo. Para Android, configurar además `GOOGLE_MAPS_API_KEY`. Después, ejecutar `pnpm dlx eas-cli build --platform android --profile preview` o el equivalente con `--platform ios`. Revisar el plan de Expo antes de lanzar builds; no se han solicitado compilaciones de pago. El perfil iOS interno necesita credenciales y registro de dispositivos.

Para producción: desplegar la API detrás de HTTPS, usar credenciales de base de datos distintas de las de desarrollo y un usuario de solo lectura para el servidor. Mantener la cuenta de migración/importación separada. Las credenciales del compose son únicamente locales, con el puerto restringido a localhost. No enviar `DATABASE_URL` al cliente ni guardar `.env` en Git.

## Alcance

Implementado inicialmente: mapa, consulta por zona, búsqueda por nombre, detalle, estados de carga/error/vacío, contrato compartido, migración e importación GBIF. Se corresponde con RF-01 a RF-05 del SRS, sujeto a verificación de integración y dispositivos.

Pendiente: autenticación, reportes, revisión científica, detección de duplicados de reportes, consulta offline, fotografías y filtros especializados acordados con Margarita. Se implementarán cuando se confirme su alcance, sin crear pantallas ficticias.

## Referencias técnicas

- https://docs.expo.dev/versions/latest/sdk/map-view/
- https://docs.expo.dev/build/setup/
- https://fastify.dev/docs/latest/
- https://postgis.net/documentation/

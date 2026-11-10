# Zonas y videos

## Datos y navegación

La carga inicial utiliza las **12 macrozonas** de `MACROZONAS COLORES.kmz`, entregado por el equipo. Se conservan los colores KML y la geometría completa. Los nombres se extraen del campo `MACROZONA` de las descripciones: el campo principal de los elementos KML contiene `14` (región), no sus nombres. El conversor añade la declaración XML `xsi` que falta en el export original; no modifica coordenadas.

Estas macrozonas sociales no equivalen a límites ecológicos de biotopos. Se añaden dos áreas de referencia de iNaturalist: [Angachilla](https://www.inaturalist.org/places/182731) y [Parque Urbano El Bosque](https://www.inaturalist.org/places/199913). Se identifican como áreas por validar, no como biotopos certificados. No se construyen límites a partir de puntos de avistamiento. La capa `biotope` queda disponible para incorporar delimitaciones validadas.

El botón **Explorar esta zona** centra el mapa y filtra por el polígono real en PostGIS. Los huecos y las zonas con varios polígonos se conservan. El mapa muestra una geometría ligeramente simplificada para dibujarla; las consultas usan la geometría original. La pestaña **Zonas** permite localizar cada área por nombre y color sin depender únicamente de distinguir colores. **Volver al mapa general** recupera la vista anterior.

Desde `apps/api`, después de aplicar migraciones:

```sh
node --env-file=.env scripts/import-zones.ts fixtures/valdivia-macrozones.geojson
node --env-file=.env scripts/import-inat-areas.ts 182731 199913
```

Las cargas actualizan por ID y son transaccionales. Una geometría inválida detiene la importación sin reemplazar las demás. Para convertir otro KMZ se necesita Python 3 y ejecutar `scripts/convert-kmz.py entrada.kmz salida.geojson --source-url URL`. Los GeoJSON adicionales deben seguir el contrato compartido y usar coordenadas WGS84. El catálogo no debe superar las 200 zonas de esta primera interfaz; la respuesta avisa si hay más.

## Fotos y videos de avistamientos

Cada usuario adjunta archivos a sus propios avistamientos desde **Comunidad → Mis avistamientos → Fotos y videos**. Primero crea el avistamiento y después selecciona el archivo de la galería, con título y descripción opcional. Se admiten JPG/PNG de hasta 10 MB y MP4 de hasta 50 MB, con un máximo de 20 archivos por avistamiento.

Los archivos nuevos quedan pendientes. Su autor y los administradores pueden verlos; el resto solo los ve cuando **el avistamiento y el archivo estén aprobados**. El administrador dispone de una cola de archivos pendientes, incluidos los añadidos después de aprobar el avistamiento. El autor o un administrador pueden eliminar un archivo. Solo se debe subir material propio o autorizado.

Al tocar un punto comunitario del mapa, su ficha muestra la galería. La vista de una zona reúne los archivos publicados de avistamientos dentro de su polígono (hasta 50). Los registros externos sin archivos adjuntos no reciben imágenes inventadas.

PostgreSQL conserva cuentas, avistamientos y límites. MongoDB guarda el autor, avistamiento, tipo, estado de revisión y referencia del archivo. Los archivos se guardan localmente en desarrollo y en Cloud Storage al configurar la nube.

1. En la raíz: `docker compose --profile media up -d`.
2. En `apps/api/.env`: `MONGODB_URI=mongodb://127.0.0.1:27017/bioatlas`, `MONGODB_DATABASE=bioatlas`, `MEDIA_STORAGE=local`, `MEDIA_LOCAL_DIR=data/videos`.
3. Aplicar migraciones e iniciar API y Expo como indica el README.
4. Crear un avistamiento, adjuntar una foto o video y revisar ambos con la cuenta administradora.
5. Abrir el punto del mapa con otra cuenta y comprobar la galería.

El servidor comprueba tamaño y cabecera, pero no transcodifica ni certifica el contenido. Probar la reproducción de MP4 con H.264/AAC en Android y iOS. La selección usa la galería, sin captura directa con cámara. Las pruebas automatizadas usan cabeceras sintéticas para comprobar transporte y permisos, no reproducción audiovisual.

Respaldar la carpeta local junto con MongoDB y PostgreSQL. Sus volúmenes conservan las bases al detener Docker. MongoDB sin autenticación, vinculado a 127.0.0.1, es solo para desarrollo.

## Configuración posterior en Google Cloud y MongoDB Atlas

La integración está preparada en código; no se crean proyectos, cuentas, buckets ni servicios de pago automáticamente.

1. Crear el proyecto de Google Cloud y revisar su facturación y presupuesto. Crear un bucket con acceso uniforme y prevención de acceso público. Usar una cuenta de servicio propia de BioAtlas, con permisos de objetos limitados a ese bucket.
2. Configurar credenciales predeterminadas de aplicación (ADC) en el servidor. Para firmar enlaces, la identidad debe poder firmar con una cuenta de servicio (`iam.serviceAccounts.signBlob`); un inicio de sesión de usuario por sí solo puede no bastar. En desarrollo se puede usar suplantación de una cuenta de servicio autorizada. No copiar credenciales a la app ni subir archivos de claves a Git.
3. Configurar `MEDIA_STORAGE=gcs`, `GOOGLE_CLOUD_PROJECT` y `GCS_BUCKET` en la API. La subida usa el SDK oficial con carga reanudable del servidor a Storage. La conexión del teléfono a la API aún debe reiniciarse si se interrumpe; no se promete reanudación completa desde el móvil.
4. Crear MongoDB Atlas, un usuario restringido a la base de BioAtlas y la lista de redes permitidas. Guardar su URI en `MONGODB_URI`, únicamente en el backend. No habilitar acceso abierto a todas las IP por comodidad.
5. Publicar la API por HTTPS y probar subida, reproducción, eliminación y acceso denegado con una cuenta normal. Storage entrega enlaces temporales de lectura; el bucket permanece privado. Solo los archivos y avistamientos aprobados son consultables públicamente desde la app.

Cambiar de proveedor no traslada los videos anteriores. Antes de migrar, copiar los archivos locales al bucket, verificar tamaño y contenido y actualizar sus metadatos de forma controlada. No borrar los originales hasta comprobar la copia. El nombre del bucket configurado debe corresponder al que contiene esos objetos.

## Verificación

Las pruebas incluyen filtrado dentro del polígono real, conservación de las 12 macrozonas, rechazo de formatos no admitidos, autorización del propietario y revisión antes de publicación, persistencia en MongoDB, reproducción por rangos y eliminación. Las pruebas de integración necesitan PostgreSQL y MongoDB activos. Las pruebas locales no certifican que IAM, facturación o el bucket de Google Cloud estén configurados; eso debe verificarse cuando existan las cuentas.

Referencias: [Leaflet GeoJSON](https://leafletjs.com/reference.html#geojson), [iNaturalist API](https://api.inaturalist.org/v1/docs/), [autenticación de Cloud Storage](https://docs.cloud.google.com/storage/docs/authentication), [enlaces firmados](https://docs.cloud.google.com/storage/docs/access-control/signed-urls).

### Mapa base por el backend

El móvil solicita las imágenes del mapa a `/map/tiles/{z}/{x}/{y}.png`. El backend las descarga de OpenStreetMap identificándose como BioAtlas y conserva una caché en `apps/api/data/map-cache`, respetando los tiempos de caché y validadores HTTP. Esto permite consultar el mapa por USB cuando el teléfono no puede resolver el dominio del proveedor. El PC necesita internet. No se descargan zonas por adelantado ni se ofrece un modo offline. La atribución de OpenStreetMap sigue visible.

## iNaturalist y fichas de zonas

Desde `apps/api`, ejecutar `node --env-file=.env scripts/import-inaturalist.ts 1000` para importar una muestra de hasta 1000 registros recientes. El limite permitido es 2000; para una carga masiva debe usarse una exportacion, segun las recomendaciones de iNaturalist. La consulta usa el rectangulo de las zonas y el servidor conserva solamente puntos dentro de sus poligonos reales.

Se admiten registros con grado de investigacion, coordenadas publicas no ocultas y licencia explicita CC0, CC BY o CC BY-NC. CC BY-NC exige respetar la restriccion no comercial. Cada registro conserva su observador, licencia, fecha, precision disponible y enlace original. No se copian fotografias con la licencia del registro: su licencia es independiente. El resultado de la consulta y la fecha quedan en `apps/api/data/inaturalist-sample.json`, fuera de Git. Repetir la carga actualiza el mismo ID de iNaturalist sin duplicarlo; no deduplica automaticamente eventos coincidentes de GBIF y otras fuentes.

Carga inicial del 4 de noviembre de 2026: 1000 registros consultados, 838 incorporados despues de los filtros; 13949 resultados disponibles en la consulta regional al ejecutarla. No es un inventario completo, ni una sincronizacion automatica o una certificacion de especies nativas.

Al tocar cualquier poligono o seleccionarlo en Zonas se abre una ficha con descripcion, clasificacion del limite, superficie calculada, cantidad de registros y nombres cientificos distintos, fechas, fuentes y ocho organismos con mas registros. La informacion se calcula a partir de los datos cargados y no representa abundancia real. La ficha permite volver a explorar el mapa y consultar multimedia de usuarios.

Referencia: https://www.inaturalist.org/pages/api+recommended+practices

## Menú cultural y natural de las zonas

La ficha incluye secciones desplegables de Historia y cultura, Árboles, Flora y hábitats, y Avistamientos y biodiversidad. Los textos editoriales se mantienen en `apps/api/src/zone-guide.ts`, con fecha de revisión, enlaces de fuente y alcance: sector o comuna.

Se incorporaron referencias específicas para TEJA, COLLICO, COSTA, GUACAMAYO y las áreas de referencia de Angachilla y Parque Urbano El Bosque. Las demás fichas incluyen contexto comunal identificado como tal. El inventario arbóreo por polígono no se considera completo: solamente El Bosque tiene en esta primera versión una descripción de árboles respaldada específicamente para el lugar. Los datos regionales no prueban presencia en cada zona.

Fuentes: Plan Municipal de Cultura 2023–2026; Municipalidad de Valdivia (flora y fauna, catastro y Parque Silo de Collico); Universidad Austral de Chile (Jardín Botánico); Consejo de Monumentos Nacionales (Casa Anwandter); Museo de Sitio Castillo de Niebla; Ministerio del Medio Ambiente (expediente Bosque–Miraflores–Las Mulatas–Guacamayo); administraciones del Parque Urbano El Bosque y del Santuario Humedales de Angachilla. Los enlaces exactos acompañan cada texto en la app. Las descripciones son resúmenes, sin copiar fotografías ni artículos completos.

## Fotografías de los registros y alcance del módulo

Actualización del 6 de noviembre de 2026: se reprocesó la muestra de iNaturalist obtenida el 4 de noviembre, sin descargar otro lote de observaciones. Se incorporaron 1150 referencias de fotos asociadas a los 838 registros importados. Las 14 zonas existentes tienen fotos de avistamientos dentro de sus límites. Una misma fotografía puede pertenecer a más de una zona cuando se superponen.

La galería se abre desde el botón dorado Fotos de la zona. Permite filtrar plantas, animales y hongos, paginar de 12 en 12, ampliar las fotos y consultar sus créditos y registro original. Son imágenes de organismos registrados en el área, no fotografías panorámicas ni evidencia de una delimitación ecológica validada. Los filtros usan el grupo taxonómico de iNaturalist; no clasifican automáticamente todas las plantas como árboles.

La licencia de cada fotografía se comprueba de forma independiente de la observación. Se admiten CC0, CC BY, CC BY-SA, CC BY-NC y CC BY-NC-SA; las restricciones no comerciales se muestran en pantalla. Se excluyen imágenes ocultas, señaladas o procedentes de otros dominios. Los archivos se descargan bajo demanda en tamaño medio a través del backend, con una caché local de un día, para que la conexión USB no dependa del DNS del teléfono. Las referencias y licencias corresponden a la fecha de la muestra; una nueva importación con la lista de fotos actualiza los metadatos. La app no incorpora imágenes generadas como evidencia del lugar.

Estado: navegación por polígonos, fichas, fuentes, botones por categoría, datos de iNaturalist y galería implementados. No se considera un catálogo científico completo. Falta validar los polígonos como biotopos, completar historias e inventarios arbóreos por sector donde solo hay contexto comunal, conseguir fotografías panorámicas con autorización y comprobar la nueva galería en el dispositivo. Las subidas de usuarios siguen vinculadas a avistamientos y requieren revisión antes de publicarse.

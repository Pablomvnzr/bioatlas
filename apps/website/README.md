# BioAtlas: Proyecto condor — sitio web

Sitio independiente, sin dependencias de frontend. `dist/` contiene el HTML, CSS, JavaScript y el emblema original.

Ejecutar `pnpm --filter @bioatlas/website dev` y abrir http://127.0.0.1:4173.

El servidor conecta la consulta pública con la API existente en http://127.0.0.1:3000. Configurar `BIOATLAS_API_URL` para otro servidor. La API y PostgreSQL deben estar activos para mostrar registros reales. No se incluyen datos simulados. El visor permite buscar especies, paginar y abrir sus coordenadas en OpenStreetMap sin iniciar sesión.

Los accesos iOS y Android están identificados como próximos hasta contar con URLs oficiales de las tiendas. Para publicar, desplegar server.mjs con Node 24 y configurar la API; un alojamiento estático necesita un proxy equivalente para /v1/observations.

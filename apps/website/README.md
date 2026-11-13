# BioAtlas: Proyecto condor — sitio web

Sitio independiente, sin dependencias de frontend. `dist/` contiene el HTML, CSS, JavaScript y el emblema original.

Ejecutar `pnpm --filter @bioatlas/website dev` y abrir http://127.0.0.1:4173.

El servidor conecta la consulta pública con la API existente en https://bioatlas-api-1vcg.onrender.com. Configurar `BIOATLAS_API_URL` para otro servidor. La API debe estar activa para mostrar registros reales. Los reportes enviados desde la app se publican cuando un administrador los aprueba. El catálogo muestra primero los nuevos registros y permite filtrar los aportes de la comunidad y actualizar la lista. La consulta usa el catálogo en vivo. Los errores de conexión muestran un botón para reintentar. El visor permite buscar especies, paginar y abrir sus coordenadas en OpenStreetMap sin iniciar sesión.

Los accesos iOS y Android están identificados como próximos hasta contar con URLs oficiales de las tiendas. Para publicar, desplegar server.mjs con Node 24 y configurar la API; un alojamiento estático necesita un proxy equivalente para /v1/observations.

En GitHub Pages, el navegador consulta directamente la misma API pública. Desplegar también los cambios de la API de este repositorio para habilitar CORS, el orden de más recientes y el filtro comunitario. Con el servidor Node, las consultas pasan por el proxy del sitio.

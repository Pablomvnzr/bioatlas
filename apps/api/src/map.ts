import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { FastifyInstance } from 'fastify';
const require = createRequire(import.meta.url);

export function registerMap(app: FastifyInstance) {
  for (const [file, type] of [
    ['leaflet.js', 'application/javascript'],
    ['leaflet.css', 'text/css'],
  ]) {
    app.get('/map/' + file, async (_, reply) =>
      reply
        .type(type)
        .header('Cache-Control', 'public, max-age=86400')
        .send(await readFile(require.resolve('leaflet/dist/' + file), 'utf8')),
    );
  }
  app.get('/map', async (_, reply) =>
    reply
      .type('text/html')
      .header(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src https://tile.openstreetmap.org data:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      ).send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="/map/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#e3ebdd} .leaflet-control-attribution{font-size:10px}</style></head>
<body><div id="map" aria-label="Mapa de biodiversidad"></div><script src="/map/leaflet.js"></script><script>
const send=(data)=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(data));
const map=L.map('map').setView([-39.8142,-73.2459],12);
const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',keepBuffer:1}).addTo(map);
const markers=L.layerGroup().addTo(map); let picked=null;
window.setRecords=(items)=>{markers.clearLayers();items.forEach(item=>{
 const label=document.createElement('span');label.textContent=item.commonName||item.scientificName;
 L.circleMarker([item.latitude,item.longitude],{radius:7,color:'#fff',weight:2,fillColor:'#245c50',fillOpacity:.9}).bindTooltip(label).on('click',()=>send({type:'select',id:item.id})).addTo(markers);
});};
window.setZone=(b)=>map.fitBounds([[b.south,b.west],[b.north,b.east]],{animate:false});
window.setPick=(p)=>{if(picked)map.removeLayer(picked);picked=L.circleMarker([p.latitude,p.longitude],{radius:9,color:'#9e4c20',fillOpacity:.8}).addTo(map);};
map.on('moveend',()=>{const b=map.getBounds();send({type:'bounds',bounds:{west:Math.max(-180,b.getWest()),east:Math.min(180,b.getEast()),south:Math.max(-90,b.getSouth()),north:Math.min(90,b.getNorth())}});});
map.on('click',e=>send({type:'pick',latitude:e.latlng.lat,longitude:e.latlng.lng}));
layer.on('tileerror',()=>send({type:'error'}));layer.on('tileload',()=>send({type:'loaded'}));
send({type:'ready'});
</script></body></html>`),
  );
}

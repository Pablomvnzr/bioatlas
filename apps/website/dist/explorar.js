const map = L.map('map').setView([-39.8142, -73.2459], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);
const markers = L.layerGroup().addTo(map);

const status = document.querySelector('#status');
const records = document.querySelector('#records');
const more = document.querySelector('#more');
const retry = document.querySelector('#retry');
let offset = 0, controller;
async function load(reset = true) {
  controller?.abort(); controller = new AbortController();
  if (reset) { offset = 0; records.replaceChildren(); markers.clearLayers(); }
  more.hidden = true; retry.hidden = true; status.textContent = 'Buscando avistamientos…';
  const params = new URLSearchParams({west:'-73.4',south:'-40',east:'-73',north:'-39',q:document.querySelector('#query').value.trim(),limit:'30',offset:String(offset)});
  try {
    const response = await fetch('/v1/observations?' + params, {signal:controller.signal});
    if (!response.ok) throw new Error();
    const data = await response.json();
    for (const item of data.items) {
      const article = document.createElement('article'); article.className = 'record';
      const title = document.createElement('h3'); title.textContent = item.commonName || item.scientificName;
      const label = document.createElement('span');
      label.textContent = title.textContent;
      L.circleMarker([item.latitude, item.longitude], {radius: 6, color: '#245c50', fillOpacity: 0.8})
        .bindPopup(label).addTo(markers);
      const detail = document.createElement('p'); detail.textContent = `${item.scientificName} · ${item.source}${item.eventDate ? ' · ' + item.eventDate : ''}`;
      const link = document.createElement('a'); link.textContent = 'Ver ubicación ↗'; link.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(item.latitude)}&mlon=${encodeURIComponent(item.longitude)}#map=15/${encodeURIComponent(item.latitude)}/${encodeURIComponent(item.longitude)}`; link.target='_blank'; link.rel='noopener';
      article.append(title,detail,link); records.append(article);
    }
    offset += data.items.length; more.hidden = !data.hasMore;
    status.textContent = offset ? `${offset} avistamientos${data.hasMore ? ' · Hay más registros disponibles.' : ''}` : 'No encontramos avistamientos con esta búsqueda.';
  } catch(error) { if(error.name === 'AbortError') return; status.textContent = 'No pudimos conectar con el catálogo de avistamientos. Inténtalo nuevamente en unos momentos.'; retry.hidden=false; }
}
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();load();});
more.addEventListener('click',()=>load(false));retry.addEventListener('click',()=>load());load();

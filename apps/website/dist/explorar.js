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
  const useGbif = location.hostname.endsWith('.github.io');
  const params = new URLSearchParams({west:'-73.4',south:'-40',east:'-73',north:'-39',q:document.querySelector('#query').value.trim(),limit:'30',offset:String(offset)});
  try {
    const options = {signal: controller.signal};
    let payload;
    let sample = useGbif;
    if (!sample) {
      try {
        const response = await fetch('/v1/observations?' + params, options);
        if (!response.ok) throw new Error();
        payload = await response.json();
        sample = !Array.isArray(payload.items) || (reset && !params.get('q') && !payload.items.length);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        sample = true;
      }
    }
    if (sample) {
      const response = await fetch('assets/valdivia.json', options);
      if (!response.ok) throw new Error();
      const query = params.get('q').toLocaleLowerCase('es');
      const observations = await response.json();
      payload = {results: observations.filter(record =>
        [record.scientificName, record.vernacularName].some(name =>
          name?.toLocaleLowerCase('es').includes(query))), endOfRecords: true};
    }
    const data = sample ? {
      items: payload.results.map(record => ({
        scientificName: record.scientificName,
        commonName: record.vernacularName,
        latitude: record.decimalLatitude,
        longitude: record.decimalLongitude,
        source: [record.rightsHolder || record.recordedBy, 'GBIF', record.license].filter(Boolean).join(' · '),
        eventDate: record.eventDate,
        gbifKey: record.key,
      })),
      hasMore: !payload.endOfRecords,
    } : payload;
    for (const item of data.items) {
      const article = document.createElement('article'); article.className = 'record';
      const title = document.createElement('h3'); title.textContent = item.commonName || item.scientificName;
      const label = document.createElement('span');
      label.textContent = title.textContent;
      L.circleMarker([item.latitude, item.longitude], {radius: 6, color: '#245c50', fillOpacity: 0.8})
        .bindPopup(label).addTo(markers);
      const detail = document.createElement('p'); detail.textContent = `${item.scientificName} · ${item.source}${item.eventDate ? ' · ' + item.eventDate : ''}`;
      const link = document.createElement('a'); link.textContent = 'Ver ubicación ↗'; link.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(item.latitude)}&mlon=${encodeURIComponent(item.longitude)}#map=15/${encodeURIComponent(item.latitude)}/${encodeURIComponent(item.longitude)}`; link.target='_blank'; link.rel='noopener';
      article.append(title,detail,link); if (item.gbifKey) {
        const source = document.createElement('a');
        source.href = 'https://www.gbif.org/occurrence/' + item.gbifKey;
        source.textContent = 'Ficha en GBIF ↗';
        article.append(document.createTextNode(' · '), source);
      }
      records.append(article);
    }
    if (reset && data.items.length) {
      map.fitBounds(data.items.map(item => [item.latitude, item.longitude]), {padding: [18, 18], maxZoom: 15});
    }
    offset += data.items.length; more.hidden = !data.hasMore;
    status.textContent = offset ? `${offset} avistamientos${sample ? ' · Muestra de GBIF' : ''}${data.hasMore ? ' · Hay más registros disponibles.' : ''}` : 'No encontramos avistamientos con esta búsqueda.';
  } catch(error) { if(error.name === 'AbortError') return; status.textContent = 'No pudimos conectar con el catálogo de avistamientos. Inténtalo nuevamente en unos momentos.'; retry.hidden=false; }
}
document.querySelector('#search').addEventListener('submit',e=>{e.preventDefault();load();});
more.addEventListener('click',()=>load(false));retry.addEventListener('click',()=>load());load();

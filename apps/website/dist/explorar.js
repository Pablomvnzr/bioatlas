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
const community = document.querySelector('#community');
const apiBase = location.hostname.endsWith('.github.io')
  ? 'https://bioatlas-api-1vcg.onrender.com'
  : location.origin;
let offset = 0;
let controller;
let hasMore = false;
let retryReset = true;
let filters = { query: '', community: false };

function renderRecord(item) {
  const article = document.createElement('article');
  article.className = 'record';
  const title = document.createElement('h3');
  title.textContent = item.commonName || item.scientificName;
  const label = document.createElement('span');
  label.textContent = title.textContent;
  L.circleMarker([item.latitude, item.longitude], {
    radius: item.reportId ? 8 : 6,
    color: '#245c50',
    fillOpacity: 0.8,
  }).bindPopup(label).addTo(markers);
  if (item.reportId || item.source === 'BioAtlas comunitario') {
    const origin = document.createElement('p');
    origin.className = 'origin';
    origin.textContent = 'Avistamiento de la comunidad';
    article.append(origin);
  }
  const detail = document.createElement('p');
  detail.textContent = `${item.scientificName} · ${item.source}${item.eventDate ? ' · ' + item.eventDate.slice(0, 10) : ''}`;
  const link = document.createElement('a');
  link.textContent = 'Ver ubicación ↗';
  link.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(item.latitude)}&mlon=${encodeURIComponent(item.longitude)}#map=15/${encodeURIComponent(item.latitude)}/${encodeURIComponent(item.longitude)}`;
  link.target = '_blank';
  link.rel = 'noopener';
  article.append(title, detail, link);
  if (item.sourceUrl?.startsWith('https://')) {
    const source = document.createElement('a');
    source.href = item.sourceUrl;
    source.textContent = 'Consultar fuente ↗';
    source.target = '_blank';
    source.rel = 'noopener';
    article.append(document.createTextNode(' · '), source);
  }
  records.append(article);
}

async function load(reset = true) {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  if (reset) {
    filters = {
      query: document.querySelector('#query').value.trim(),
      community: community.checked,
    };
  }
  const params = new URLSearchParams({
    west: '-73.4', south: '-40', east: '-73', north: '-39',
    q: filters.query, limit: '30', offset: String(reset ? 0 : offset), sort: 'newest',
  });
  if (filters.community) params.set('source', 'community');
  more.hidden = true;
  retry.hidden = true;
  status.textContent = 'Buscando avistamientos…';
  records.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(new URL('/v1/observations?' + params, apiBase), {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Catálogo no disponible');
    const data = await response.json();
    if (!Array.isArray(data.items) || typeof data.hasMore !== 'boolean') {
      throw new Error('Respuesta inválida');
    }
    if (controller !== request) return;
    if (reset) {
      offset = 0;
      records.replaceChildren();
      markers.clearLayers();
    }
    data.items.forEach(renderRecord);
    if (reset && data.items.length) {
      map.fitBounds(data.items.map(item => [item.latitude, item.longitude]), {
        padding: [18, 18], maxZoom: 15,
      });
    }
    offset += data.items.length;
    hasMore = data.hasMore;
    more.hidden = !hasMore;
    status.textContent = offset
      ? `${offset} avistamientos · Más recientes primero${hasMore ? ' · Hay más registros disponibles.' : ''}`
      : 'No encontramos avistamientos con estos filtros.';
  } catch (error) {
    if (controller !== request || error.name === 'AbortError') return;
    retryReset = reset;
    status.textContent = 'No pudimos actualizar el catálogo. Vuelve a intentarlo para ver los registros más recientes.';
    retry.hidden = false;
    more.hidden = reset || !hasMore;
  } finally {
    if (controller === request) records.setAttribute('aria-busy', 'false');
  }
}
document.querySelector('#search').addEventListener('submit', event => {
  event.preventDefault();
  void load();
});
community.addEventListener('change', () => void load());
document.querySelector('#refresh').addEventListener('click', () => void load());
more.addEventListener('click', () => void load(false));
retry.addEventListener('click', () => void load(retryReset));
void load();

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/style.css': 'style.css',
  '/explorar.html': 'explorar.html',
  '/explorar.js': 'explorar.js',
  '/assets/bioatlas-owl.png': 'assets/bioatlas-owl.png',
};
for (const name of ['leaflet.js', 'leaflet.css']) {
  files['/leaflet/' + name] = 'leaflet/' + name;
}
files['/assets/valdivia.json'] = 'assets/valdivia.json';
const types = {
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  css: 'text/css',
  js: 'text/javascript',
  png: 'image/png',
};
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/v1/observations') {
    try {
      const upstream = await fetch(
        new URL(
          url.pathname + url.search,
          process.env.BIOATLAS_API_URL || 'https://bioatlas-api-1vcg.onrender.com',
        ),
        { signal: AbortSignal.timeout(60000) },
      );
      res.writeHead(upstream.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(await upstream.text());
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ message: 'Catálogo no disponible' }));
    }
    return;
  }
  const file = files[url.pathname];
  if (!file) {
    res.writeHead(404);
    res.end('Página no encontrada');
    return;
  }
  try {
    const body = await readFile(new URL('dist/' + file, import.meta.url));
    res.writeHead(200, { 'Content-Type': types[file.split('.').pop()] });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('No se pudo cargar la página');
  }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log('BioAtlas: http://127.0.0.1:4173'),
);

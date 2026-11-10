import pg from 'pg';
import { importZones } from '../src/zones.ts';
const ids = process.argv.slice(2);
if (!ids.length || ids.length > 10 || ids.some((id) => !/^\d+$/.test(id)))
  throw Error('Indica de 1 a 10 IDs de lugares de iNaturalist.');
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL requerido');
const features = [];
for (const id of ids) {
  const response = await fetch(`https://api.inaturalist.org/v1/places/${id}`, {
    headers: { 'User-Agent': 'BioAtlas/0.2' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`iNaturalist respondió ${response.status}`);
  const place = (await response.json()).results?.[0];
  if (!place?.geometry_geojson)
    throw Error(`Lugar ${id} sin límites; no se sustituye por un rectángulo.`);
  const geometry =
    place.geometry_geojson.type === 'Polygon'
      ? { type: 'MultiPolygon', coordinates: [place.geometry_geojson.coordinates] }
      : place.geometry_geojson;
  features.push({
    type: 'Feature',
    geometry,
    properties: {
      id: `inat-${id}`,
      name: place.name,
      description:
        'Área de referencia publicada en iNaturalist. Su clasificación y delimitación como biotopo están pendientes de validación con el equipo.',
      color: '#236E68',
      kind: 'reference_area',
      parentId: null,
      source: 'iNaturalist Places',
      sourceUrl: `https://www.inaturalist.org/places/${id}`,
    },
  });
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  console.log(await importZones({ type: 'FeatureCollection', features }, db));
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

import pg from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { importInaturalist } from '../src/import-inaturalist.ts';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL requerido');
const limit = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(limit) || limit < 1 || limit > 2000)
  throw Error(
    'Indica un limite entre 1 y 2000 registros. Para cargas masivas utiliza exportaciones de iNaturalist.',
  );
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const b = (
    await db.query(
      'SELECT ST_XMin(ST_Extent(boundary)) west,ST_YMin(ST_Extent(boundary)) south,ST_XMax(ST_Extent(boundary)) east,ST_YMax(ST_Extent(boundary)) north FROM zones',
    )
  ).rows[0];
  if (b.west === null) throw Error('Importa primero los limites de las zonas.');
  const records: unknown[] = [],
    queries: string[] = [];
  let total = 0;
  for (let page = 1; records.length < limit; page++) {
    if (page > 1) await wait(1100);
    const url = new URL('https://api.inaturalist.org/v1/observations');
    url.search = new URLSearchParams({
      swlat: String(b.south),
      swlng: String(b.west),
      nelat: String(b.north),
      nelng: String(b.east),
      quality_grade: 'research',
      license: 'cc0,cc-by,cc-by-nc',
      geo: 'true',
      locale: 'es',
      order_by: 'id',
      order: 'desc',
      per_page: '200',
      page: String(page),
    }).toString();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BioAtlas/0.1 (+https://github.com/Thecharles445/bioatlas)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Error(`iNaturalist respondio ${response.status}; no se modifico la base.`);
    const data = (await response.json()) as { results: unknown[]; total_results: number };
    if (!Array.isArray(data.results)) throw Error('Respuesta de iNaturalist invalida.');
    total = data.total_results;
    queries.push(url.href);
    records.push(...data.results.slice(0, limit - records.length));
    if (data.results.length < 200) break;
  }
  await mkdir('data', { recursive: true });
  await writeFile(
    'data/inaturalist-sample.json',
    JSON.stringify(
      { retrievedAt: new Date().toISOString(), totalAvailable: total, queries, records },
      null,
      2,
    ),
  );
  await db.query('BEGIN');
  try {
    const result = await importInaturalist(records, db);
    await db.query('COMMIT');
    console.log(
      JSON.stringify({
        ...result,
        fetched: records.length,
        totalAvailable: total,
        note: 'Muestra inicial, filtrada por limites reales. No es el catalogo completo.',
      }),
    );
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
} finally {
  await db.end();
}

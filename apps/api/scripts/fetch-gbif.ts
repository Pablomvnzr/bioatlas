import { mkdir, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import pg from 'pg';
import { importGbif } from '../src/import-gbif.ts';

// Small public sample for the initial Valdivia viewport. Not a scientific GBIF download/DOI.
const url = new URL('https://api.gbif.org/v1/occurrence/search');
Object.entries({
  decimalLatitude: '-39.8742,-39.7542',
  decimalLongitude: '-73.3159,-73.1759',
  hasCoordinate: 'true',
  hasGeospatialIssue: 'false',
  occurrenceStatus: 'PRESENT',
  limit: '300',
}).forEach(([k, v]) => url.searchParams.set(k, v));
const response = await fetch(url, {
  headers: { 'User-Agent': 'BioAtlas/0.1 (educational biodiversity catalogue)' },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw Error(`GBIF respondió ${response.status}`);
const payload = (await response.json()) as {
  results: Array<{
    key: number;
    scientificName: string;
    decimalLatitude: number;
    decimalLongitude: number;
    license?: string;
    eventDate?: string;
    species?: string;
  }>;
};
if (!Array.isArray(payload.results) || !payload.results.length)
  throw Error('GBIF no entregó registros. No se modificó la base.');
const records = payload.results.filter(
  (r) =>
    r.license?.includes('creativecommons.org') &&
    r.scientificName &&
    Number.isFinite(r.decimalLatitude) &&
    Number.isFinite(r.decimalLongitude),
);
if (!records.length)
  throw Error('No hay registros con licencia explícita aptos para esta muestra.');
const clean = (value: unknown) => String(value ?? '').replace(/[\t\r\n"]/g, ' ');
const tsv =
  'gbifID\tscientificName\tdecimalLatitude\tdecimalLongitude\tlicense\teventDate\n' +
  records
    .map((r) =>
      [r.key, r.scientificName, r.decimalLatitude, r.decimalLongitude, r.license, r.eventDate]
        .map(clean)
        .join('\t'),
    )
    .join('\n');
await mkdir(new URL('../../../data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../../../data/gbif-sample.json', import.meta.url),
  JSON.stringify({ retrievedAt: new Date().toISOString(), query: url.href, records }, null, 2),
);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL requerido');
await db.connect();
try {
  await db.query('BEGIN');
  const summary = await importGbif(Readable.from([tsv]), db);
  await db.query('COMMIT');
  console.log(
    JSON.stringify({
      ...summary,
      species: new Set(records.map((r) => r.species ?? r.scientificName)).size,
      query: url.href,
    }),
  );
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

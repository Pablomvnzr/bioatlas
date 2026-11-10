import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { importZones } from '../src/zones.ts';
const path = process.argv[2];
if (!path || !process.env.DATABASE_URL)
  throw Error('Uso: node --env-file=.env scripts/import-zones.ts archivo.geojson');
const data = JSON.parse(await readFile(path, 'utf8'));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  console.log(await importZones(data, db));
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

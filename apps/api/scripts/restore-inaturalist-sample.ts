import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { importInaturalist } from '../src/import-inaturalist.ts';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL requerido');
const sample = JSON.parse(await readFile('data/inaturalist-sample.json', 'utf8'));
if (!Array.isArray(sample.records)) throw Error('Muestra inválida');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  const result = await importInaturalist(sample.records, db);
  await db.query('COMMIT');
  console.log(result);
  console.log((await db.query('SELECT count(*)::int AS photos FROM observation_photos')).rows[0]);
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

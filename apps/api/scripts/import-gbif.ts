import { createReadStream } from 'node:fs';
import { importGbif } from '../src/import-gbif.ts';
import pg from 'pg';
const file = process.argv[2];
if (!file || !process.env.DATABASE_URL)
  throw Error('Uso: import:gbif ruta-absoluta-a-occurrence.txt; configurar DATABASE_URL');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const summary = await importGbif(createReadStream(file), client);
  await client.query('COMMIT');
  console.log(JSON.stringify(summary));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}

import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
if (!process.env.DATABASE_URL) throw Error('DATABASE_URL requerido');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(42001)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of (await readdir(new URL('../db/', import.meta.url)))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    const version = file.replace(/\.sql$/, '');
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version=$1', [
      version,
    ]);
    if (!applied.rowCount) {
      await client.query(await readFile(new URL('../db/' + file, import.meta.url), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
    }
  }
  await client.query('COMMIT');
  console.log('Migraciones al día.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}

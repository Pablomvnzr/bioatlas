import pg from 'pg';
import { readFile } from 'node:fs/promises';

// Run only after migrations against an empty destination. Never overwrites data.
const path = process.argv[2];
if (!path || !process.env.DATABASE_URL)
  throw Error(
    'Uso: node --env-file=archivo-de-nube.env scripts/restore-cloud.ts respaldo/postgres.json',
  );
const backup = JSON.parse(await readFile(path, 'utf8'));
const tables = [
  'users',
  'reports',
  'observations',
  'zones',
  'observation_photos',
  'zone_reviews',
  'zone_review_history',
];
if (backup.version !== 1 || !tables.every((t) => Array.isArray(backup.tables?.[t])))
  throw Error('Respaldo incompleto o incompatible.');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN');
  await db.query(
    `LOCK TABLE ${tables.map((t) => 'public.' + t).join(',')} IN SHARE ROW EXCLUSIVE MODE`,
  );
  for (const table of tables) {
    if ((await db.query(`SELECT 1 FROM public.${table} LIMIT 1`)).rowCount)
      throw Error(`La tabla ${table} tiene datos. No se sobrescribirá.`);
  }
  for (const table of tables) {
    const rows = backup.tables[table];
    await db.query(
      `INSERT INTO public.${table} OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::public.${table},$1::jsonb)`,
      [JSON.stringify(rows)],
    );
    if (['users', 'reports', 'observations', 'zone_review_history'].includes(table))
      await db.query(
        `SELECT setval(pg_get_serial_sequence('public.${table}','id'),COALESCE(max(id),1),max(id) IS NOT NULL) FROM public.${table}`,
      );
    console.log(`${table}: ${rows.length} registros`);
  }
  await db.query('COMMIT');
  console.log(
    'Restauración PostgreSQL completada. Las sesiones no se copiaron. Falta comprobar y migrar multimedia.',
  );
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}

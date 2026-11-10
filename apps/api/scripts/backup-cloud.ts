import pg from 'pg';
import { MongoClient } from 'mongodb';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { MediaDocument } from '../src/media.ts';

if (!process.env.DATABASE_URL || !process.env.MONGODB_URI)
  throw Error('Configura las bases locales antes del respaldo.');
const directory = resolve('data/backups', new Date().toISOString().replace(/[:.]/g, '-'));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }),
  mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
const tables = [
  'users',
  'reports',
  'observations',
  'zones',
  'observation_photos',
  'zone_reviews',
  'zone_review_history',
];
await mkdir(join(directory, 'media'), { recursive: true });
try {
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const data: Record<string, unknown[]> = {};
  for (const table of tables) data[table] = (await db.query(`SELECT * FROM public.${table}`)).rows;
  await db.query('COMMIT');
  await writeFile(
    join(directory, 'postgres.json'),
    JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: data }),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
  console.log('Respaldo PostgreSQL guardado en ' + directory);
  await mongo.connect();
  const media = await mongo
    .db(process.env.MONGODB_DATABASE ?? 'bioatlas')
    .collection<MediaDocument>('observation_media')
    .find({})
    .toArray();
  for (const item of media.filter((m) => m.provider === 'local')) {
    if (!/^[a-zA-Z0-9_-]+\.(jpg|png|mp4)$/.test(item.objectName))
      throw Error('Nombre multimedia inválido en el respaldo.');
    await copyFile(
      join(resolve(process.env.MEDIA_LOCAL_DIR ?? 'data/media'), item.objectName),
      join(directory, 'media', item.objectName),
    );
  }
  await writeFile(
    join(directory, 'backup.json'),
    JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: data, media }),
    { encoding: 'utf8', flag: 'wx', mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      directory,
      tables: Object.fromEntries(tables.map((t) => [t, data[t].length])),
      media: media.length,
    }),
  );
} finally {
  await db.end();
  await mongo.close();
}

import pg from 'pg';
import { createApp } from './app.ts';
import { createRepository } from './repository.ts';
if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en apps/api/.env');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  statement_timeout: 5000,
});
await pool.query('SELECT 1');
const app = createApp(createRepository(pool), true);
app.addHook('onClose', async () => {
  await pool.end();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void app.close());
await app.listen({ port: Number(process.env.PORT || 3000), host: process.env.HOST || '0.0.0.0' });

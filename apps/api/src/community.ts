import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import {
  credentialsSchema,
  registrationSchema,
  reportInputSchema,
  reviewSchema,
  type User,
} from '@bioatlas/contracts';

const derive = promisify(scrypt);
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const failure = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  const key = (await derive(password, salt, 64)) as Buffer;
  const stored = Buffer.from(hash, 'hex');
  return stored.length === key.length && timingSafeEqual(stored, key);
}
const columns = `id::text, scientific_name AS "scientificName", description, latitude, longitude,
  event_date::text AS "eventDate", status, review_note AS "reviewNote", created_at::text AS "createdAt"`;

export function registerCommunity(app: FastifyInstance, pool: Pool) {
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  function bearer(request: FastifyRequest) {
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) throw failure(401, 'Inicia sesión para continuar.');
    return token;
  }
  async function authenticate(request: FastifyRequest, admin = false): Promise<User> {
    const result = await pool.query<User>(
      `SELECT u.id::text,u.name,u.email,u.role FROM sessions s
      JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
      [digest(bearer(request))],
    );
    const user = result.rows[0];
    if (!user) throw failure(401, 'Tu sesión venció. Vuelve a iniciar sesión.');
    if (admin && user.role !== 'admin')
      throw failure(403, 'Esta función requiere un administrador.');
    return user;
  }
  async function session(user: User) {
    const token = randomBytes(32).toString('hex');
    await pool.query('DELETE FROM sessions WHERE user_id=$1 AND expires_at<=now()', [user.id]);
    await pool.query('INSERT INTO sessions(token_hash,user_id) VALUES($1,$2)', [
      digest(token),
      user.id,
    ]);
    return { token, user };
  }
  const authLimit = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } };
  app.post('/v1/auth/register', authLimit, async (request, reply) => {
    const input = registrationSchema.safeParse(request.body);
    if (!input.success)
      throw failure(400, 'Revisa el nombre, correo y contraseña (mínimo 10 caracteres).');
    const { name, email, password } = input.data;
    const passwordHash = await hashPassword(password);
    const result = await pool.query<User>(
      `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3)
      ON CONFLICT(email) DO NOTHING RETURNING id::text,name,email,role`,
      [name, email, passwordHash],
    );
    if (!result.rows[0])
      throw failure(409, 'No se pudo registrar ese correo. Prueba iniciar sesión.');
    reply.code(201);
    return session(result.rows[0]);
  });
  app.post('/v1/auth/login', authLimit, async (request) => {
    const input = credentialsSchema.safeParse(request.body);
    if (!input.success) throw failure(400, 'Revisa el correo y la contraseña.');
    const result = await pool.query<User & { password_hash: string }>(
      'SELECT id::text,name,email,role,password_hash FROM users WHERE email=$1',
      [input.data.email],
    );
    const row = result.rows[0];
    const valid = await verifyPassword(
      input.data.password,
      row?.password_hash ?? (await dummyHash),
    );
    if (!row || !valid) throw failure(401, 'Correo o contraseña incorrectos.');
    const { password_hash: _, ...user } = row;
    return session(user);
  });
  app.get('/v1/auth/me', async (request) => authenticate(request));
  app.post('/v1/auth/logout', async (request, reply) => {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [digest(bearer(request))]);
    return reply.code(204).send();
  });
  app.post(
    '/v1/reports',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const user = await authenticate(request);
      const input = reportInputSchema.safeParse(request.body);
      if (!input.success)
        throw failure(400, 'Revisa la especie, descripción, fecha y coordenadas.');
      const r = input.data;
      const inserted = await pool.query(
        `INSERT INTO reports(user_id,scientific_name,description,latitude,longitude,event_date)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING ${columns}`,
        [user.id, r.scientificName, r.description, r.latitude, r.longitude, r.eventDate],
      );
      return reply.code(201).send(inserted.rows[0]);
    },
  );
  for (const admin of [false, true]) {
    app.get(admin ? '/v1/admin/reports' : '/v1/reports/mine', async (request) => {
      const user = await authenticate(request, admin);
      const raw = (request.query as { offset?: string }).offset ?? '0';
      if (!/^\d{1,6}$/.test(raw)) throw failure(400, 'Página inválida.');
      const rows = await pool.query(
        `SELECT ${columns} FROM reports WHERE ${admin ? "status='pending'" : 'user_id=$1'}
        ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $${admin ? 1 : 2}`,
        admin ? [Number(raw)] : [user.id, Number(raw)],
      );
      return { items: rows.rows.slice(0, 50), hasMore: rows.rows.length > 50 };
    });
  }
  app.patch('/v1/admin/reports/:id', async (request) => {
    const user = await authenticate(request, true);
    const id = (request.params as { id: string }).id;
    const review = reviewSchema.safeParse(request.body);
    if (!/^\d{1,18}$/.test(id) || !review.success)
      throw failure(400, 'Indica una decisión y una nota de revisión.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE reports SET status=$2,review_note=$3,reviewed_by=$4,reviewed_at=now()
        WHERE id=$1 AND status='pending' RETURNING ${columns}`,
        [id, review.data.status, review.data.note, user.id],
      );
      const r = result.rows[0];
      if (!r) throw failure(409, 'Este reporte ya fue revisado o no existe. Actualiza la lista.');
      if (review.data.status === 'approved') {
        await client.query(
          `INSERT INTO observations(source,source_id,scientific_name,location,event_date)
          VALUES('BioAtlas comunitario',$1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326),$5)`,
          [id, r.scientificName, r.longitude, r.latitude, r.eventDate],
        );
      }
      await client.query('COMMIT');
      return r;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
}

import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { MongoClient, type Collection } from 'mongodb';
import { Storage } from '@google-cloud/storage';
import multipart from '@fastify/multipart';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { reviewSchema, type User } from '@bioatlas/contracts';
import { authenticateUser } from './community.ts';
import { createSupabaseStorage, type RemoteStorage } from './supabase-storage.ts';

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const fail = (statusCode: number, message: string) => Object.assign(Error(message), { statusCode });
export type MediaDocument = {
  _id: string;
  reportId: string;
  title: string;
  description: string;
  createdAt: string;
  size: number;
  author: string;
  ownerId: string;
  objectName: string;
  provider: 'local' | 'gcs' | 'supabase';
  kind: 'image' | 'video';
  mime: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote: string | null;
  reviewedBy?: string;
  reviewedAt?: string;
};
export type MediaService = {
  collection: Collection<MediaDocument>;
  directory: string;
  bucket?: ReturnType<Storage['bucket']>;
  remote?: RemoteStorage;
  close: () => Promise<void>;
};
export async function createMediaService(): Promise<MediaService | undefined> {
  if (!process.env.MONGODB_URI) return undefined;
  const provider = process.env.MEDIA_STORAGE ?? 'local';
  if (!['local', 'gcs', 'supabase'].includes(provider))
    throw Error('MEDIA_STORAGE debe ser local, gcs o supabase');
  if (provider === 'gcs' && !process.env.GCS_BUCKET) throw Error('GCS_BUCKET requerido');
  const remote = provider === 'supabase' ? createSupabaseStorage() : undefined;
  await remote?.verify();
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const collection = client
      .db(process.env.MONGODB_DATABASE ?? 'bioatlas')
      .collection<MediaDocument>('observation_media');
    await collection.createIndex({ reportId: 1, status: 1, createdAt: -1 });
    const directory = resolve(process.env.MEDIA_LOCAL_DIR ?? 'data/media');
    await mkdir(directory, { recursive: true });
    return {
      collection,
      directory,
      remote,
      bucket:
        provider === 'gcs'
          ? new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT }).bucket(
              process.env.GCS_BUCKET!,
            )
          : undefined,
      close: () => client.close(),
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
export function isMp4(header: Buffer) {
  if (header.length < 16 || header.toString('ascii', 4, 8) !== 'ftyp') return false;
  const boxSize = header.readUInt32BE(0);
  if (boxSize < 16 || boxSize > 4096 || boxSize > header.length) return false;
  const brands = [header.toString('ascii', 8, 12)];
  for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(header.toString('ascii', i, i + 4));
  return brands.some((b) => ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V '].includes(b));
}
export function detectMedia(header: Buffer) {
  if (isMp4(header)) return { kind: 'video' as const, mime: 'video/mp4', ext: 'mp4' };
  if (header.length >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255)
    return { kind: 'image' as const, mime: 'image/jpeg', ext: 'jpg' };
  if (
    header.length >= 8 &&
    header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { kind: 'image' as const, mime: 'image/png', ext: 'png' };
  return null;
}
export function parseRange(value: string | undefined, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw fail(416, 'Rango de archivo inválido.');
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw fail(416, 'Rango de archivo inválido.');
  return { start, end };
}
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(id);
const reportIdValid = (id: string) => /^\d{1,18}$/.test(id);
const publicMedia = (
  { _id, ownerId, objectName: _, provider: __, reviewedBy: ___, ...rest }: MediaDocument,
  user: User | null,
) => ({ id: _id, ...rest, canDelete: user?.role === 'admin' || user?.id === ownerId });

export function registerMedia(app: FastifyInstance, pool: Pool, media?: MediaService) {
  const optionalUser = (r: FastifyRequest) =>
    r.headers.authorization ? authenticateUser(pool, r) : Promise.resolve(null);
  async function report(id: string) {
    if (!reportIdValid(id)) throw fail(400, 'Avistamiento inválido.');
    const result = await pool.query<{ user_id: string; status: string }>(
      'SELECT user_id::text,status FROM reports WHERE id=$1',
      [id],
    );
    if (!result.rows[0]) throw fail(404, 'Avistamiento no encontrado.');
    return result.rows[0];
  }
  async function readable(id: string, request: FastifyRequest) {
    if (!media) throw fail(503, 'El contenido multimedia no está disponible.');
    if (!validId(id)) throw fail(400, 'Archivo inválido.');
    const item = await media.collection.findOne({ _id: id });
    if (!item) throw fail(404, 'Archivo no encontrado.');
    const user = await optionalUser(request),
      r = await report(item.reportId);
    if (
      !(r.status === 'approved' && item.status === 'approved') &&
      user?.role !== 'admin' &&
      user?.id !== item.ownerId
    )
      throw fail(404, 'Archivo no encontrado.');
    return item;
  }
  app.register(async (scoped) => {
    await scoped.register(multipart, {
      limits: { files: 1, fields: 0, parts: 1, fileSize: MAX_VIDEO_BYTES },
    });
    scoped.get('/v1/admin/media', async (request) => {
      const user = await authenticateUser(pool, request, true);
      if (!media) return { enabled: false, items: [] };
      const rows = await media.collection
        .find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(50)
        .toArray();
      return { enabled: true, items: rows.map((item) => publicMedia(item, user)) };
    });
    scoped.get('/v1/reports/:reportId/media', async (request) => {
      const { reportId } = request.params as { reportId: string };
      const r = await report(reportId),
        user = await optionalUser(request);
      const privileged = user?.role === 'admin' || user?.id === r.user_id;
      if (!privileged && r.status !== 'approved') throw fail(404, 'Avistamiento no encontrado.');
      if (!media) return { enabled: false, items: [] };
      const rows = await media.collection
        .find({ reportId, ...(!privileged ? { status: 'approved' as const } : {}) })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
      return { enabled: true, items: rows.map((item) => publicMedia(item, user)) };
    });
    scoped.get('/v1/zones/:zoneId/media', async (request) => {
      const { zoneId } = request.params as { zoneId: string };
      if (!validId(zoneId)) throw fail(400, 'Zona inválida.');
      if (!media) return { enabled: false, items: [] };
      const rows = await media.collection.find({ status: 'approved' }).sort({ createdAt: -1 });
      // Join in bounded batches so older media in this zone are not hidden by other zones.
      const items: ReturnType<typeof publicMedia>[] = [];
      try {
        while ((await rows.hasNext()) && items.length < 50) {
          const batch: MediaDocument[] = [];
          while (batch.length < 100 && (await rows.hasNext())) batch.push((await rows.next())!);
          const matched = await pool.query<{ id: string }>(
            `SELECT r.id::text FROM reports r JOIN zones z ON z.id=$1 WHERE r.status='approved' AND r.id::text=ANY($2) AND ST_Covers(z.boundary,ST_SetSRID(ST_MakePoint(r.longitude,r.latitude),4326))`,
            [zoneId, batch.map((i) => i.reportId)],
          );
          const ids = new Set(matched.rows.map((r) => r.id));
          for (const item of batch)
            if (ids.has(item.reportId) && items.length < 50) items.push(publicMedia(item, null));
        }
      } finally {
        await rows.close();
      }
      return { enabled: true, items };
    });
    scoped.post(
      '/v1/reports/:reportId/media',
      { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
      async (request, reply) => {
        const user = await authenticateUser(pool, request);
        if (!media) throw fail(503, 'El almacenamiento todavía no está configurado.');
        const { reportId } = request.params as { reportId: string };
        const r = await report(reportId);
        if (r.user_id !== user.id)
          throw fail(403, 'Solo puedes adjuntar archivos a tus propios avistamientos.');
        if (r.status === 'rejected')
          throw fail(
            409,
            'Este avistamiento fue rechazado. Revisa la nota antes de crear uno nuevo.',
          );
        const query = request.query as { title?: string; description?: string };
        if (
          typeof query.title !== 'string' ||
          query.title.trim().length < 3 ||
          query.title.length > 160 ||
          (query.description !== undefined &&
            (typeof query.description !== 'string' || query.description.length > 2000))
        )
          throw fail(400, 'Revisa el título y la descripción.');
        if ((await media.collection.countDocuments({ reportId })) >= 20)
          throw fail(409, 'Este avistamiento alcanzó el límite de 20 archivos.');
        const part = await request.file();
        if (!part) throw fail(400, 'Selecciona una foto JPEG/PNG o un video MP4.');
        if (!['video/mp4', 'image/jpeg', 'image/png'].includes(part.mimetype)) {
          part.file.resume();
          throw fail(400, 'Solo se admiten JPEG, PNG y MP4.');
        }
        const id = randomUUID(),
          temporary = join(media.directory, `${id}.upload`);
        let stored = false,
          objectName = '';
        try {
          await pipeline(part.file, createWriteStream(temporary, { flags: 'wx' }));
          const size = (await stat(temporary)).size;
          if (part.file.truncated || size > MAX_VIDEO_BYTES)
            throw fail(413, 'El archivo supera los 50 MB.');
          const file = await open(temporary, 'r');
          const header = Buffer.alloc(Math.min(size, 4096));
          try {
            await file.read(header, 0, header.length, 0);
          } finally {
            await file.close();
          }
          const format = detectMedia(header);
          if (!format || format.mime !== part.mimetype)
            throw fail(400, 'El contenido no coincide con un formato permitido.');
          if (format.kind === 'image' && size > MAX_IMAGE_BYTES)
            throw fail(413, 'La foto supera los 10 MB.');
          objectName = `${id}.${format.ext}`;
          if (media.remote) await media.remote.upload(temporary, objectName, format.mime);
          else if (media.bucket)
            await media.bucket.upload(temporary, {
              destination: objectName,
              resumable: true,
              preconditionOpts: { ifGenerationMatch: 0 },
              metadata: { contentType: format.mime, cacheControl: 'private,max-age=120' },
            });
          else await rename(temporary, join(media.directory, objectName));
          stored = true;
          const item: MediaDocument = {
            _id: id,
            reportId,
            title: query.title.trim(),
            description: query.description?.trim() ?? '',
            createdAt: new Date().toISOString(),
            size,
            author: user.name,
            ownerId: user.id,
            objectName,
            provider: media.remote ? 'supabase' : media.bucket ? 'gcs' : 'local',
            kind: format.kind,
            mime: format.mime,
            status: 'pending',
            reviewNote: null,
          };
          await media.collection.insertOne(item);
          return reply.code(201).send(publicMedia(item, user));
        } catch (error) {
          if (stored) {
            if (media.remote) await media.remote.remove(objectName).catch(() => {});
            else if (media.bucket)
              await media.bucket
                .file(objectName)
                .delete({ ignoreNotFound: true })
                .catch(() => {});
            else await rm(join(media.directory, objectName), { force: true });
          }
          throw error;
        } finally {
          await rm(temporary, { force: true });
        }
      },
    );
    scoped.patch('/v1/media/:id/review', async (request) => {
      const user = await authenticateUser(pool, request, true);
      if (!media) throw fail(503, 'Contenido no disponible.');
      const { id } = request.params as { id: string },
        decision = reviewSchema.safeParse(request.body);
      if (!validId(id) || !decision.success)
        throw fail(400, 'Indica una decisión y una nota de revisión.');
      const item = await media.collection.findOneAndUpdate(
        { _id: id, status: 'pending' },
        {
          $set: {
            status: decision.data.status,
            reviewNote: decision.data.note,
            reviewedBy: user.id,
            reviewedAt: new Date().toISOString(),
          },
        },
        { returnDocument: 'after' },
      );
      if (!item) throw fail(409, 'El archivo ya fue revisado o no existe.');
      return publicMedia(item, user);
    });
    scoped.get('/v1/media/:id/playback', async (request, reply) => {
      const item = await readable((request.params as { id: string }).id, request);
      reply.header('Cache-Control', 'no-store');
      if (item.provider === 'supabase') {
        if (!media?.remote)
          throw fail(503, 'Configura el almacenamiento original para abrir este archivo.');
        return { url: await media.remote.signedUrl(item.objectName) };
      }
      if (item.provider === 'gcs') {
        if (!media?.bucket)
          throw fail(503, 'Configura el bucket original para abrir este archivo.');
        const [url] = await media.bucket
          .file(item.objectName)
          .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 120000 });
        return { url };
      }
      return { url: `/v1/media/${item._id}/content` };
    });
    scoped.get('/v1/media/:id/content', async (request, reply) => {
      const item = await readable((request.params as { id: string }).id, request);
      if (item.provider !== 'local') throw fail(404, 'Archivo no encontrado.');
      const path = join(media!.directory, item.objectName);
      let size: number;
      try {
        size = (await stat(path)).size;
      } catch {
        throw fail(404, 'El archivo no está disponible.');
      }
      let range: ReturnType<typeof parseRange>;
      try {
        range = parseRange(request.headers.range, size);
      } catch (error) {
        reply.header('Content-Range', `bytes */${size}`);
        throw error;
      }
      reply
        .type(item.mime)
        .header('Accept-Ranges', 'bytes')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private,no-store');
      if (range) {
        reply
          .code(206)
          .header('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
          .header('Content-Length', range.end - range.start + 1);
        return reply.send(createReadStream(path, range));
      }
      return reply.header('Content-Length', size).send(createReadStream(path));
    });
    scoped.delete('/v1/media/:id', async (request, reply) => {
      const user = await authenticateUser(pool, request);
      if (!media) throw fail(503, 'Contenido no disponible.');
      const { id } = request.params as { id: string };
      if (!validId(id)) throw fail(400, 'Archivo inválido.');
      const item = await media.collection.findOne({ _id: id });
      if (!item) throw fail(404, 'Archivo no encontrado.');
      if (user.role !== 'admin' && user.id !== item.ownerId)
        throw fail(403, 'No puedes eliminar archivos de otra persona.');
      if (item.provider === 'gcs') {
        if (!media.bucket) throw fail(503, 'Configura el bucket original.');
        await media.bucket.file(item.objectName).delete({ ignoreNotFound: true });
      } else if (item.provider === 'supabase') {
        if (!media.remote) throw fail(503, 'Configura el almacenamiento original.');
        await media.remote.remove(item.objectName);
      } else await rm(join(media.directory, item.objectName), { force: true });
      await media.collection.deleteOne({ _id: id });
      return reply.code(204).send();
    });
  });
}

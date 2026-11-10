import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export function registerZonePhotos(app: FastifyInstance, pool: Pool) {
  app.get('/v1/zones/:id/photos', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { offset?: string; group?: string };
    const offset = Number(q.offset ?? 0),
      group = q.group ?? 'all';
    if (
      !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 10000 ||
      !['all', 'plants', 'animals', 'fungi'].includes(group)
    )
      return reply.code(400).send({ message: 'Filtro de fotografías inválido.' });
    if (!(await pool.query('SELECT 1 FROM zones WHERE id=$1', [id])).rowCount)
      return reply.code(404).send({ message: 'Zona no encontrada.' });
    const result = await pool.query(
      `SELECT o.id::text AS "observationId",p.photo_id::text AS "photoId",o.scientific_name AS "scientificName",o.common_name AS "commonName",o.taxon_group AS "taxonGroup",p.attribution,p.license,o.source_url AS "sourceUrl",o.event_date AS "eventDate"
      FROM observation_photos p JOIN observations o ON o.id=p.observation_id JOIN zones z ON z.id=$1 AND ST_Covers(z.boundary,o.location)
      WHERE ($2='all' OR ($2='plants' AND o.taxon_group='Plantae') OR ($2='fungi' AND o.taxon_group='Fungi') OR ($2='animals' AND o.taxon_group IN ('Aves','Mammalia','Reptilia','Amphibia','Actinopterygii','Insecta','Arachnida','Mollusca','Animalia')))
      ORDER BY o.event_date DESC NULLS LAST,o.id DESC,p.photo_id LIMIT 13 OFFSET $3`,
      [id, group, offset],
    );
    return { items: result.rows.slice(0, 12), hasMore: result.rows.length > 12 };
  });
  app.get('/v1/observation-photos/:observationId/:photoId', async (request, reply) => {
    const { observationId, photoId } = request.params as { observationId: string; photoId: string };
    if (![observationId, photoId].every((v) => /^\d{1,18}$/.test(v)))
      return reply.code(400).send({ message: 'Foto inválida.' });
    const record = (
      await pool.query(
        'SELECT url FROM observation_photos WHERE observation_id=$1 AND photo_id=$2',
        [observationId, photoId],
      )
    ).rows[0];
    if (!record) return reply.code(404).send({ message: 'Foto no encontrada.' });
    const expected = `https://inaturalist-open-data.s3.amazonaws.com/photos/${photoId}/medium.jpg`;
    if (record.url !== expected)
      return reply.code(404).send({ message: 'Origen de foto no disponible.' });
    const directory = resolve('data/observation-photo-cache'),
      file = join(directory, photoId + '.jpg');
    try {
      const info = await stat(file);
      if (Date.now() - info.mtimeMs < 86400000)
        return reply
          .type('image/jpeg')
          .header('Cache-Control', 'public,max-age=3600')
          .send(await readFile(file));
    } catch {}
    try {
      const response = await fetch(expected, {
        redirect: 'error',
        headers: { 'User-Agent': 'BioAtlas/0.1 (+https://github.com/Thecharles445/bioatlas)' },
        signal: AbortSignal.timeout(15000),
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.startsWith('image/jpeg') ||
        !response.body
      )
        throw Error('Photo unavailable');
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 5 * 1024 * 1024) {
            await reader.cancel();
            throw Error('Photo too large');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const image = Buffer.concat(chunks);
      if (image.length < 3 || image[0] !== 255 || image[1] !== 216 || image[2] !== 255)
        throw Error('Invalid JPEG');
      await mkdir(directory, { recursive: true });
      await writeFile(file, image);
      return reply.type('image/jpeg').header('Cache-Control', 'public,max-age=3600').send(image);
    } catch (error) {
      request.log.warn({ err: error }, 'External photo unavailable');
      return reply
        .code(503)
        .header('Cache-Control', 'no-store')
        .send({ message: 'No pudimos cargar la foto. Reintenta o consulta su fuente.' });
    }
  });
}

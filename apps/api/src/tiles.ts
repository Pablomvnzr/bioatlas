import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { FastifyInstance } from 'fastify';

type CachedTile = { expires: number; etag?: string; modified?: string; body: string };
export function registerTiles(app: FastifyInstance) {
  const directory = resolve('data/map-cache');
  const pending = new Map<string, Promise<CachedTile>>();
  app.get(
    '/map/tiles/:z/:x/:y.png',
    { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { z, x, y } = request.params as { z: string; x: string; y: string };
      if (![z, x, y].every((v) => /^\d{1,6}$/.test(v)) || +z > 19 || +x >= 2 ** +z || +y >= 2 ** +z)
        return reply.code(400).send({ message: 'Coordenadas de mapa inválidas.' });
      const key = `${z}-${x}-${y}`,
        file = join(directory, key + '.json');
      let cached: CachedTile | undefined;
      try {
        cached = JSON.parse(await readFile(file, 'utf8'));
      } catch {}
      if (!cached || cached.expires <= Date.now()) {
        let task = pending.get(key);
        if (!task) {
          const previous = cached;
          task = (async () => {
            const headers: Record<string, string> = {
              'User-Agent': 'BioAtlas/0.1 (+https://github.com/Thecharles445/bioatlas)',
            };
            if (request.headers.referer) headers.Referer = request.headers.referer;
            if (previous?.etag) headers['If-None-Match'] = previous.etag;
            if (previous?.modified) headers['If-Modified-Since'] = previous.modified;
            const response = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
              headers,
              signal: AbortSignal.timeout(12000),
            });
            if (
              response.status !== 304 &&
              (!response.ok || !response.headers.get('content-type')?.startsWith('image/png'))
            )
              throw Error('No se pudo descargar el mapa base.');
            const age = Number(response.headers.get('age') ?? 0);
            const maxAge = response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1];
            const seconds = maxAge ? Math.max(0, Number(maxAge) - age) : 7 * 86400;
            const body =
              response.status === 304
                ? previous?.body
                : Buffer.from(await response.arrayBuffer()).toString('base64');
            if (!body) throw Error('Respuesta de mapa vacía.');
            const tile: CachedTile = {
              body,
              expires: Date.now() + seconds * 1000,
              etag: response.headers.get('etag') ?? previous?.etag,
              modified: response.headers.get('last-modified') ?? previous?.modified,
            };
            await mkdir(directory, { recursive: true });
            await writeFile(file, JSON.stringify(tile));
            return tile;
          })();
          pending.set(key, task);
        }
        try {
          cached = await task;
        } catch (error) {
          request.log.warn({ err: error }, 'Map tile unavailable');
          return reply
            .code(503)
            .header('Cache-Control', 'no-store')
            .send({ message: 'No se pudo descargar el mapa base. Reintenta en unos segundos.' });
        } finally {
          pending.delete(key);
        }
      }
      return reply
        .type('image/png')
        .header(
          'Cache-Control',
          `public, max-age=${Math.max(0, Math.floor((cached.expires - Date.now()) / 1000))}`,
        )
        .send(Buffer.from(cached.body, 'base64'));
    },
  );
}

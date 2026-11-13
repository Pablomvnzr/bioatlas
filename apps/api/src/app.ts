import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { searchSchema } from '@bioatlas/contracts';
import type { ObservationRepository } from './repository.ts';
import type { Pool } from 'pg';
import { registerCommunity } from './community.ts';
import { registerMap } from './map.ts';
import { registerZones } from './zones.ts';
import { registerMedia, type MediaService } from './media.ts';
export function createApp(
  repository: ObservationRepository,
  logger = false,
  pool?: Pool,
  media?: MediaService,
) {
  const app = Fastify({
    trustProxy: process.env.RENDER === 'true' ? (_address, index) => index < 1 : false,
    logger: logger ? { redact: ['req.headers.authorization', 'req.headers.cookie'] } : false,
    bodyLimit: 16384,
  });
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.method === 'GET' && request.url.split('?')[0] === '/v1/observations') {
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });
  registerMap(app);
  if (pool) {
    registerCommunity(app, pool);
    registerZones(app, pool);
    registerMedia(app, pool, media);
  }
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/v1/observations', async (request, reply) => {
    const query = searchSchema.safeParse(request.query);
    if (!query.success)
      return reply.code(400).send({ message: 'Revisa la zona y los filtros de búsqueda.' });
    return repository.search(query.data);
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const status = error instanceof Error && 'statusCode' in error ? Number(error.statusCode) : 500;
    const code = (status >= 400 && status < 500) || status === 503 ? status : 500;
    reply.code(code).send({
      message:
        code === 429
          ? 'Demasiadas consultas. Inténtalo más tarde.'
          : code !== 500 && error instanceof Error
            ? error.message
            : 'No pudimos completar la solicitud. Inténtalo nuevamente.',
    });
  });
  return app;
}

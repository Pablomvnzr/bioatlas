import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { searchSchema } from '@bioatlas/contracts';
import type { ObservationRepository } from './repository.ts';
export function createApp(repository: ObservationRepository, logger = false) {
  const app = Fastify({ logger, bodyLimit: 16384 });
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/v1/observations', async (request, reply) => {
    const query = searchSchema.safeParse(request.query);
    if (!query.success)
      return reply.code(400).send({ message: 'Revisa la zona y los filtros de búsqueda.' });
    return repository.search(query.data);
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const code =
      error instanceof Error && 'statusCode' in error && error.statusCode === 429 ? 429 : 500;
    reply.code(code).send({
      message:
        code === 429
          ? 'Demasiadas consultas. Inténtalo más tarde.'
          : 'No pudimos consultar los registros. Inténtalo nuevamente.',
    });
  });
  return app;
}

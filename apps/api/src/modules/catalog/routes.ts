import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { catalogResponseSchema } from '@freenem/shared';
import { getCatalog } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/catalog',
    { schema: { response: { 200: catalogResponseSchema } } },
    async (_req, reply) => {
      reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=600');
      return getCatalog();
    },
  );
};

export default routes;

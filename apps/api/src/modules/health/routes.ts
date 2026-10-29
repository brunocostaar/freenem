import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { healthResponseSchema } from '@freenem/shared';
import { db } from '../../db/index.js';
import { checkDb } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: { response: { 200: healthResponseSchema, 503: healthResponseSchema } },
    },
    async (_req, reply) => {
      const dbOk = await checkDb(db);
      const body = {
        status: dbOk ? ('ok' as const) : ('degraded' as const),
        db: dbOk,
        uptime: Math.round(process.uptime()),
      };
      return reply.status(dbOk ? 200 : 503).send(body);
    },
  );
};

export default routes;

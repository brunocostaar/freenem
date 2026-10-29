import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { meResponseSchema } from '@freenem/shared';
import { toMe } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    { preHandler: app.authenticate, schema: { response: { 200: meResponseSchema } } },
    async (req) => toMe(req.sessionUser!),
  );
};

export default routes;

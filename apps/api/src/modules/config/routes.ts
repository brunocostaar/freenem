import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { publicConfigSchema } from '@freenem/shared';
import { features } from '../../env.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get('/config', { schema: { response: { 200: publicConfigSchema } } }, async () => ({
    features,
  }));
};

export default routes;

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  statsOverviewQuerySchema,
  statsOverviewSchema,
  statsTopicsQuerySchema,
  statsTopicsResponseSchema,
} from '@freenem/shared';
import { getOverview, getTopics } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/stats/overview',
    {
      preHandler: app.authenticate,
      schema: { querystring: statsOverviewQuerySchema, response: { 200: statsOverviewSchema } },
    },
    async (req) => getOverview(req.sessionUser!.id, req.query.range),
  );

  app.get(
    '/stats/topics',
    {
      preHandler: app.authenticate,
      schema: { querystring: statsTopicsQuerySchema, response: { 200: statsTopicsResponseSchema } },
    },
    async (req) => ({ topics: await getTopics(req.sessionUser!.id, req.query) }),
  );
};

export default routes;

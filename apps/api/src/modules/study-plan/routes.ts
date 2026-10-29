import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  idParamSchema,
  studyPlanCreateSchema,
  studyPlanItemUpdateResponseSchema,
  studyPlanItemUpdateSchema,
  studyPlanRebalanceSchema,
  studyPlanResponseSchema,
} from '@freenem/shared';
import { createPlan, getPlan, rebalancePlan, setItemDone } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/study-plan',
    { preHandler: app.authenticate, schema: { response: { 200: studyPlanResponseSchema } } },
    async (req) => ({ plan: await getPlan(req.sessionUser!.id) }),
  );

  app.post(
    '/study-plan',
    {
      preHandler: app.authenticate,
      schema: { body: studyPlanCreateSchema, response: { 200: studyPlanResponseSchema } },
    },
    async (req) => ({ plan: await createPlan(app, req.sessionUser!.id, req.body) }),
  );

  app.post(
    '/study-plan/rebalance',
    {
      preHandler: app.authenticate,
      schema: {
        body: studyPlanRebalanceSchema.optional(),
        response: { 200: studyPlanResponseSchema },
      },
    },
    async (req) => ({
      plan: await rebalancePlan(app, req.sessionUser!.id, req.body?.focusAreas),
    }),
  );

  app.patch(
    '/study-plan/items/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: idParamSchema,
        body: studyPlanItemUpdateSchema,
        response: { 200: studyPlanItemUpdateResponseSchema },
      },
    },
    async (req) => setItemDone(app, req.sessionUser!.id, req.params.id, req.body.done),
  );
};

export default routes;

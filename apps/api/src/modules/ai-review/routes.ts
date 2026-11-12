import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  aiReviewListQuerySchema,
  aiReviewListResponseSchema,
  aiReviewRunBodySchema,
  aiReviewSchema,
  aiReviewStatusSchema,
  idParamSchema,
} from '@freenem/shared';
import { getStatus, listQuestions, runReview } from './service.js';

/** Revisão por IA (temporária): só admin. Devolve o gabarito, como /review. */
const routes: FastifyPluginAsyncZod = async (app) => {
  const guard = app.requireRole('admin');

  app.get(
    '/review/ai/status',
    { preHandler: guard, schema: { response: { 200: aiReviewStatusSchema } } },
    async () => getStatus(),
  );

  app.get(
    '/review/ai/questions',
    {
      preHandler: guard,
      schema: {
        querystring: aiReviewListQuerySchema,
        response: { 200: aiReviewListResponseSchema },
      },
    },
    async (req) => listQuestions(req.query),
  );

  app.post(
    '/review/ai/questions/:id/run',
    {
      preHandler: guard,
      schema: {
        params: idParamSchema,
        body: aiReviewRunBodySchema.default({}),
        response: { 200: aiReviewSchema },
      },
    },
    async (req) => {
      const r = await runReview(req.params.id, req.body.model);
      if (r.ok) return r.review;
      if (r.code === 'NOT_FOUND') throw app.httpErrors.notFound(r.message);
      if (r.code === 'DISABLED') throw app.httpErrors.serviceUnavailable(r.message);
      throw app.httpErrors.badGateway(r.message);
    },
  );
};

export default routes;

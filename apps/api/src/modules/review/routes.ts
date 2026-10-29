import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  idParamSchema,
  reviewListQuerySchema,
  reviewListResponseSchema,
  reviewPatchSchema,
  reviewQuestionSchema,
} from '@freenem/shared';
import { getForReview, listForReview, patchQuestion } from './service.js';

/** Fila de revisão: só reviewer/admin. Estas rotas devolvem o gabarito. */
const routes: FastifyPluginAsyncZod = async (app) => {
  const guard = app.requireRole('reviewer', 'admin');

  app.get(
    '/review/questions',
    {
      preHandler: guard,
      schema: { querystring: reviewListQuerySchema, response: { 200: reviewListResponseSchema } },
    },
    async (req) => listForReview(req.query),
  );

  app.get(
    '/review/questions/:id',
    {
      preHandler: guard,
      schema: { params: idParamSchema, response: { 200: reviewQuestionSchema } },
    },
    async (req) => {
      const q = await getForReview(req.params.id);
      if (!q) throw app.httpErrors.notFound('Questão não encontrada.');
      return q;
    },
  );

  app.patch(
    '/review/questions/:id',
    {
      preHandler: guard,
      schema: {
        params: idParamSchema,
        body: reviewPatchSchema,
        response: { 200: reviewQuestionSchema },
      },
    },
    async (req) => {
      const result = await patchQuestion(req.params.id, req.body, req.sessionUser!.id);
      if (!result.ok) {
        if (result.code === 'NOT_FOUND') throw app.httpErrors.notFound(result.message);
        throw app.httpErrors.unprocessableEntity(result.message);
      }
      const q = await getForReview(req.params.id);
      if (!q) throw app.httpErrors.notFound('Questão não encontrada.');
      return q;
    },
  );
};

export default routes;

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  answerResponseSchema,
  checkAnswerSchema,
  idParamSchema,
  questionFilterSchema,
  questionListResponseSchema,
  questionSummarySchema,
  savedResponseSchema,
  subjectProgressResponseSchema,
} from '@freenem/shared';
import { env } from '../../env.js';
import {
  buildAnswerResponse,
  getQuestionKey,
  questionInActiveAttempt,
} from '../answers/service.js';
import { getOptionalUser, isReviewer } from './optional-auth.js';
import {
  getQuestion,
  getSubjectProgress,
  listQuestions,
  questionIsVisible,
  setSaved,
} from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/questions',
    {
      schema: { querystring: questionFilterSchema, response: { 200: questionListResponseSchema } },
    },
    async (req) => {
      const f = req.query;
      const user = await getOptionalUser(req);
      const reviewer = isReviewer(user);
      if (!user && (f.onlyUnanswered || f.onlyWrong || f.onlySaved)) {
        throw app.httpErrors.unauthorized('Faça login para usar este filtro.');
      }
      if (f.status && f.status !== 'published' && !reviewer) {
        throw app.httpErrors.forbidden('Você não tem permissão para filtrar por este status.');
      }
      return listQuestions(f, { userId: user?.id ?? null, canSeeAllStatuses: reviewer });
    },
  );

  app.get(
    '/questions/progress',
    { schema: { response: { 200: subjectProgressResponseSchema } } },
    async (req) => {
      const user = await getOptionalUser(req);
      return { subjects: await getSubjectProgress(user?.id ?? null) };
    },
  );

  app.get(
    '/questions/:id',
    { schema: { params: idParamSchema, response: { 200: questionSummarySchema } } },
    async (req) => {
      const user = await getOptionalUser(req);
      const q = await getQuestion(req.params.id, {
        userId: user?.id ?? null,
        canSeeAllStatuses: isReviewer(user),
      });
      if (!q) throw app.httpErrors.notFound('Questão não encontrada.');
      return q;
    },
  );

  // Verificação pública (sem registrar): permite resolver sem conta.
  app.post(
    '/questions/:id/check',
    {
      config: env.RATE_LIMIT_ENABLED ? { rateLimit: { max: 60, timeWindow: '1 minute' } } : {},
      schema: {
        params: idParamSchema,
        body: checkAnswerSchema,
        response: { 200: answerResponseSchema },
      },
    },
    async (req) => {
      const user = await getOptionalUser(req);
      const key = await getQuestionKey(req.params.id);
      if (!key || (key.status !== 'published' && !isReviewer(user))) {
        throw app.httpErrors.notFound('Questão não encontrada.');
      }
      // Anti-cola: não revela o gabarito de uma questão que está num simulado em andamento.
      if (user && (await questionInActiveAttempt(user.id, req.params.id))) {
        throw app.httpErrors.conflict('Finalize o simulado para ver o gabarito desta questão.');
      }
      return buildAnswerResponse(key, req.params.id, req.body.letter);
    },
  );

  app.put(
    '/questions/:id/save',
    {
      preHandler: app.authenticate,
      schema: { params: idParamSchema, response: { 200: savedResponseSchema } },
    },
    async (req) => {
      if (!(await questionIsVisible(req.params.id, isReviewer(req.sessionUser))))
        throw app.httpErrors.notFound('Questão não encontrada.');
      await setSaved(req.sessionUser!.id, req.params.id, true);
      return { saved: true };
    },
  );

  app.delete(
    '/questions/:id/save',
    {
      preHandler: app.authenticate,
      schema: { params: idParamSchema, response: { 200: savedResponseSchema } },
    },
    async (req) => {
      await setSaved(req.sessionUser!.id, req.params.id, false);
      return { saved: false };
    },
  );
};

export default routes;

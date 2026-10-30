import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  idParamSchema,
  myResolutionsSchema,
  resolutionBodySchema,
  resolutionListResponseSchema,
  resolutionModerationSchema,
  resolutionReviewListSchema,
  resolutionReviewQuerySchema,
  resolutionSchema,
  voteResolutionResponseSchema,
  voteResolutionSchema,
} from '@freenem/shared';
import { env, features } from '../../env.js';
import { AppError } from '../../lib/app-error.js';
import { getOptionalUser, isReviewer } from '../questions/optional-auth.js';
import {
  createResolution,
  deleteResolution,
  listForModeration,
  listResolutions,
  moderateResolution,
  myResolutions,
  questionAccessible,
  updateResolution,
  voteResolution,
} from './service.js';

const EMPTY_MSG = 'Escreva ao menos 20 caracteres de texto (HTML e imagens não são permitidos).';

/**
 * Resoluções da comunidade. A listagem é pública, mas elas revelam o raciocínio (e portanto a
 * resposta): o web só as mostra depois que a pessoa respondeu/verificou a questão.
 */
const routes: FastifyPluginAsyncZod = async (app) => {
  const auth = { preHandler: app.authenticate };

  app.get(
    '/questions/:id/resolutions',
    { schema: { params: idParamSchema, response: { 200: resolutionListResponseSchema } } },
    async (req) => {
      const user = await getOptionalUser(req);
      if (!(await questionAccessible(req.params.id, isReviewer(user)))) {
        throw app.httpErrors.notFound('Questão não encontrada.');
      }
      return listResolutions(req.params.id, user?.id ?? null);
    },
  );

  app.post(
    '/questions/:id/resolutions',
    {
      ...auth,
      config: env.RATE_LIMIT_ENABLED ? { rateLimit: { max: 5, timeWindow: '1 hour' } } : {},
      schema: {
        params: idParamSchema,
        body: resolutionBodySchema,
        response: { 201: resolutionSchema },
      },
    },
    async (req, reply) => {
      const u = req.sessionUser!;
      if (features.emailVerification && !u.emailVerified) {
        throw new AppError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Verifique seu e-mail para escrever resoluções.',
        );
      }
      if (!(await questionAccessible(req.params.id, isReviewer(u)))) {
        throw app.httpErrors.notFound('Questão não encontrada.');
      }
      const r = await createResolution(u.id, req.params.id, req.body.body);
      if (!r.ok) {
        if (r.code === 'DUPLICATE') {
          throw app.httpErrors.conflict(
            'Você já escreveu uma resolução para esta questão. Edite a existente.',
          );
        }
        throw app.httpErrors.badRequest(EMPTY_MSG);
      }
      return reply.status(201).send(r.resolution);
    },
  );

  app.put(
    '/resolutions/:id',
    {
      ...auth,
      schema: {
        params: idParamSchema,
        body: resolutionBodySchema,
        response: { 200: resolutionSchema },
      },
    },
    async (req) => {
      const r = await updateResolution(req.sessionUser!.id, req.params.id, req.body.body);
      if (!r.ok) {
        if (r.code === 'EMPTY') throw app.httpErrors.badRequest(EMPTY_MSG);
        throw app.httpErrors.notFound('Resolução não encontrada.');
      }
      return r.resolution;
    },
  );

  app.delete(
    '/resolutions/:id',
    {
      ...auth,
      schema: { params: idParamSchema, response: { 200: z.object({ ok: z.literal(true) }) } },
    },
    async (req) => {
      if (!(await deleteResolution(req.sessionUser!.id, req.params.id))) {
        throw app.httpErrors.notFound('Resolução não encontrada.');
      }
      return { ok: true as const };
    },
  );

  app.post(
    '/resolutions/:id/vote',
    {
      ...auth,
      config: env.RATE_LIMIT_ENABLED ? { rateLimit: { max: 60, timeWindow: '1 minute' } } : {},
      schema: {
        params: idParamSchema,
        body: voteResolutionSchema,
        response: { 200: voteResolutionResponseSchema },
      },
    },
    async (req) => {
      const r = await voteResolution(req.sessionUser!.id, req.params.id, req.body.value);
      if (!r.ok) {
        if (r.code === 'OWN')
          throw app.httpErrors.forbidden('Você não pode votar na sua resolução.');
        throw app.httpErrors.notFound('Resolução não encontrada.');
      }
      return r.vote;
    },
  );

  app.get(
    '/me/resolutions',
    { ...auth, schema: { response: { 200: myResolutionsSchema } } },
    async (req) => myResolutions(req.sessionUser!.id),
  );

  const guard = app.requireRole('reviewer', 'admin');

  app.get(
    '/review/resolutions',
    {
      preHandler: guard,
      schema: {
        querystring: resolutionReviewQuerySchema,
        response: { 200: resolutionReviewListSchema },
      },
    },
    async (req) => listForModeration(req.query.status, req.query.limit),
  );

  app.patch(
    '/review/resolutions/:id',
    {
      preHandler: guard,
      schema: {
        params: idParamSchema,
        body: resolutionModerationSchema,
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (req) => {
      const r = await moderateResolution(req.params.id, req.sessionUser!.id, req.body);
      if (!r.ok) {
        if (r.code === 'NOT_APPROVED') {
          throw app.httpErrors.conflict('Só resoluções aprovadas podem se tornar oficiais.');
        }
        throw app.httpErrors.notFound('Resolução não encontrada.');
      }
      return { ok: true as const };
    },
  );
};

export default routes;

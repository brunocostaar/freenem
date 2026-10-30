import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  essayDraftSchema,
  essayDraftUpdateSchema,
  essayListSchema,
  essayQuotaSchema,
  essayResultSchema,
  essayThemeListSchema,
  idParamSchema,
} from '@freenem/shared';
import { env, features } from '../../env.js';
import { AppError } from '../../lib/app-error.js';
import {
  correctEssay,
  createDraft,
  getEssay,
  getQuota,
  listEssays,
  listThemes,
  updateDraft,
} from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  const auth = { preHandler: app.authenticate };

  app.get(
    '/essays/themes',
    { ...auth, schema: { response: { 200: essayThemeListSchema } } },
    async () => ({ items: await listThemes() }),
  );

  app.get(
    '/essays/quota',
    { ...auth, schema: { response: { 200: essayQuotaSchema } } },
    async (req) => getQuota(req.sessionUser!),
  );

  app.get('/essays', { ...auth, schema: { response: { 200: essayListSchema } } }, async (req) => ({
    items: await listEssays(req.sessionUser!.id),
  }));

  app.post(
    '/essays',
    { ...auth, schema: { body: essayDraftSchema, response: { 201: essayResultSchema } } },
    async (req, reply) => {
      const res = await createDraft(req.sessionUser!.id, req.body);
      return reply.status(201).send(res);
    },
  );

  app.put(
    '/essays/:id',
    {
      ...auth,
      schema: {
        params: idParamSchema,
        body: essayDraftUpdateSchema,
        response: { 200: essayResultSchema },
      },
    },
    async (req) => updateDraft(req.sessionUser!.id, req.params.id, req.body.text),
  );

  app.get(
    '/essays/:id',
    { ...auth, schema: { params: idParamSchema, response: { 200: essayResultSchema } } },
    async (req) => getEssay(req.sessionUser!.id, req.params.id),
  );

  app.post(
    '/essays/:id/correct',
    {
      ...auth,
      // Limite por IP além do limite diário por usuário.
      config: env.RATE_LIMIT_ENABLED ? { rateLimit: { max: 10, timeWindow: '1 minute' } } : {},
      schema: { params: idParamSchema, response: { 200: essayResultSchema } },
    },
    async (req) => {
      if (features.emailVerification && !req.sessionUser!.emailVerified) {
        throw new AppError(
          403,
          'EMAIL_NOT_VERIFIED',
          'Verifique seu e-mail para enviar redações para correção.',
        );
      }
      return correctEssay(req.sessionUser!, req.params.id);
    },
  );
};

export default routes;

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { dataExportSchema, deleteAccountSchema, meResponseSchema } from '@freenem/shared';
import { env } from '../../env.js';
import { buildDataExport } from './export.js';
import { deleteAccount, toMe } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    { preHandler: app.authenticate, schema: { response: { 200: meResponseSchema } } },
    async (req) => toMe(req.sessionUser!),
  );

  /** Portabilidade (LGPD): todos os dados do próprio usuário em JSON, como download. */
  app.get(
    '/me/export',
    {
      preHandler: app.authenticate,
      config: env.RATE_LIMIT_ENABLED ? { rateLimit: { max: 5, timeWindow: '1 hour' } } : {},
      schema: { response: { 200: dataExportSchema } },
    },
    async (req, reply) => {
      reply.header('content-disposition', 'attachment; filename="freenem-dados.json"');
      reply.header('cache-control', 'no-store');
      return buildDataExport(req.sessionUser!.id);
    },
  );

  /** Exclusão da conta (LGPD): apaga o usuário e, em cascata, respostas, redações, planos e sessões. */
  app.delete(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        body: deleteAccountSchema,
        response: { 200: z.object({ deleted: z.literal(true) }) },
      },
    },
    async (req, reply) => {
      await deleteAccount(req.sessionUser!.id);
      // encerra o cookie de sessão no navegador
      reply.header('set-cookie', [
        'better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
        '__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None',
      ]);
      return { deleted: true as const };
    },
  );
};

export default routes;

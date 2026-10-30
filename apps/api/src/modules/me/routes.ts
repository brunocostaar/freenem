import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { deleteAccountSchema, meResponseSchema } from '@freenem/shared';
import { deleteAccount, toMe } from './service.js';

const routes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    { preHandler: app.authenticate, schema: { response: { 200: meResponseSchema } } },
    async (req) => toMe(req.sessionUser!),
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

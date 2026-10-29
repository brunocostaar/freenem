import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { fromNodeHeaders } from 'better-auth/node';
import type { Role } from '@freenem/shared';
import { auth } from '../auth.js';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido por `app.authenticate` / `app.requireRole`. */
    sessionUser: SessionUser | null;
  }
  interface FastifyInstance {
    /** preHandler: exige sessão válida (401). */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler factory: exige sessão + um dos papéis (401/403). */
    requireRole: (...roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(
  async (app) => {
    app.decorateRequest('sessionUser', null);

    const authenticate = async (req: FastifyRequest, _reply: FastifyReply) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) throw app.httpErrors.unauthorized('Faça login para continuar.');
      const u = session.user as unknown as SessionUser;
      req.sessionUser = { ...u, role: (u.role ?? 'student') as Role };
    };

    app.decorate('authenticate', authenticate);
    app.decorate('requireRole', (...roles: Role[]) => async (req, reply) => {
      await authenticate(req, reply);
      if (!req.sessionUser || !roles.includes(req.sessionUser.role)) {
        throw app.httpErrors.forbidden('Você não tem permissão para esta ação.');
      }
    });
  },
  { name: 'auth-decorators' },
);

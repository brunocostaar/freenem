import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Role } from '@freenem/shared';
import { auth } from '../../auth.js';
import type { SessionUser } from '../../plugins/auth.js';

/** Resolve o usuário da sessão se houver (sem lançar 401). */
export async function getOptionalUser(req: FastifyRequest): Promise<SessionUser | null> {
  if (!req.headers.cookie && !req.headers.authorization) return null;
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return null;
  const u = session.user as unknown as SessionUser;
  return { ...u, role: (u.role ?? 'student') as Role };
}

export function isReviewer(u: SessionUser | null): boolean {
  return u?.role === 'reviewer' || u?.role === 'admin';
}

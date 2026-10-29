import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { db, schema } from '../src/db/index.js';

export const TEST_ORIGIN = 'http://localhost:5173';

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** valor pronto para o header `cookie` */
  cookie: string;
}

/**
 * Cria um usuário (via /api/auth/sign-up/email) e devolve o cookie de sessão.
 * Use `role` para promover o usuário direto no banco (ex.: 'admin', 'reviewer').
 */
export async function createAuthedUser(
  app: FastifyInstance,
  opts: { role?: 'student' | 'reviewer' | 'admin'; emailVerified?: boolean } = {},
): Promise<TestUser> {
  const email = `user-${randomUUID()}@test.freenem.local`;
  const password = 'senha-de-teste-123';
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: TEST_ORIGIN, 'content-type': 'application/json' },
    payload: { name: 'Usuário de Teste', email, password },
  });
  if (res.statusCode !== 200) throw new Error(`sign-up falhou: ${res.statusCode} ${res.body}`);
  const body = res.json() as { user: { id: string } };
  const setCookie = res.headers['set-cookie'];
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = list.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('sign-up não devolveu cookie de sessão');

  if (opts.role || opts.emailVerified !== undefined) {
    await db
      .update(schema.user)
      .set({
        ...(opts.role ? { role: opts.role } : {}),
        ...(opts.emailVerified !== undefined ? { emailVerified: opts.emailVerified } : {}),
      })
      .where(eq(schema.user.id, body.user.id));
  }
  return { id: body.user.id, email, password, cookie };
}

/** Remove um usuário de teste (cascata limpa dados relacionados). */
export async function deleteUser(id: string) {
  await db.delete(schema.user).where(eq(schema.user.id, id));
}

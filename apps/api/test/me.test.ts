import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

describe('GET /api/v1/me', () => {
  let app: FastifyInstance;
  let user: TestUser;
  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
  });
  afterAll(async () => {
    await deleteUser(user.id);
    await app.close();
  });

  it('401 sem sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('200 com sessão', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: user.id, email: user.email, role: 'student' });
  });

  it('requireRole bloqueia aluno em rota de admin', async () => {
    const guarded = await buildApp();
    guarded.get('/_admin', { preHandler: guarded.requireRole('admin') }, async () => ({
      ok: true,
    }));
    await guarded.ready();
    const res = await guarded.inject({
      method: 'GET',
      url: '/_admin',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(403);
    await guarded.close();
  });
});

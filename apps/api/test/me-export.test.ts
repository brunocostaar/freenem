import { randomUUID } from 'node:crypto';
import { eq as sqlEq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

describe('GET /api/v1/me/export', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let other: TestUser;
  let questionId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    other = await createAuthedUser(app);
    const tag = randomUUID().slice(0, 8);
    const [q] = await db
      .insert(schema.questions)
      .values({ statement: `Export ${tag}`, status: 'published', externalId: `exp-${tag}` })
      .returning();
    questionId = q!.id;
    await db.insert(schema.answers).values([
      { userId: user.id, questionId, chosenLetter: 'A', isCorrect: true },
      { userId: other.id, questionId, chosenLetter: 'B', isCorrect: false },
    ]);
    await db
      .insert(schema.questionReports)
      .values({ userId: user.id, questionId, kind: 'outro', message: 'meu reporte' });
  });
  afterAll(async () => {
    await deleteUser(user.id);
    await deleteUser(other.id);
    await db.delete(schema.questions).where(eqId(questionId));
    await app.close();
  });

  function eqId(id: string) {
    return sqlEq(schema.questions.id, id);
  }

  it('exige login', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me/export' });
    expect(res.statusCode).toBe(401);
  });

  it('devolve só os dados do próprio usuário, como download, sem campos sensíveis', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me/export',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="freenem-dados.json"');
    const body = res.json();
    expect(body.profile).toMatchObject({ id: user.id, email: user.email });
    expect(body.profile.loginProviders).toContain('credential');
    expect(body.answers).toHaveLength(1);
    expect(body.answers[0]).toMatchObject({ chosenLetter: 'A', isCorrect: true });
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0].message).toBe('meu reporte');

    const raw = res.body;
    expect(raw).not.toContain(other.id);
    expect(raw).not.toContain(other.email);
    for (const forbidden of [
      '"password"',
      '"token"',
      '"accessToken"',
      '"refreshToken"',
      '"idToken"',
    ]) {
      expect(raw).not.toContain(forbidden);
    }
    expect(raw).not.toContain(user.cookie.split('=')[1]!.split('.')[0]!);
  });
});

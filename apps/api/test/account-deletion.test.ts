import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, type TestUser } from './helpers.js';

describe('DELETE /api/v1/me', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let other: TestUser;
  let questionId: string;
  let themeId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    other = await createAuthedUser(app);
    const tag = randomUUID().slice(0, 8);
    const [q] = await db
      .insert(schema.questions)
      .values({ statement: `Exclusão ${tag}`, status: 'published', externalId: `del-${tag}` })
      .returning();
    questionId = q!.id;
    const [theme] = await db
      .insert(schema.essayThemes)
      .values({ title: `Tema ${tag}`, year: 2999 })
      .returning();
    themeId = theme!.id;
  });

  afterAll(async () => {
    await db.delete(schema.user).where(eq(schema.user.id, other.id));
    await db.delete(schema.questions).where(eq(schema.questions.id, questionId));
    await db.delete(schema.essayThemes).where(eq(schema.essayThemes.id, themeId));
    await app.close();
  });

  it('401 sem sessão e 400 sem a confirmação', async () => {
    const anon = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me',
      payload: { confirmation: 'EXCLUIR' },
    });
    expect(anon.statusCode).toBe(401);
    const wrong = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me',
      headers: { cookie: user.cookie },
      payload: { confirmation: 'sim' },
    });
    expect(wrong.statusCode).toBe(400);
  });

  it('apaga o usuário e todos os dados relacionados, preservando os de outros', async () => {
    for (const u of [user, other]) {
      await db.insert(schema.answers).values({
        userId: u.id,
        questionId,
        chosenLetter: 'A',
        isCorrect: false,
      });
      await db.insert(schema.savedQuestions).values({ userId: u.id, questionId });
      await db.insert(schema.essays).values({ userId: u.id, themeId, text: 'Minha redação' });
      await db.insert(schema.questionReports).values({ userId: u.id, questionId, kind: 'outro' });
      await db.insert(schema.studyPlans).values({
        userId: u.id,
        examDate: '2999-11-01',
        hoursPerWeek: 5,
        availableDays: [1, 2],
      });
    }

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/me',
      headers: { cookie: user.cookie },
      payload: { confirmation: 'EXCLUIR' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });

    const count = async (
      table: 'answers' | 'savedQuestions' | 'essays' | 'questionReports' | 'studyPlans',
      id: string,
    ) => (await db.select().from(schema[table]).where(eq(schema[table].userId, id))).length;

    for (const t of [
      'answers',
      'savedQuestions',
      'essays',
      'questionReports',
      'studyPlans',
    ] as const) {
      expect(await count(t, user.id), t).toBe(0);
      expect(await count(t, other.id), `${t} (outro usuário)`).toBe(1);
    }
    expect(await db.select().from(schema.user).where(eq(schema.user.id, user.id))).toHaveLength(0);
    expect(
      await db.select().from(schema.session).where(eq(schema.session.userId, user.id)),
    ).toHaveLength(0);

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: user.cookie },
    });
    expect(me.statusCode).toBe(401);
  });
});

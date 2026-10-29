import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { statsOverviewSchema, statsTopicsResponseSchema } from '@freenem/shared';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

const DAY = 86_400_000;

describe('stats', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let fresh: TestUser;
  let subjectId: string;
  let topicA: string;
  let topicB: string;
  let topicC: string;
  const questionIds: string[] = [];
  let themeId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    fresh = await createAuthedUser(app);
    const tag = randomUUID().slice(0, 8);

    const [subject] = await db
      .insert(schema.subjects)
      .values({ slug: `stats-${tag}`, name: 'Matemática Teste', area: 'matematica' })
      .returning();
    subjectId = subject!.id;
    const ts = await db
      .insert(schema.topics)
      .values([
        { subjectId, slug: 'a', name: 'Tópico A (fraco)', position: 1 },
        { subjectId, slug: 'b', name: 'Tópico B (forte)', position: 2 },
        { subjectId, slug: 'c', name: 'Tópico C (sem respostas)', position: 3 },
      ])
      .returning();
    [topicA, topicB, topicC] = ts.map((t) => t.id) as [string, string, string];

    const qs = await db
      .insert(schema.questions)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          subjectId,
          statement: `Questão de teste ${i}`,
          status: 'published' as const,
        })),
      )
      .returning({ id: schema.questions.id });
    questionIds.push(...qs.map((q) => q.id));
    await db.insert(schema.questionTopics).values([
      { questionId: questionIds[0]!, topicId: topicA },
      { questionId: questionIds[1]!, topicId: topicA },
      { questionId: questionIds[2]!, topicId: topicB },
      { questionId: questionIds[3]!, topicId: topicC },
    ]);

    const now = Date.now();
    const mk = (q: number, correct: boolean, at: number, extra: object = {}) => ({
      userId: user.id,
      questionId: questionIds[q]!,
      isCorrect: correct,
      chosenLetter: 'A' as const,
      timeSpentMs: 60_000,
      answeredAt: new Date(at),
      ...extra,
    });

    // simulado finalizado com 2 respostas (conta nas estatísticas)
    const [simulado] = await db
      .insert(schema.simulados)
      .values({ userId: user.id, title: 'Simulado teste', mode: 'custom', questionCount: 2 })
      .returning();
    const [attempt] = await db
      .insert(schema.simuladoAttempts)
      .values({
        simuladoId: simulado!.id,
        userId: user.id,
        status: 'finished',
        finishedAt: new Date(now),
        rawScore: 1,
        triScore: 612.5,
      })
      .returning();

    await db.insert(schema.answers).values([
      // tópico A: 8 respostas, 2 certas (hoje e ontem)
      ...Array.from({ length: 6 }, () => mk(0, false, now - 1000)),
      mk(1, true, now - 2000),
      mk(1, true, now - DAY),
      // tópico B: 6 respostas certas, sendo 2 em simulado
      ...Array.from({ length: 4 }, () => mk(2, true, now - DAY - 5000)),
      mk(2, true, now, { simuladoAttemptId: attempt!.id }),
      mk(2, true, now, { simuladoAttemptId: attempt!.id }),
      // resposta antiga (fora de 30d), 200 dias atrás
      mk(3, true, now - 200 * DAY),
    ]);

    const [theme] = await db
      .insert(schema.essayThemes)
      .values({ title: `Tema teste ${tag}` })
      .returning();
    themeId = theme!.id;
    for (const [i, score] of [600, 800].entries()) {
      const [essay] = await db
        .insert(schema.essays)
        .values({
          userId: user.id,
          themeId,
          text: 'texto',
          status: 'corrected',
          createdAt: new Date(now - (2 - i) * DAY),
        })
        .returning();
      await db.insert(schema.essayCorrections).values({
        essayId: essay!.id,
        userId: user.id,
        correctionDate: new Date(now - (2 - i) * DAY).toISOString().slice(0, 10),
        totalScore: score,
      });
    }
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await deleteUser(fresh.id);
    await db.delete(schema.questions).where(inArray(schema.questions.id, questionIds));
    await db.delete(schema.subjects).where(eq(schema.subjects.id, subjectId));
    await db.delete(schema.essayThemes).where(eq(schema.essayThemes.id, themeId));
    await app.close();
  });

  const get = (url: string, u: TestUser) =>
    app.inject({ method: 'GET', url, headers: { cookie: u.cookie } });

  it('exige autenticação', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/stats/overview' })).statusCode).toBe(
      401,
    );
    expect((await app.inject({ method: 'GET', url: '/api/v1/stats/topics' })).statusCode).toBe(401);
  });

  it('usuário novo recebe zeros', async () => {
    const res = await get('/api/v1/stats/overview', fresh);
    expect(res.statusCode).toBe(200);
    const body = statsOverviewSchema.parse(res.json());
    expect(body).toMatchObject({
      totalAnswers: 0,
      accuracy: 0,
      streakDays: 0,
      lifetimeAnswers: 0,
      essayAverage: null,
    });
    expect(body.byArea).toEqual([]);
    expect(body.weakTopics).toEqual([]);
  });

  it('agrega totais, sequência, áreas e inclui respostas de simulado', async () => {
    const res = await get('/api/v1/stats/overview?range=30d', user);
    expect(res.statusCode).toBe(200);
    const body = statsOverviewSchema.parse(res.json());
    expect(body.totalAnswers).toBe(14);
    expect(body.correctAnswers).toBe(2 + 6);
    expect(body.accuracy).toBeCloseTo(8 / 14);
    expect(body.timeStudiedMs).toBe(14 * 60_000);
    expect(body.lifetimeAnswers).toBe(15);
    expect(body.streakDays).toBeGreaterThanOrEqual(2);
    expect(body.activity.length).toBeGreaterThanOrEqual(2);
    expect(body.activity.some((d) => d.total >= 1)).toBe(true);
    expect(body.byArea).toEqual([{ area: 'matematica', total: 14, correct: 8, accuracy: 8 / 14 }]);
    expect(body.bySubject).toHaveLength(1);
    expect(body.bySubject[0]).toMatchObject({ subjectId, total: 14 });
  });

  it('respeita o intervalo', async () => {
    const all = statsOverviewSchema.parse(
      (await get('/api/v1/stats/overview?range=all', user)).json(),
    );
    expect(all.totalAnswers).toBe(15);
    const w = statsOverviewSchema.parse(
      (await get('/api/v1/stats/overview?range=7d', user)).json(),
    );
    expect(w.totalAnswers).toBe(14);
    expect((await get('/api/v1/stats/overview?range=1y', user)).statusCode).toBe(400);
  });

  it('ranqueia pontos fracos e fortes com amostra mínima', async () => {
    const body = statsOverviewSchema.parse((await get('/api/v1/stats/overview', user)).json());
    expect(body.weakTopics[0]?.topicId).toBe(topicA);
    expect(body.bestTopics[0]?.topicId).toBe(topicB);
    // C (1 resposta antiga, fora do intervalo) nunca entra por falta de amostra
    expect(body.weakTopics.map((t) => t.topicId)).not.toContain(topicC);
  });

  it('traz simulados e redações', async () => {
    const body = statsOverviewSchema.parse((await get('/api/v1/stats/overview', user)).json());
    expect(body.recentSimulados).toHaveLength(1);
    expect(body.recentSimulados[0]).toMatchObject({ triScore: 612.5, rawScore: 1 });
    expect(body.essays.map((e) => e.totalScore)).toEqual([600, 800]);
    expect(body.essayAverage).toBe(700);
  });

  it('lista tópicos de uma matéria, incluindo os sem respostas', async () => {
    const res = await get(`/api/v1/stats/topics?subjectId=${subjectId}`, user);
    expect(res.statusCode).toBe(200);
    const { topics } = statsTopicsResponseSchema.parse(res.json());
    expect(topics.map((t) => t.topicId)).toEqual([topicA, topicB, topicC]);
    expect(topics[0]).toMatchObject({ total: 8, correct: 2 });
    expect(topics[1]).toMatchObject({ total: 6, correct: 6 });
    expect(topics[2]).toMatchObject({ total: 1, correct: 1 }); // range padrão = all
    const empty = statsTopicsResponseSchema.parse(
      (await get(`/api/v1/stats/topics?subjectId=${subjectId}`, fresh)).json(),
    );
    expect(empty.topics.map((t) => t.total)).toEqual([0, 0, 0]);
  });
});

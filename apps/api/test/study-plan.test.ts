import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { studyPlanResponseSchema, type StudyPlan } from '@freenem/shared';
import { db, schema } from '../src/db/index.js';
import { addDays } from '../src/modules/study-plan/generator.js';
import { saoPauloDate } from '../src/modules/stats/dates.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

describe('study-plan', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let other: TestUser;
  let subjectId: string;
  const topicIds: string[] = [];
  const questionIds: string[] = [];
  const examDate = addDays(saoPauloDate(), 70); // 10 semanas

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, u: TestUser, payload?: object) =>
    app.inject({ method, url: `/api/v1${url}`, headers: { cookie: u.cookie }, payload });
  const plan = (res: { json: () => unknown }): StudyPlan => {
    const p = studyPlanResponseSchema.parse(res.json()).plan;
    if (!p) throw new Error('sem plano');
    return p;
  };
  const body = { examDate, hoursPerWeek: 8, availableDays: [1, 3, 5] };

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    other = await createAuthedUser(app);
    const [s] = await db
      .insert(schema.subjects)
      .values({ slug: `plan-${randomUUID().slice(0, 8)}`, name: 'Matéria Plano', area: 'natureza' })
      .returning();
    subjectId = s!.id;
    const ts = await db
      .insert(schema.topics)
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          subjectId,
          slug: `t${i}`,
          name: `Tópico ${i}`,
          position: i,
        })),
      )
      .returning();
    topicIds.push(...ts.map((t) => t.id));
    const qs = await db
      .insert(schema.questions)
      .values(
        topicIds.map((_, i) => ({
          subjectId,
          statement: `Q${i}`,
          status: 'published' as const,
        })),
      )
      .returning({ id: schema.questions.id });
    questionIds.push(...qs.map((q) => q.id));
    await db
      .insert(schema.questionTopics)
      .values(qs.map((q, i) => ({ questionId: q.id, topicId: topicIds[i]! })));
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await deleteUser(other.id);
    await db.delete(schema.questions).where(inArray(schema.questions.id, questionIds));
    await db.delete(schema.subjects).where(eq(schema.subjects.id, subjectId));
    await app.close();
  });

  it('exige autenticação', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/study-plan' });
    expect(res.statusCode).toBe(401);
  });

  it('sem plano devolve null', async () => {
    const res = await call('GET', '/study-plan', user);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ plan: null });
  });

  it('rejeita data da prova no passado e payload inválido', async () => {
    const past = await call('POST', '/study-plan', user, { ...body, examDate: '2020-01-01' });
    expect(past.statusCode).toBe(400);
    const bad = await call('POST', '/study-plan', user, { ...body, hoursPerWeek: 0 });
    expect(bad.statusCode).toBe(400);
  });

  it('cria o plano, com semanas, orçamento e links', async () => {
    const res = await call('POST', '/study-plan', user, body);
    expect(res.statusCode).toBe(200);
    const p = plan(res);
    expect(p.totalWeeks).toBe(10);
    expect(p.currentWeek).toBe(1);
    expect(p.daysUntilExam).toBe(70);
    expect(p.weeks).toHaveLength(10);
    expect(p.weeks[0]!.isCurrent).toBe(true);
    for (const w of p.weeks) {
      expect(w.plannedMinutes).toBeLessThanOrEqual(w.budgetMinutes);
      expect(w.items.some((i) => i.kind === 'essay')).toBe(true);
    }
    expect(p.weeks.some((w) => w.items.some((i) => i.kind === 'simulado'))).toBe(true);
    const item = p.weeks[0]!.items.find((i) => i.topicId);
    expect(item?.href).toBe(`/questoes?topicId=${item!.topicId}`);
    expect(p.weeks[0]!.items.find((i) => i.kind === 'essay')?.href).toBe('/redacao');
    expect(p.progress).toMatchObject({ done: 0 });
    expect(p.progress.total).toBeGreaterThan(10);
  });

  it('GET devolve o plano ativo e criar de novo substitui o anterior', async () => {
    const first = plan(await call('GET', '/study-plan', user));
    const second = plan(
      await call('POST', '/study-plan', user, {
        ...body,
        hoursPerWeek: 4,
        focusAreas: ['natureza'],
      }),
    );
    expect(second.id).not.toBe(first.id);
    expect(plan(await call('GET', '/study-plan', user)).id).toBe(second.id);
    const rows = await db
      .select()
      .from(schema.studyPlans)
      .where(eq(schema.studyPlans.userId, user.id));
    expect(rows).toHaveLength(1);
  });

  it('marca e desmarca itens, e atualiza o progresso', async () => {
    const p = plan(await call('GET', '/study-plan', user));
    const item = p.weeks[0]!.items.find((i) => !i.auto)!;
    const on = await call('PATCH', `/study-plan/items/${item.id}`, user, { done: true });
    expect(on.statusCode).toBe(200);
    expect(on.json()).toEqual({ id: item.id, done: true });
    expect(plan(await call('GET', '/study-plan', user)).progress.done).toBe(1);
    await call('PATCH', `/study-plan/items/${item.id}`, user, { done: false });
    expect(plan(await call('GET', '/study-plan', user)).progress.done).toBe(0);
  });

  it('não permite mexer em item de outro usuário nem inexistente', async () => {
    const p = plan(await call('GET', '/study-plan', user));
    const item = p.weeks[0]!.items.find((i) => !i.auto)!;
    const res = await call('PATCH', `/study-plan/items/${item.id}`, other, { done: true });
    expect(res.statusCode).toBe(404);
    const missing = await call('PATCH', `/study-plan/items/${randomUUID()}`, user, { done: true });
    expect(missing.statusCode).toBe(404);
  });

  it('rebalanceia mantendo os itens concluídos e reagindo ao desempenho', async () => {
    const before = plan(await call('GET', '/study-plan', user));
    const doneItem = before.weeks[0]!.items.find((i) => !i.auto)!;
    await call('PATCH', `/study-plan/items/${doneItem.id}`, user, { done: true });

    // o aluno erra bastante o último tópico: ele deve subir na fila
    const last = topicIds[5]!;
    await db.insert(schema.answers).values(
      Array.from({ length: 10 }, () => ({
        userId: user.id,
        questionId: questionIds[5]!,
        isCorrect: false,
        chosenLetter: 'A' as const,
      })),
    );

    const res = await call('POST', '/study-plan/rebalance', user, {});
    expect(res.statusCode).toBe(200);
    const after = plan(res);
    const kept = after.weeks[0]!.items.find((i) => i.id === doneItem.id);
    expect(kept?.done).toBe(true);
    expect(after.progress.done).toBeGreaterThanOrEqual(1);
    const firstWeekTopics = after.weeks[0]!.items.filter((i) => i.topicId).map((i) => i.topicId);
    expect(firstWeekTopics).toContain(last);
    for (const w of after.weeks) expect(w.plannedMinutes).toBeLessThanOrEqual(w.budgetMinutes);
  });

  it('rebalance sem plano é 404', async () => {
    const res = await call('POST', '/study-plan/rebalance', other, {});
    expect(res.statusCode).toBe(404);
  });
});

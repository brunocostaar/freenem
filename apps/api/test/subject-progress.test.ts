import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { subjectProgressResponseSchema } from '@freenem/shared';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

describe('progresso por matéria', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let subjectId: string;
  let emptySubjectId: string;
  const questionIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    const tag = randomUUID().slice(0, 8);
    const [s] = await db
      .insert(schema.subjects)
      .values({ slug: `prog-${tag}`, name: 'Progresso Teste', area: 'natureza', position: 999 })
      .returning();
    subjectId = s!.id;
    const [empty] = await db
      .insert(schema.subjects)
      .values({ slug: `prog-vazia-${tag}`, name: 'Sem questões', area: 'natureza', position: 1000 })
      .returning();
    emptySubjectId = empty!.id;
    const qs = await db
      .insert(schema.questions)
      .values(
        Array.from({ length: 3 }, (_, i) => ({
          subjectId,
          statement: `Progresso ${i}`,
          status: 'published' as const,
        })),
      )
      .returning({ id: schema.questions.id });
    questionIds.push(...qs.map((q) => q.id));
    await db.insert(schema.answers).values([
      { userId: user.id, questionId: questionIds[0]!, isCorrect: true, chosenLetter: 'A' },
      // repetida: conta uma vez só
      { userId: user.id, questionId: questionIds[0]!, isCorrect: true, chosenLetter: 'A' },
      { userId: user.id, questionId: questionIds[1]!, isCorrect: false, chosenLetter: 'B' },
    ]);
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await db.delete(schema.questions).where(inArray(schema.questions.id, questionIds));
    await db
      .delete(schema.subjects)
      .where(inArray(schema.subjects.id, [subjectId, emptySubjectId]));
    await app.close();
  });

  const find = (body: unknown, id: string) =>
    subjectProgressResponseSchema.parse(body).subjects.find((s) => s.subjectId === id);

  it('conta questões distintas respondidas e acertadas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/questions/progress',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(find(res.json(), subjectId)).toMatchObject({ total: 3, answered: 2, correct: 1 });
    expect(find(res.json(), emptySubjectId)).toBeUndefined();
  });

  it('anônimo vê totais com progresso zerado', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/questions/progress' });
    expect(res.statusCode).toBe(200);
    expect(find(res.json(), subjectId)).toMatchObject({ total: 3, answered: 0, correct: 0 });
  });
});

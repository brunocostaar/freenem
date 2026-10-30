import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { reportListResponseSchema } from '@freenem/shared';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

describe('reportes de questões', () => {
  let app: FastifyInstance;
  let reviewer: TestUser;
  let students: TestUser[];
  let questionId: string;
  let otherQuestionId: string;

  beforeAll(async () => {
    app = await buildTestApp();
    reviewer = await createAuthedUser(app, { role: 'reviewer' });
    students = [
      await createAuthedUser(app),
      await createAuthedUser(app),
      await createAuthedUser(app),
    ];
    const tag = randomUUID().slice(0, 8);
    const rows = await db
      .insert(schema.questions)
      .values([
        { statement: `Reporte ${tag} A`, status: 'published', externalId: `rep-${tag}-a` },
        { statement: `Reporte ${tag} B`, status: 'published', externalId: `rep-${tag}-b` },
      ])
      .returning();
    questionId = rows[0]!.id;
    otherQuestionId = rows[1]!.id;
  });

  afterAll(async () => {
    await db.delete(schema.questions).where(eq(schema.questions.id, questionId));
    await db.delete(schema.questions).where(eq(schema.questions.id, otherQuestionId));
    for (const u of [reviewer, ...students]) await deleteUser(u.id);
    await app.close();
  });

  const post = (u: TestUser, id: string, body: unknown) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/questions/${id}/reports`,
      headers: { cookie: u.cookie },
      payload: body as object,
    });

  it('exige login e valida o corpo', async () => {
    const anon = await app.inject({
      method: 'POST',
      url: `/api/v1/questions/${questionId}/reports`,
      payload: { kind: 'outro' },
    });
    expect(anon.statusCode).toBe(401);
    const bad = await post(students[0]!, questionId, { kind: 'xyz' });
    expect(bad.statusCode).toBe(400);
    const long = await post(students[0]!, questionId, { kind: 'outro', message: 'a'.repeat(1001) });
    expect(long.statusCode).toBe(400);
    const missing = await post(students[0]!, randomUUID(), { kind: 'outro' });
    expect(missing.statusCode).toBe(404);
  });

  it('aceita um reporte aberto por aluno e questão', async () => {
    const ok = await post(students[0]!, otherQuestionId, { kind: 'imagem_quebrada', message: 'x' });
    expect(ok.statusCode).toBe(201);
    const dup = await post(students[0]!, otherQuestionId, { kind: 'outro' });
    expect(dup.statusCode).toBe(409);
  });

  it('aluno não acessa a fila; revisor lista agrupado e resolve', async () => {
    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/review/reports',
      headers: { cookie: students[0]!.cookie },
    });
    expect(forbidden.statusCode).toBe(403);

    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/review/reports?status=open',
      headers: { cookie: reviewer.cookie },
    });
    expect(list.statusCode).toBe(200);
    const parsed = reportListResponseSchema.parse(list.json());
    const group = parsed.groups.find((g) => g.question.id === otherQuestionId);
    expect(group?.openCount).toBe(1);
    const reportId = group!.reports[0]!.id;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/review/reports/${reportId}`,
      headers: { cookie: reviewer.cookie },
      payload: { status: 'resolved' },
    });
    expect(patch.statusCode).toBe(200);
    const [row] = await db
      .select()
      .from(schema.questionReports)
      .where(eq(schema.questionReports.id, reportId));
    expect(row?.status).toBe('resolved');
    expect(row?.resolvedBy).toBe(reviewer.id);

    // depois de resolvido o aluno pode reportar de novo
    const again = await post(students[0]!, otherQuestionId, { kind: 'outro' });
    expect(again.statusCode).toBe(201);
  });

  it('3 reportes graves abertos movem a questão para rascunho', async () => {
    await post(students[0]!, questionId, { kind: 'gabarito_errado' });
    await post(students[1]!, questionId, { kind: 'enunciado_incompleto' });
    const [mid] = await db
      .select({ status: schema.questions.status })
      .from(schema.questions)
      .where(eq(schema.questions.id, questionId));
    expect(mid?.status).toBe('published');
    await post(students[2]!, questionId, { kind: 'gabarito_errado' });
    const [after] = await db
      .select({ status: schema.questions.status })
      .from(schema.questions)
      .where(eq(schema.questions.id, questionId));
    expect(after?.status).toBe('draft');
  });

  it('reportes de outros tipos não escondem a questão', async () => {
    const tag = randomUUID().slice(0, 8);
    const [q] = await db
      .insert(schema.questions)
      .values({ statement: `Sem hide ${tag}`, status: 'published', externalId: `rep-${tag}` })
      .returning();
    for (const s of students) await post(s, q!.id, { kind: 'classificacao_errada' });
    const [after] = await db
      .select({ status: schema.questions.status })
      .from(schema.questions)
      .where(eq(schema.questions.id, q!.id));
    expect(after?.status).toBe('published');
    await db.delete(schema.questions).where(eq(schema.questions.id, q!.id));
  });
});

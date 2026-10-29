import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

/** ENEM Dia 1 repete os números 1–5 em Inglês e Espanhol: o simulado deve ter só uma língua. */
describe('simulado oficial: língua estrangeira', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let examId: string;
  let institutionId: string;
  let createdInstitution = false;
  const questionIds: string[] = [];
  const year = 3000 + Math.floor(Math.random() * 6000);

  const create = (payload: object) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/simulados',
      headers: { cookie: user.cookie },
      payload,
    });

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    const [existing] = await db
      .select()
      .from(schema.institutions)
      .where(eq(schema.institutions.slug, 'enem'));
    if (existing) institutionId = existing.id;
    else {
      const [i] = await db
        .insert(schema.institutions)
        .values({ slug: 'enem', name: 'ENEM' })
        .onConflictDoNothing()
        .returning();
      createdInstitution = !!i;
      institutionId = i!.id;
    }
    await db
      .insert(schema.subjects)
      .values([
        { slug: 'ingles', name: 'Inglês', area: 'linguagens' },
        { slug: 'espanhol', name: 'Espanhol', area: 'linguagens' },
        { slug: 'matematica', name: 'Matemática', area: 'matematica' },
      ])
      .onConflictDoNothing();
    const subs = await db.select().from(schema.subjects);
    const id = (slug: string) => subs.find((s) => s.slug === slug)!.id;
    const [exam] = await db
      .insert(schema.exams)
      .values({ institutionId, year, phase: 'Dia 1', label: `Lang ${year}`, color: 'azul' })
      .returning();
    examId = exam!.id;
    const rows = [
      ...[1, 2, 3, 4, 5].map((n) => ({ n, slug: 'ingles' })),
      ...[1, 2, 3, 4, 5].map((n) => ({ n, slug: 'espanhol' })),
      ...[6, 7].map((n) => ({ n, slug: 'matematica' })),
    ];
    for (const r of rows) {
      const [q] = await db
        .insert(schema.questions)
        .values({
          examId,
          subjectId: id(r.slug),
          number: r.n,
          statement: `Enunciado ${r.slug} ${r.n}`,
          status: 'published',
          externalId: `lang-${year}-${r.slug}-${r.n}`,
        })
        .returning();
      questionIds.push(q!.id);
    }
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await db.delete(schema.questions).where(inArray(schema.questions.id, questionIds));
    await db.delete(schema.exams).where(eq(schema.exams.id, examId));
    if (createdInstitution) {
      await db
        .delete(schema.institutions)
        .where(eq(schema.institutions.id, institutionId))
        .catch(() => {});
    }
    await app.close();
  });

  it('options expõe a contagem por língua', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/simulados/options',
      headers: { cookie: user.cookie },
    });
    const exam = res.json().exams.find((e: { id: string }) => e.id === examId);
    expect(exam.languageCounts).toEqual({ ingles: 5, espanhol: 5 });
  });

  it('padrão é inglês: sem números duplicados', async () => {
    const res = await create({ mode: 'official', examId });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ questionCount: 7, filters: { language: 'ingles' } });
  });

  it('espanhol exclui o inglês; área linguagens só tem a língua escolhida', async () => {
    const full = await create({ mode: 'official', examId, language: 'espanhol' });
    expect(full.json().questionCount).toBe(7);
    const ling = await create({
      mode: 'official',
      examId,
      area: 'linguagens',
      language: 'espanhol',
    });
    expect(ling.json().questionCount).toBe(5);
  });
});

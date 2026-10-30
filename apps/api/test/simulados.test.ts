import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

describe('simulados', () => {
  let app: FastifyInstance;
  let user: TestUser;
  let other: TestUser;
  const tag = randomUUID().slice(0, 8);
  let createdInstitution = false;
  let institutionId: string;
  let examId: string;
  let mathId: string;
  let natId: string;
  const subjectIds: string[] = [];
  const questionIds: string[] = [];
  /** letra correta por questão */
  const correct = new Map<string, string>();
  const year = 3000 + Math.floor(Math.random() * 6000);

  const headers = (u: TestUser) => ({ cookie: u.cookie });
  const call = (u: TestUser, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: headers(u),
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });

  beforeAll(async () => {
    app = await buildTestApp();
    user = await createAuthedUser(app);
    other = await createAuthedUser(app);

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
      institutionId =
        i?.id ??
        (
          await db.select().from(schema.institutions).where(eq(schema.institutions.slug, 'enem'))
        )[0]!.id;
    }
    const [exam] = await db
      .insert(schema.exams)
      .values({ institutionId, year, phase: '1º dia', label: `Teste ${tag}`, color: 'azul' })
      .returning();
    examId = exam!.id;

    const [math, nat] = await db
      .insert(schema.subjects)
      .values([
        { slug: `sim-math-${tag}`, name: `Matemática ${tag}`, area: 'matematica' },
        { slug: `sim-nat-${tag}`, name: `Física ${tag}`, area: 'natureza' },
      ])
      .returning();
    mathId = math!.id;
    natId = nat!.id;
    subjectIds.push(mathId, natId);

    // 6 de matemática com parâmetros TRI (dificuldade crescente) + 6 de natureza sem parâmetros
    for (let n = 1; n <= 12; n++) {
      const isMath = n <= 6;
      const [q] = await db
        .insert(schema.questions)
        .values({
          examId,
          subjectId: isMath ? mathId : natId,
          number: n,
          statement: `Enunciado ${n} ${tag}`,
          status: 'published',
          externalId: `sim-test-${tag}-${n}`,
          ...(isMath ? { irtA: 1.5, irtB: -1.5 + n * 0.5, irtC: 0.2 } : {}),
        })
        .returning();
      const right = LETTERS[n % 5]!;
      correct.set(q!.id, right);
      questionIds.push(q!.id);
      await db.insert(schema.alternatives).values(
        LETTERS.map((letter) => ({
          questionId: q!.id,
          letter,
          text: `Alternativa ${letter}`,
          isCorrect: letter === right,
        })),
      );
    }
  });

  afterAll(async () => {
    await deleteUser(user.id);
    await deleteUser(other.id);
    await db.delete(schema.questions).where(inArray(schema.questions.id, questionIds));
    await db.delete(schema.exams).where(eq(schema.exams.id, examId));
    await db.delete(schema.subjects).where(inArray(schema.subjects.id, subjectIds));
    if (createdInstitution) {
      await db
        .delete(schema.institutions)
        .where(eq(schema.institutions.id, institutionId))
        .catch(() => {});
    }
    await app.close();
  });

  it('exige autenticação', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/simulados' });
    expect(res.statusCode).toBe(401);
  });

  it('options lista a prova de teste com contagens por área', async () => {
    const res = await call(user, 'GET', '/simulados/options');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const exam = body.exams.find((e: { id: string }) => e.id === examId);
    expect(exam).toMatchObject({ questionCount: 12, officialMinutes: 330, year });
    expect(exam.areas).toEqual(
      expect.arrayContaining([
        { area: 'matematica', count: 6 },
        { area: 'natureza', count: 6 },
      ]),
    );
    expect(body.subjects.find((s: { id: string }) => s.id === mathId).questionCount).toBe(6);
    expect(body.years).toContain(year);
  });

  describe('criação', () => {
    it('custom respeita filtros e quantidade', async () => {
      const res = await call(user, 'POST', '/simulados', {
        mode: 'custom',
        filters: { subjectIds: [mathId] },
        questionCount: 5,
        timeLimitMinutes: 30,
      });
      expect(res.statusCode).toBe(201);
      const s = res.json();
      expect(s).toMatchObject({ mode: 'custom', questionCount: 5, timeLimitMinutes: 30 });
      expect(s.attempts).toEqual([]);
      const rows = await db
        .select()
        .from(schema.simuladoQuestions)
        .where(eq(schema.simuladoQuestions.simuladoId, s.id));
      expect(rows).toHaveLength(5);
      const qs = await db
        .select()
        .from(schema.questions)
        .where(
          inArray(
            schema.questions.id,
            rows.map((r) => r.questionId),
          ),
        );
      expect(qs.every((q) => q.subjectId === mathId)).toBe(true);
    });

    it('custom usa só o que existe quando há menos questões que o pedido', async () => {
      const res = await call(user, 'POST', '/simulados', {
        mode: 'custom',
        filters: { subjectIds: [natId] },
        questionCount: 20,
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ questionCount: 6, timeLimitMinutes: null });
    });

    it('custom por área e excludeAnswered', async () => {
      const first = await call(user, 'POST', '/simulados', {
        mode: 'custom',
        filters: { subjectIds: [mathId], excludeAnswered: true },
        questionCount: 6,
      });
      expect(first.statusCode).toBe(201);
      // marca uma questão de matemática como respondida por este usuário
      await db.insert(schema.answers).values({
        userId: user.id,
        questionId: questionIds[0]!,
        chosenLetter: 'A',
        isCorrect: false,
      });
      const second = await call(user, 'POST', '/simulados', {
        mode: 'custom',
        filters: { subjectIds: [mathId], excludeAnswered: true },
        questionCount: 6,
      });
      expect(second.json().questionCount).toBe(5);
      await db.delete(schema.answers).where(eq(schema.answers.userId, user.id));
    });

    it('rejeita contagem fora de 5–90 e filtros sem resultado', async () => {
      const few = await call(user, 'POST', '/simulados', { mode: 'custom', questionCount: 3 });
      expect(few.statusCode).toBe(400);
      const many = await call(user, 'POST', '/simulados', { mode: 'custom', questionCount: 91 });
      expect(many.statusCode).toBe(400);
      const none = await call(user, 'POST', '/simulados', {
        mode: 'custom',
        filters: { subjectIds: [randomUUID()] },
        questionCount: 10,
      });
      expect(none.statusCode).toBe(422);
      const noExam = await call(user, 'POST', '/simulados', { mode: 'official' });
      expect(noExam.statusCode).toBe(400);
      const badExam = await call(user, 'POST', '/simulados', {
        mode: 'official',
        examId: randomUUID(),
      });
      expect(badExam.statusCode).toBe(404);
    });

    it('oficial usa as questões da prova em ordem e tempo proporcional do ENEM', async () => {
      const res = await call(user, 'POST', '/simulados', { mode: 'official', examId });
      expect(res.statusCode).toBe(201);
      const s = res.json();
      expect(s).toMatchObject({ mode: 'official', examId, questionCount: 12 });
      // dia 1: 330 min para 90 questões => 12 questões ≈ 44 min
      expect(s.timeLimitMinutes).toBe(44);
      const rows = await db
        .select()
        .from(schema.simuladoQuestions)
        .where(eq(schema.simuladoQuestions.simuladoId, s.id))
        .orderBy(schema.simuladoQuestions.position);
      expect(rows.map((r) => r.questionId)).toEqual(questionIds);
    });

    it('oficial por área filtra e permite sobrescrever o tempo', async () => {
      const res = await call(user, 'POST', '/simulados', {
        mode: 'official',
        examId,
        area: 'natureza',
        timeLimitMinutes: null,
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ questionCount: 6, timeLimitMinutes: null });
      const auto = await call(user, 'POST', '/simulados', {
        mode: 'official',
        examId,
        area: 'matematica',
      });
      expect(auto.json().timeLimitMinutes).toBe(22);
    });

    it('lista e busca por id respeitam o dono', async () => {
      const created = (
        await call(user, 'POST', '/simulados', {
          mode: 'custom',
          title: 'Meu simulado',
          filters: { subjectIds: [mathId] },
          questionCount: 5,
        })
      ).json();
      const list = await call(user, 'GET', '/simulados');
      expect(list.json().items.some((s: { id: string }) => s.id === created.id)).toBe(true);
      expect((await call(user, 'GET', `/simulados/${created.id}`)).json().title).toBe(
        'Meu simulado',
      );
      expect((await call(other, 'GET', `/simulados/${created.id}`)).statusCode).toBe(404);
      const otherList = await call(other, 'GET', '/simulados');
      expect(otherList.json().items).toEqual([]);
      expect((await call(other, 'POST', `/simulados/${created.id}/attempts`)).statusCode).toBe(404);
    });
  });

  describe('fluxo de prova', () => {
    let simuladoId: string;
    let attemptId: string;

    beforeAll(async () => {
      const res = await call(user, 'POST', '/simulados', {
        mode: 'official',
        examId,
        timeLimitMinutes: 60,
      });
      simuladoId = res.json().id;
    });

    it('inicia tentativa com prazo e reaproveita a em andamento', async () => {
      const res = await call(user, 'POST', `/simulados/${simuladoId}/attempts`);
      expect(res.statusCode).toBe(201);
      const a = res.json().attempt;
      attemptId = a.id;
      expect(a.status).toBe('in_progress');
      const diff = new Date(a.deadlineAt).getTime() - new Date(a.startedAt).getTime();
      expect(diff).toBe(60 * 60_000);
      const again = await call(user, 'POST', `/simulados/${simuladoId}/attempts`);
      expect(again.statusCode).toBe(200);
      expect(again.json().attempt.id).toBe(attemptId);
    });

    it('GET devolve questões sem gabarito, e resultado ainda bloqueado', async () => {
      const res = await call(user, 'GET', `/attempts/${attemptId}`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.questions).toHaveLength(12);
      expect(body.questions[0].number).toBe(1);
      expect(body.answers).toEqual([]);
      expect(body.remainingMs).toBeGreaterThan(59 * 60_000);
      expect(res.body).not.toContain('isCorrect');
      expect(res.body).not.toContain('correctLetter');
      expect((await call(user, 'GET', `/attempts/${attemptId}/result`)).statusCode).toBe(409);
    });

    it('anti-cola: /check e /answers não revelam o gabarito de questão em simulado em andamento', async () => {
      const qid = questionIds[0]!;
      const check = await call(user, 'POST', `/questions/${qid}/check`, { letter: 'A' });
      expect(check.statusCode).toBe(409);
      expect(check.body).not.toContain('correctLetter');
      const ans = await call(user, 'POST', '/answers', { questionId: qid, letter: 'A' });
      expect(ans.statusCode).toBe(409);
      expect(ans.body).not.toContain('correctLetter');
    });

    it('autosave parcial, com sobrescrita e tempo', async () => {
      const q = questionIds;
      const r1 = await call(user, 'PUT', `/attempts/${attemptId}/answers`, {
        answers: [
          { questionId: q[0], letter: 'A', timeSpentMs: 1000 },
          { questionId: q[1], letter: correct.get(q[1]!), timeSpentMs: 2000 },
        ],
      });
      expect(r1.statusCode).toBe(200);
      expect(r1.json().saved).toBe(2);
      const r2 = await call(user, 'PUT', `/attempts/${attemptId}/answers`, {
        answers: [{ questionId: q[0], letter: correct.get(q[0]!), timeSpentMs: 4000 }],
      });
      expect(r2.statusCode).toBe(200);
      const s = (await call(user, 'GET', `/attempts/${attemptId}`)).json();
      expect(s.answers).toHaveLength(2);
      expect(s.answers.find((a: { questionId: string }) => a.questionId === q[0])).toMatchObject({
        letter: correct.get(q[0]!),
        timeSpentMs: 4000,
      });
    });

    it('rejeita questão de fora do simulado', async () => {
      const res = await call(user, 'PUT', `/attempts/${attemptId}/answers`, {
        answers: [{ questionId: randomUUID(), letter: 'A' }],
      });
      expect(res.statusCode).toBe(400);
    });

    it('outro usuário recebe 404 em tudo', async () => {
      expect((await call(other, 'GET', `/attempts/${attemptId}`)).statusCode).toBe(404);
      expect(
        (await call(other, 'PUT', `/attempts/${attemptId}/answers`, { answers: [] })).statusCode,
      ).toBe(404);
      expect((await call(other, 'POST', `/attempts/${attemptId}/finish`)).statusCode).toBe(404);
      expect((await call(other, 'GET', `/attempts/${attemptId}/result`)).statusCode).toBe(404);
    });

    it('finaliza: nota bruta, TRI por área, matérias, coerência e linhas em answers', async () => {
      const q = questionIds;
      // matemática: acerta as 4 mais fáceis (1-4), erra a 5 e deixa 6 em branco; natureza: acerta 7, erra 8
      const wrong = (id: string) => LETTERS.find((l) => l !== correct.get(id))!;
      await call(user, 'PUT', `/attempts/${attemptId}/answers`, {
        answers: [
          ...[0, 1, 2, 3].map((i) => ({ questionId: q[i], letter: correct.get(q[i]!) })),
          { questionId: q[4], letter: wrong(q[4]!) },
          { questionId: q[6], letter: correct.get(q[6]!) },
          { questionId: q[7], letter: wrong(q[7]!) },
        ],
      });
      const res = await call(user, 'POST', `/attempts/${attemptId}/finish`);
      expect(res.statusCode).toBe(200);
      const r = res.json();
      expect(r).toMatchObject({ total: 12, correct: 5, wrong: 2, blank: 5, percentage: 41.7 });
      expect(r.attempt.status).toBe('finished');

      const math = r.areas.find((a: { area: string }) => a.area === 'matematica');
      const nat = r.areas.find((a: { area: string }) => a.area === 'natureza');
      expect(math).toMatchObject({ total: 6, correct: 4, blank: 1, itemsWithParams: 6 });
      expect(math.tri.score).toBeGreaterThan(300);
      expect(math.tri.score).toBeLessThan(700);
      expect(math.tri.itemsUsed).toBe(6);
      expect(math.coherence).toBe(1);
      expect(nat).toMatchObject({ total: 6, correct: 1, itemsWithParams: 0, tri: null });
      expect(nat.coherence).toBeNull();
      expect(r.triScore).toBe(math.tri.score);
      expect(r.bySubject).toHaveLength(2);

      const first = r.questions[0];
      expect(first).toMatchObject({ outcome: 'correct', hasIrtParams: true });
      expect(first.alternatives.filter((a: { isCorrect: boolean }) => a.isCorrect)).toHaveLength(1);
      expect(r.questions[5].outcome).toBe('blank');
      expect(r.questions[4].outcome).toBe('wrong');

      const rows = await db
        .select()
        .from(schema.answers)
        .where(eq(schema.answers.simuladoAttemptId, attemptId));
      expect(rows).toHaveLength(12);
      expect(rows.filter((x) => x.isCorrect)).toHaveLength(5);
      expect(rows.filter((x) => x.chosenLetter === null)).toHaveLength(5);
      expect(rows.every((x) => x.userId === user.id)).toBe(true);

      const [att] = await db
        .select()
        .from(schema.simuladoAttempts)
        .where(eq(schema.simuladoAttempts.id, attemptId));
      expect(att).toMatchObject({ status: 'finished', rawScore: 5 });
      expect(att!.triScore).toBe(math.tri.score);
    });

    it('result devolve o mesmo, finish é idempotente e salvar depois dá 409', async () => {
      const a = (await call(user, 'GET', `/attempts/${attemptId}/result`)).json();
      const b = (await call(user, 'POST', `/attempts/${attemptId}/finish`)).json();
      expect(b.correct).toBe(a.correct);
      expect(a.questions[0].timeSpentMs).toBeGreaterThanOrEqual(0);
      const save = await call(user, 'PUT', `/attempts/${attemptId}/answers`, {
        answers: [{ questionId: questionIds[5], letter: 'A' }],
      });
      expect(save.statusCode).toBe(409);
      const rows = await db
        .select()
        .from(schema.answers)
        .where(eq(schema.answers.simuladoAttemptId, attemptId));
      expect(rows).toHaveLength(12);
      const session = (await call(user, 'GET', `/attempts/${attemptId}`)).json();
      expect(session.attempt.status).toBe('finished');
      expect(session.questions).toEqual([]);
    });

    it('prazo vencido finaliza automaticamente em qualquer acesso', async () => {
      const sim = (
        await call(user, 'POST', '/simulados', {
          mode: 'custom',
          filters: { subjectIds: [mathId] },
          questionCount: 5,
          timeLimitMinutes: 10,
        })
      ).json();
      const att = (await call(user, 'POST', `/simulados/${sim.id}/attempts`)).json().attempt;
      await call(user, 'PUT', `/attempts/${att.id}/answers`, {
        answers: [{ questionId: questionIds[0], letter: 'A' }],
      });
      const past = new Date(Date.now() - 2 * 60_000);
      await db
        .update(schema.simuladoAttempts)
        .set({ deadlineAt: past })
        .where(eq(schema.simuladoAttempts.id, att.id));

      const save = await call(user, 'PUT', `/attempts/${att.id}/answers`, {
        answers: [{ questionId: questionIds[1], letter: 'B' }],
      });
      expect(save.statusCode).toBe(409);
      const [row] = await db
        .select()
        .from(schema.simuladoAttempts)
        .where(eq(schema.simuladoAttempts.id, att.id));
      expect(row!.status).toBe('finished');
      expect(row!.finishedAt!.getTime()).toBe(past.getTime());
      const result = await call(user, 'GET', `/attempts/${att.id}/result`);
      expect(result.statusCode).toBe(200);
      expect(result.json().total).toBe(5);

      // GET também finaliza
      const att2 = (await call(user, 'POST', `/simulados/${sim.id}/attempts`)).json().attempt;
      expect(att2.id).not.toBe(att.id);
      await db
        .update(schema.simuladoAttempts)
        .set({ deadlineAt: past })
        .where(eq(schema.simuladoAttempts.id, att2.id));
      const view = (await call(user, 'GET', `/attempts/${att2.id}`)).json();
      expect(view.attempt.status).toBe('finished');
      expect(view.remainingMs).toBe(0);
    });
  });
});

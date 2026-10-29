import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db, schema } from '../src/db/index.js';
import { buildTestApp, createAuthedUser, deleteUser, type TestUser } from './helpers.js';

const tag = randomUUID().slice(0, 8);
const YEAR = 2999; // ano fictício para não colidir com dados reais

interface Fixture {
  institutionId: string;
  subjectId: string;
  otherSubjectId: string;
  topicParentId: string;
  topicChildId: string;
  examId: string;
  q: Record<'easy' | 'hard' | 'draft' | 'plain', string>;
}

let app: FastifyInstance;
let student: TestUser;
let student2: TestUser;
let reviewer: TestUser;
let fx: Fixture;

async function makeQuestion(opts: {
  examId: string;
  subjectId: string;
  number: number;
  statement: string;
  status?: 'draft' | 'reviewed' | 'published';
  irtB?: number | null;
  correct?: 'A' | 'B' | 'C' | 'D' | 'E';
  resolution?: string | null;
}) {
  const [q] = await db
    .insert(schema.questions)
    .values({
      examId: opts.examId,
      subjectId: opts.subjectId,
      number: opts.number,
      statement: opts.statement,
      status: opts.status ?? 'published',
      irtB: opts.irtB ?? null,
      resolution: opts.resolution ?? null,
      sourceName: 'Teste',
    })
    .returning();
  const correct = opts.correct ?? 'C';
  await db.insert(schema.alternatives).values(
    (['A', 'B', 'C', 'D', 'E'] as const).map((letter) => ({
      questionId: q!.id,
      letter,
      text: `Alternativa ${letter}`,
      isCorrect: letter === correct,
    })),
  );
  return q!.id;
}

beforeAll(async () => {
  app = await buildTestApp();
  student = await createAuthedUser(app);
  student2 = await createAuthedUser(app);
  reviewer = await createAuthedUser(app, { role: 'reviewer' });

  const [inst] = await db
    .insert(schema.institutions)
    .values({ slug: `t-${tag}`, name: `Inst ${tag}` })
    .returning();
  const [subj] = await db
    .insert(schema.subjects)
    .values({ slug: `t-fis-${tag}`, name: `Fisica ${tag}`, area: 'natureza' })
    .returning();
  const [subj2] = await db
    .insert(schema.subjects)
    .values({ slug: `t-qui-${tag}`, name: `Quimica ${tag}`, area: 'natureza' })
    .returning();
  const [parent] = await db
    .insert(schema.topics)
    .values({ subjectId: subj!.id, slug: 'mec', name: 'Mecânica' })
    .returning();
  const [child] = await db
    .insert(schema.topics)
    .values({ subjectId: subj!.id, parentId: parent!.id, slug: 'mec--cin', name: 'Cinemática' })
    .returning();
  const [exam] = await db
    .insert(schema.exams)
    .values({ institutionId: inst!.id, year: YEAR, label: `Teste ${tag}` })
    .returning();

  const easy = await makeQuestion({
    examId: exam!.id,
    subjectId: subj!.id,
    number: 1,
    statement: 'Um carro percorre uma estrada com velocidade constante.',
    irtB: 0.1,
    correct: 'B',
    resolution: 'Use $v = d/t$.',
  });
  const hard = await makeQuestion({
    examId: exam!.id,
    subjectId: subj2!.id,
    number: 2,
    statement: 'A reação de neutralização entre ácido e base produz sal e água.',
    irtB: 2.5,
  });
  const draft = await makeQuestion({
    examId: exam!.id,
    subjectId: subj!.id,
    number: 3,
    statement: 'Questão em rascunho sobre velocidade.',
    status: 'draft',
  });
  const plain = await makeQuestion({
    examId: exam!.id,
    subjectId: subj!.id,
    number: 4,
    statement: 'Outra questão qualquer.',
    irtB: 1,
  });
  await db.insert(schema.questionTopics).values({ questionId: easy, topicId: child!.id });

  fx = {
    institutionId: inst!.id,
    subjectId: subj!.id,
    otherSubjectId: subj2!.id,
    topicParentId: parent!.id,
    topicChildId: child!.id,
    examId: exam!.id,
    q: { easy, hard, draft, plain },
  };
});

afterAll(async () => {
  await db.delete(schema.exams).where(eq(schema.exams.id, fx.examId));
  await db.delete(schema.questions).where(inArray(schema.questions.id, Object.values(fx.q)));
  await db.delete(schema.topics).where(eq(schema.topics.id, fx.topicParentId));
  await db
    .delete(schema.subjects)
    .where(inArray(schema.subjects.id, [fx.subjectId, fx.otherSubjectId]));
  await db.delete(schema.institutions).where(eq(schema.institutions.id, fx.institutionId));
  await Promise.all([student, student2, reviewer].map((u) => deleteUser(u.id)));
  await app.close();
});

const list = (query: string, user?: TestUser) =>
  app.inject({
    method: 'GET',
    url: `/api/v1/questions?institutionId=${fx.institutionId}&${query}`,
    headers: user ? { cookie: user.cookie } : {},
  });

describe('GET /api/v1/catalog', () => {
  it('lista instituições, matérias com árvore de assuntos e anos', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/catalog' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('public');
    const body = res.json();
    expect(body.institutions.some((i: { id: string }) => i.id === fx.institutionId)).toBe(true);
    const subject = body.subjects.find((s: { id: string }) => s.id === fx.subjectId);
    expect(subject.topics[0].children[0].name).toBe('Cinemática');
    expect(body.years).toContain(YEAR);
    expect(body.institutionYears[fx.institutionId]).toEqual([YEAR]);
  });
});

describe('GET /api/v1/questions (filtros)', () => {
  it('anônimo só vê publicadas e nunca recebe o gabarito', async () => {
    const res = await list('');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(3);
    expect(body.items.map((i: { id: string }) => i.id)).not.toContain(fx.q.draft);
    const raw = res.body;
    expect(raw).not.toContain('isCorrect');
    expect(raw).not.toContain('correctLetter');
    expect(raw).not.toContain('Use $v');
    for (const item of body.items) {
      for (const alt of item.alternatives) expect(Object.keys(alt)).not.toContain('isCorrect');
    }
  });

  it('filtra por ano, matéria e assunto (incluindo filhos)', async () => {
    expect((await list(`year=${YEAR + 1}`)).json().total).toBe(0);
    expect((await list(`subjectId=${fx.otherSubjectId}`)).json().total).toBe(1);
    const byParent = (await list(`topicId=${fx.topicParentId}`)).json();
    expect(byParent.items.map((i: { id: string }) => i.id)).toEqual([fx.q.easy]);
  });

  it('busca full-text em português', async () => {
    const res = (await list('q=velocidade')).json();
    expect(res.items.map((i: { id: string }) => i.id)).toEqual([fx.q.easy]);
    // radical: "neutralizações" encontra "neutralização"
    expect((await list('q=neutralizações')).json().total).toBe(1);
  });

  it('filtra por dificuldade a partir do parâmetro b', async () => {
    expect((await list('difficulty=easy')).json().items.map((i: { id: string }) => i.id)).toEqual([
      fx.q.easy,
    ]);
    expect((await list('difficulty=hard')).json().items.map((i: { id: string }) => i.id)).toEqual([
      fx.q.hard,
    ]);
    expect((await list('difficulty=medium')).json().items.map((i: { id: string }) => i.id)).toEqual(
      [fx.q.plain],
    );
  });

  it('pagina por cursor', async () => {
    const p1 = (await list('limit=2')).json();
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (await list(`limit=2&cursor=${p1.nextCursor}`)).json();
    expect(p2.items).toHaveLength(1);
    expect(p2.nextCursor).toBeNull();
    const ids = [...p1.items, ...p2.items].map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('filtros pessoais exigem login (401)', async () => {
    for (const f of ['onlyUnanswered=true', 'onlyWrong=true', 'onlySaved=true']) {
      expect((await list(f)).statusCode).toBe(401);
    }
  });

  it('aluno não pode filtrar por status de rascunho; revisor pode', async () => {
    expect((await list('status=draft', student)).statusCode).toBe(403);
    expect((await list('status=draft')).statusCode).toBe(403);
    const res = await list('status=draft', reviewer);
    expect(res.statusCode).toBe(200);
    expect(res.json().items.map((i: { id: string }) => i.id)).toEqual([fx.q.draft]);
  });
});

describe('GET /api/v1/questions/:id', () => {
  it('público para publicadas, sem gabarito', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/questions/${fx.q.easy}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('isCorrect');
    expect(res.json().alternatives).toHaveLength(5);
    expect(res.json().difficulty).toBe('easy');
  });

  it('rascunho: 404 para anônimo/aluno, visível para revisor', async () => {
    const url = `/api/v1/questions/${fx.q.draft}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url, headers: { cookie: student.cookie } })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url, headers: { cookie: reviewer.cookie } })).statusCode,
    ).toBe(200);
  });
});

describe('respostas', () => {
  it('POST /answers exige login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/answers',
      payload: { questionId: fx.q.easy, letter: 'A' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('registra a resposta, devolve gabarito, resolução e estatísticas', async () => {
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/v1/answers',
      headers: { cookie: student.cookie },
      payload: { questionId: fx.q.easy, letter: 'A', timeSpentMs: 4200 },
    });
    expect(wrong.statusCode).toBe(200);
    expect(wrong.json()).toMatchObject({
      correct: false,
      correctLetter: 'B',
      resolution: 'Use $v = d/t$.',
      totalAnswers: 1,
    });

    const right = await app.inject({
      method: 'POST',
      url: '/api/v1/answers',
      headers: { cookie: student2.cookie },
      payload: { questionId: fx.q.easy, letter: 'B' },
    });
    const body = right.json();
    expect(body.correct).toBe(true);
    expect(body.totalAnswers).toBe(2);
    expect(body.stats.find((s: { letter: string }) => s.letter === 'A').percent).toBe(50);
    expect(body.stats.find((s: { letter: string }) => s.letter === 'B').percent).toBe(50);

    const rows = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.questionId, fx.q.easy));
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === student.id)?.timeSpentMs).toBe(4200);
  });

  it('não permite responder rascunho como aluno', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/answers',
      headers: { cookie: student.cookie },
      payload: { questionId: fx.q.draft, letter: 'A' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('estado do usuário na listagem e filtros pessoais', async () => {
    const mine = (await list('', student)).json();
    const easy = mine.items.find((i: { id: string }) => i.id === fx.q.easy);
    expect(easy).toMatchObject({ answered: true, wasCorrect: false });

    const unanswered = (await list('onlyUnanswered=true', student)).json();
    expect(unanswered.items.map((i: { id: string }) => i.id)).not.toContain(fx.q.easy);
    expect(unanswered.total).toBe(2);

    const wrong = (await list('onlyWrong=true', student)).json();
    expect(wrong.items.map((i: { id: string }) => i.id)).toEqual([fx.q.easy]);
    // student2 acertou: não aparece em "erradas"
    expect((await list('onlyWrong=true', student2)).json().total).toBe(0);
  });

  it('POST /questions/:id/check é público e não registra', async () => {
    const before = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.questionId, fx.q.hard));
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/questions/${fx.q.hard}/check`,
      payload: { letter: 'C' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ correct: true, correctLetter: 'C' });
    const after = await db
      .select()
      .from(schema.answers)
      .where(eq(schema.answers.questionId, fx.q.hard));
    expect(after.length).toBe(before.length);
    const draft = await app.inject({
      method: 'POST',
      url: `/api/v1/questions/${fx.q.draft}/check`,
      payload: { letter: 'C' },
    });
    expect(draft.statusCode).toBe(404);
  });
});

describe('salvar questões', () => {
  it('PUT/DELETE /questions/:id/save e filtro onlySaved', async () => {
    const url = `/api/v1/questions/${fx.q.plain}/save`;
    expect((await app.inject({ method: 'PUT', url })).statusCode).toBe(401);

    const put = await app.inject({ method: 'PUT', url, headers: { cookie: student.cookie } });
    expect(put.json()).toEqual({ saved: true });
    // idempotente
    expect(
      (await app.inject({ method: 'PUT', url, headers: { cookie: student.cookie } })).statusCode,
    ).toBe(200);

    const saved = (await list('onlySaved=true', student)).json();
    expect(saved.items.map((i: { id: string }) => i.id)).toEqual([fx.q.plain]);
    expect(saved.items[0].saved).toBe(true);

    const del = await app.inject({ method: 'DELETE', url, headers: { cookie: student.cookie } });
    expect(del.json()).toEqual({ saved: false });
    expect((await list('onlySaved=true', student)).json().total).toBe(0);
  });
});

describe('revisão', () => {
  it('bloqueia anônimo (401) e aluno (403)', async () => {
    const url = '/api/v1/review/questions';
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url, headers: { cookie: student.cookie } })).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `${url}/${fx.q.draft}`,
          headers: { cookie: student.cookie },
          payload: { status: 'published' },
        })
      ).statusCode,
    ).toBe(403);
  });

  it('revisor lista rascunhos e vê o gabarito', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/review/questions?status=draft&year=${YEAR}`,
      headers: { cookie: reviewer.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual([fx.q.draft]);
    expect(body.items[0].alternatives.find((a: { isCorrect: boolean }) => a.isCorrect).letter).toBe(
      'C',
    );

    const one = await app.inject({
      method: 'GET',
      url: `/api/v1/review/questions/${fx.q.easy}`,
      headers: { cookie: reviewer.cookie },
    });
    expect(one.json().alternatives.some((a: { isCorrect: boolean }) => a.isCorrect)).toBe(true);
  });

  it('edita e publica; rejeita gabarito inexistente', async () => {
    const url = `/api/v1/review/questions/${fx.q.draft}`;
    const bad = await app.inject({
      method: 'PATCH',
      url,
      headers: { cookie: reviewer.cookie },
      payload: {
        alternatives: [
          { letter: 'A', text: 'x' },
          { letter: 'B', text: 'y' },
        ],
        correctLetter: 'D',
      },
    });
    expect(bad.statusCode).toBe(422);

    const res = await app.inject({
      method: 'PATCH',
      url,
      headers: { cookie: reviewer.cookie },
      payload: {
        statement: 'Enunciado corrigido.',
        correctLetter: 'E',
        subjectId: fx.otherSubjectId,
        topicIds: [fx.topicChildId],
        resolution: 'Porque sim.',
        status: 'published',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      statement: 'Enunciado corrigido.',
      status: 'published',
      subjectId: fx.otherSubjectId,
      topics: ['Cinemática'],
      resolution: 'Porque sim.',
    });
    expect(body.alternatives.find((a: { isCorrect: boolean }) => a.isCorrect).letter).toBe('E');

    // agora está publicada e visível ao público
    const pub = await app.inject({ method: 'GET', url: `/api/v1/questions/${fx.q.draft}` });
    expect(pub.statusCode).toBe(200);
  });
});

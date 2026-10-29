import { and, asc, count, desc, eq, exists, inArray, isNotNull, notExists, sql } from 'drizzle-orm';
import {
  ENEM_AREA_LABELS,
  type AlternativeLetter,
  type AttemptResult,
  type AttemptSave,
  type AttemptSession,
  type EnemArea,
  type Simulado,
  type SimuladoCreate,
  type SimuladoLanguage,
  type SimuladoOptions,
} from '@freenem/shared';
import { db, schema, type Db } from '../../db/index.js';
import { publicUrls } from '../../lib/storage.js';
import { hasValidParams } from '../../lib/tri.js';
import { outcomeOf, summarize, type ScoreQuestion } from './scoring.js';

const {
  alternatives,
  answers,
  exams,
  institutions,
  questionTopics,
  questions,
  simuladoAttempts,
  simuladoQuestions,
  simulados,
  subjects,
} = schema;

/** Tolerância (ms) para salvar/finalizar logo após o prazo (latência de rede, último autosave). */
export const DEADLINE_GRACE_MS = 5_000;
/** Tempo oficial do ENEM por dia, em minutos, e nº de questões por dia. */
const ENEM_DAY_MINUTES: Record<1 | 2, number> = { 1: 330, 2: 300 };
const ENEM_DAY_QUESTIONS = 90;

export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const notFound = (what: string) => new ServiceError(404, `${what} não encontrado.`);

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

const iso = (d: Date | null) => (d ? d.toISOString() : null);

// ---------------------------------------------------------------- opções

const LANGUAGES: SimuladoLanguage[] = ['ingles', 'espanhol'];

/** Tempo oficial da prova completa em minutos (só ENEM, pelo dia). */
export function officialMinutes(institutionSlug: string, phase: string | null): number | null {
  if (institutionSlug !== 'enem' || !phase) return null;
  if (/\b1|primeiro/i.test(phase)) return ENEM_DAY_MINUTES[1];
  if (/\b2|segundo/i.test(phase)) return ENEM_DAY_MINUTES[2];
  return null;
}

export async function getOptions(): Promise<SimuladoOptions> {
  const published = eq(questions.status, 'published');
  const [examRows, perArea, perLanguage, subjectRows, instRows] = await Promise.all([
    db
      .select({
        id: exams.id,
        institution: institutions.name,
        institutionSlug: institutions.slug,
        year: exams.year,
        label: exams.label,
        phase: exams.phase,
        color: exams.color,
      })
      .from(exams)
      .innerJoin(institutions, eq(institutions.id, exams.institutionId))
      .orderBy(desc(exams.year), asc(exams.label)),
    db
      .select({ examId: questions.examId, area: subjects.area, n: count() })
      .from(questions)
      .leftJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(and(published, isNotNull(questions.examId)))
      .groupBy(questions.examId, subjects.area),
    db
      .select({ examId: questions.examId, slug: subjects.slug, n: count() })
      .from(questions)
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(and(published, isNotNull(questions.examId), inArray(subjects.slug, LANGUAGES)))
      .groupBy(questions.examId, subjects.slug),
    db
      .select({
        id: subjects.id,
        slug: subjects.slug,
        name: subjects.name,
        area: subjects.area,
        n: count(questions.id),
      })
      .from(subjects)
      .leftJoin(questions, and(eq(questions.subjectId, subjects.id), published))
      .groupBy(subjects.id)
      .orderBy(asc(subjects.position), asc(subjects.name)),
    db
      .select({
        id: institutions.id,
        slug: institutions.slug,
        name: institutions.name,
        n: count(questions.id),
      })
      .from(institutions)
      .leftJoin(exams, eq(exams.institutionId, institutions.id))
      .leftJoin(questions, and(eq(questions.examId, exams.id), published))
      .groupBy(institutions.id)
      .orderBy(asc(institutions.name)),
  ]);

  const areasByExam = new Map<string, { area: EnemArea; count: number }[]>();
  const totalByExam = new Map<string, number>();
  for (const r of perArea) {
    if (!r.examId) continue;
    totalByExam.set(r.examId, (totalByExam.get(r.examId) ?? 0) + r.n);
    if (r.area) {
      const list = areasByExam.get(r.examId) ?? [];
      list.push({ area: r.area, count: r.n });
      areasByExam.set(r.examId, list);
    }
  }

  const languagesByExam = new Map<string, { ingles: number; espanhol: number }>();
  for (const r of perLanguage) {
    if (!r.examId) continue;
    const cur = languagesByExam.get(r.examId) ?? { ingles: 0, espanhol: 0 };
    cur[r.slug as SimuladoLanguage] = r.n;
    languagesByExam.set(r.examId, cur);
  }

  const examList = examRows
    .filter((e) => (totalByExam.get(e.id) ?? 0) > 0)
    .map((e) => ({
      ...e,
      questionCount: totalByExam.get(e.id) ?? 0,
      areas: areasByExam.get(e.id) ?? [],
      languageCounts: languagesByExam.get(e.id) ?? { ingles: 0, espanhol: 0 },
      officialMinutes: officialMinutes(e.institutionSlug, e.phase),
    }));

  return {
    exams: examList,
    subjects: subjectRows.map(({ n, ...s }) => ({ ...s, questionCount: n })),
    institutions: instRows.map(({ n, ...s }) => ({ ...s, questionCount: n })),
    years: [...new Set(examList.map((e) => e.year))].sort((a, b) => b - a),
  };
}

// ---------------------------------------------------------------- criação

export async function createSimulado(userId: string, input: SimuladoCreate): Promise<Simulado> {
  let questionIds: string[];
  let title = input.title;
  let timeLimit: number | null;
  let examId: string | null = null;
  let storedFilters: Record<string, unknown> | null = null;

  if (input.mode === 'official') {
    const [exam] = await db
      .select({
        id: exams.id,
        year: exams.year,
        label: exams.label,
        phase: exams.phase,
        institution: institutions.name,
        institutionSlug: institutions.slug,
      })
      .from(exams)
      .innerJoin(institutions, eq(institutions.id, exams.institutionId))
      .where(eq(exams.id, input.examId!));
    if (!exam) throw notFound('Prova');
    examId = exam.id;
    const rows = await db
      .select({ id: questions.id, slug: subjects.slug })
      .from(questions)
      .leftJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(
        and(
          eq(questions.examId, exam.id),
          eq(questions.status, 'published'),
          input.area ? eq(subjects.area, input.area) : undefined,
        ),
      )
      .orderBy(sql`${questions.number} asc nulls last`, asc(questions.id));
    // ENEM Dia 1: Inglês e Espanhol repetem os números 1–5; o aluno escolhe uma língua.
    const slugs = new Set(rows.map((r) => r.slug));
    const bothLanguages = LANGUAGES.every((l) => slugs.has(l));
    const language = input.language ?? 'ingles';
    const dropped = language === 'ingles' ? 'espanhol' : 'ingles';
    const chosen = bothLanguages ? rows.filter((r) => r.slug !== dropped) : rows;
    if (chosen.length === 0) {
      throw new ServiceError(422, 'Esta prova não tem questões publicadas para essa seleção.');
    }
    questionIds = chosen.map((r) => r.id);
    const base = officialMinutes(exam.institutionSlug, exam.phase);
    if (input.timeLimitMinutes !== undefined) timeLimit = input.timeLimitMinutes;
    else if (base === null) timeLimit = Math.ceil(questionIds.length * 3);
    else {
      timeLimit = Math.max(
        1,
        Math.min(base, Math.round((base * questionIds.length) / ENEM_DAY_QUESTIONS)),
      );
    }
    title ??= `${exam.institution} ${exam.year} - ${exam.label}${
      input.area ? ` (${ENEM_AREA_LABELS[input.area].split(' e ')[0]})` : ''
    }`;
    storedFilters =
      input.area || bothLanguages
        ? { ...(input.area ? { area: input.area } : {}), ...(bothLanguages ? { language } : {}) }
        : null;
  } else {
    const f = input.filters ?? {};
    const wanted = input.questionCount ?? 20;
    const conds = [eq(questions.status, 'published')];
    if (f.areas?.length) conds.push(inArray(subjects.area, f.areas));
    if (f.subjectIds?.length) conds.push(inArray(questions.subjectId, f.subjectIds));
    if (f.institutionIds?.length) conds.push(inArray(exams.institutionId, f.institutionIds));
    if (f.years?.length) conds.push(inArray(exams.year, f.years));
    if (f.topicIds?.length) {
      conds.push(
        exists(
          db
            .select({ x: sql`1` })
            .from(questionTopics)
            .where(
              and(
                eq(questionTopics.questionId, questions.id),
                inArray(questionTopics.topicId, f.topicIds),
              ),
            ),
        ),
      );
    }
    if (f.excludeAnswered) {
      conds.push(
        notExists(
          db
            .select({ x: sql`1` })
            .from(answers)
            .where(
              and(
                eq(answers.questionId, questions.id),
                eq(answers.userId, userId),
                isNotNull(answers.chosenLetter),
              ),
            ),
        ),
      );
    }
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .leftJoin(exams, eq(exams.id, questions.examId))
      .leftJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(and(...conds))
      .orderBy(sql`random()`)
      .limit(wanted);
    if (rows.length < 1) {
      throw new ServiceError(422, 'Nenhuma questão publicada encontrada com esses filtros.');
    }
    questionIds = rows.map((r) => r.id);
    timeLimit = input.timeLimitMinutes ?? null;
    title ??= `Simulado personalizado (${questionIds.length} questões)`;
    storedFilters = input.filters ?? null;
  }

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(simulados)
      .values({
        userId,
        title: title!,
        mode: input.mode,
        examId,
        filters: storedFilters,
        questionCount: questionIds.length,
        timeLimitMinutes: timeLimit,
      })
      .returning({ id: simulados.id });
    await tx.insert(simuladoQuestions).values(
      questionIds.map((questionId, i) => ({
        simuladoId: created!.id,
        questionId,
        position: i + 1,
      })),
    );
    return created!.id;
  });
  return (await loadSimulados(userId, [id]))[0]!;
}

// ---------------------------------------------------------------- leitura

async function loadSimulados(userId: string, ids?: string[]): Promise<Simulado[]> {
  const rows = await db
    .select()
    .from(simulados)
    .where(and(eq(simulados.userId, userId), ids ? inArray(simulados.id, ids) : undefined))
    .orderBy(desc(simulados.createdAt))
    .limit(ids ? ids.length : 100);
  if (rows.length === 0) return [];
  const attempts = await db
    .select()
    .from(simuladoAttempts)
    .where(
      and(
        eq(simuladoAttempts.userId, userId),
        inArray(
          simuladoAttempts.simuladoId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .orderBy(desc(simuladoAttempts.startedAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mode: r.mode,
    examId: r.examId,
    questionCount: r.questionCount,
    timeLimitMinutes: r.timeLimitMinutes,
    createdAt: r.createdAt.toISOString(),
    filters: (r.filters as Simulado['filters']) ?? null,
    attempts: attempts
      .filter((a) => a.simuladoId === r.id)
      .map((a) => ({
        id: a.id,
        status: a.status,
        startedAt: a.startedAt.toISOString(),
        finishedAt: iso(a.finishedAt),
        deadlineAt: iso(a.deadlineAt),
        rawScore: a.rawScore,
        triScore: a.triScore,
      })),
  }));
}

export const listSimulados = (userId: string) => loadSimulados(userId);

export async function getSimulado(userId: string, id: string): Promise<Simulado> {
  const [s] = await loadSimulados(userId, [id]);
  if (!s) throw notFound('Simulado');
  return s;
}

// ---------------------------------------------------------------- tentativas

type AttemptRow = typeof simuladoAttempts.$inferSelect;

async function loadOwnedAttempt(userId: string, attemptId: string): Promise<AttemptRow> {
  const [a] = await db
    .select()
    .from(simuladoAttempts)
    .where(and(eq(simuladoAttempts.id, attemptId), eq(simuladoAttempts.userId, userId)));
  if (!a) throw notFound('Tentativa');
  return a;
}

const isExpired = (a: AttemptRow, now = Date.now(), grace = DEADLINE_GRACE_MS) =>
  a.status === 'in_progress' && !!a.deadlineAt && now > a.deadlineAt.getTime() + grace;

/** Se a tentativa passou do prazo, finaliza (com hora de término = prazo) e devolve a versão atualizada. */
async function settle(a: AttemptRow): Promise<AttemptRow> {
  if (!isExpired(a)) return a;
  await finishInternal(a.id, a.deadlineAt);
  const [fresh] = await db.select().from(simuladoAttempts).where(eq(simuladoAttempts.id, a.id));
  return fresh!;
}

const toAttemptDto = (a: AttemptRow) => ({
  id: a.id,
  simuladoId: a.simuladoId,
  status: a.status,
  startedAt: a.startedAt.toISOString(),
  finishedAt: iso(a.finishedAt),
  deadlineAt: iso(a.deadlineAt),
});

export async function startAttempt(userId: string, simuladoId: string) {
  const [sim] = await db
    .select()
    .from(simulados)
    .where(and(eq(simulados.id, simuladoId), eq(simulados.userId, userId)));
  if (!sim) throw notFound('Simulado');

  const open = await db
    .select()
    .from(simuladoAttempts)
    .where(
      and(
        eq(simuladoAttempts.simuladoId, simuladoId),
        eq(simuladoAttempts.userId, userId),
        eq(simuladoAttempts.status, 'in_progress'),
      ),
    )
    .orderBy(desc(simuladoAttempts.startedAt));
  for (const a of open) {
    const fresh = await settle(a);
    if (fresh.status === 'in_progress') return { attempt: toAttemptDto(fresh), created: false };
  }

  const now = new Date();
  const [created] = await db
    .insert(simuladoAttempts)
    .values({
      simuladoId,
      userId,
      startedAt: now,
      deadlineAt: sim.timeLimitMinutes
        ? new Date(now.getTime() + sim.timeLimitMinutes * 60_000)
        : null,
    })
    .returning();
  return { attempt: toAttemptDto(created!), created: true };
}

interface QuestionData extends ScoreQuestion {
  position: number;
  number: number | null;
  statement: string;
  imageUrls: string[];
  resolution: string | null;
  alts: { letter: AlternativeLetter; text: string; imageUrl: string | null; isCorrect: boolean }[];
}

async function loadQuestionData(ex: Executor, simuladoId: string): Promise<QuestionData[]> {
  const rows = await ex
    .select({
      id: questions.id,
      position: simuladoQuestions.position,
      number: questions.number,
      statement: questions.statement,
      imageUrls: questions.imageUrls,
      resolution: questions.resolution,
      irtA: questions.irtA,
      irtB: questions.irtB,
      irtC: questions.irtC,
      subjectId: subjects.id,
      subject: subjects.name,
      area: subjects.area,
    })
    .from(simuladoQuestions)
    .innerJoin(questions, eq(questions.id, simuladoQuestions.questionId))
    .leftJoin(subjects, eq(subjects.id, questions.subjectId))
    .where(eq(simuladoQuestions.simuladoId, simuladoId))
    .orderBy(asc(simuladoQuestions.position));
  if (rows.length === 0) return [];
  const alts = await ex
    .select()
    .from(alternatives)
    .where(
      inArray(
        alternatives.questionId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(alternatives.letter));
  const byQ = new Map<string, typeof alts>();
  for (const a of alts) {
    const l = byQ.get(a.questionId) ?? [];
    l.push(a);
    byQ.set(a.questionId, l);
  }
  return rows.map((r) => {
    const list = byQ.get(r.id) ?? [];
    const params = { a: r.irtA as number, b: r.irtB as number, c: r.irtC as number };
    return {
      id: r.id,
      position: r.position,
      number: r.number,
      statement: publicUrls(r.statement),
      imageUrls: r.imageUrls.map(publicUrls),
      resolution: r.resolution ? publicUrls(r.resolution) : null,
      subjectId: r.subjectId,
      subject: r.subject,
      area: r.area,
      params: r.irtA !== null && hasValidParams(params) ? params : null,
      correctLetter: list.find((a) => a.isCorrect)?.letter ?? null,
      alts: list.map((a) => ({
        letter: a.letter,
        text: publicUrls(a.text),
        imageUrl: a.imageUrl ? publicUrls(a.imageUrl) : null,
        isCorrect: a.isCorrect,
      })),
    };
  });
}

async function loadAnswerRows(ex: Executor, attemptId: string) {
  const rows = await ex
    .select()
    .from(answers)
    .where(eq(answers.simuladoAttemptId, attemptId))
    .orderBy(asc(answers.answeredAt));
  const map = new Map<string, (typeof rows)[number]>();
  for (const r of rows) map.set(r.questionId, r); // a última prevalece
  return map;
}

export async function getAttemptSession(
  userId: string,
  attemptId: string,
): Promise<AttemptSession> {
  const attempt = await settle(await loadOwnedAttempt(userId, attemptId));
  const [sim] = await db.select().from(simulados).where(eq(simulados.id, attempt.simuladoId));
  const now = Date.now();
  const inProgress = attempt.status === 'in_progress';
  const qs = inProgress ? await loadQuestionData(db, attempt.simuladoId) : [];
  const rows = inProgress ? await loadAnswerRows(db, attemptId) : new Map();
  return {
    attempt: toAttemptDto(attempt),
    title: sim!.title,
    serverNow: new Date(now).toISOString(),
    remainingMs: attempt.deadlineAt ? Math.max(0, attempt.deadlineAt.getTime() - now) : null,
    questions: qs.map((q) => ({
      id: q.id,
      position: q.position,
      number: q.number,
      statement: q.statement,
      imageUrls: q.imageUrls,
      subject: q.subject,
      area: q.area,
      alternatives: q.alts.map(({ letter, text, imageUrl }) => ({ letter, text, imageUrl })),
    })),
    answers: [...rows.values()].map((r) => ({
      questionId: r.questionId,
      letter: r.chosenLetter,
      timeSpentMs: r.timeSpentMs ?? 0,
    })),
  };
}

export async function saveAnswers(userId: string, attemptId: string, input: AttemptSave) {
  const attempt = await settle(await loadOwnedAttempt(userId, attemptId));
  if (attempt.status !== 'in_progress') {
    throw new ServiceError(409, 'O tempo acabou ou a tentativa já foi finalizada.');
  }
  const latest = new Map<string, AttemptSave['answers'][number]>();
  for (const a of input.answers) latest.set(a.questionId, a);
  if (latest.size === 0) return { saved: 0, remainingMs: remaining(attempt) };

  const qs = await loadQuestionData(db, attempt.simuladoId);
  const byId = new Map(qs.map((q) => [q.id, q]));
  for (const id of latest.keys()) {
    if (!byId.has(id)) throw new ServiceError(400, 'Questão não pertence a este simulado.');
  }

  await db.transaction(async (tx) => {
    const existing = await loadAnswerRows(tx, attemptId);
    for (const a of latest.values()) {
      const q = byId.get(a.questionId)!;
      const prev = existing.get(a.questionId);
      await tx
        .delete(answers)
        .where(and(eq(answers.simuladoAttemptId, attemptId), eq(answers.questionId, a.questionId)));
      await tx.insert(answers).values({
        userId,
        questionId: a.questionId,
        chosenLetter: a.letter,
        isCorrect: outcomeOf(q, a.letter) === 'correct',
        timeSpentMs: a.timeSpentMs ?? prev?.timeSpentMs ?? 0,
        simuladoAttemptId: attemptId,
      });
    }
  });
  return { saved: latest.size, remainingMs: remaining(attempt) };
}

const remaining = (a: AttemptRow) =>
  a.deadlineAt ? Math.max(0, a.deadlineAt.getTime() - Date.now()) : null;

/** Finaliza a tentativa (idempotente): grava uma linha em `answers` por questão e a nota. */
async function finishInternal(attemptId: string, finishedAt: Date | null): Promise<void> {
  await db.transaction(async (tx) => {
    const [att] = await tx
      .select()
      .from(simuladoAttempts)
      .where(eq(simuladoAttempts.id, attemptId))
      .for('update');
    if (!att || att.status !== 'in_progress') return;
    const qs = await loadQuestionData(tx, att.simuladoId);
    const existing = await loadAnswerRows(tx, attemptId);
    const end = finishedAt ?? new Date();

    const chosen = new Map<string, AlternativeLetter | null>();
    for (const q of qs) chosen.set(q.id, existing.get(q.id)?.chosenLetter ?? null);

    await tx.delete(answers).where(eq(answers.simuladoAttemptId, attemptId));
    if (qs.length) {
      await tx.insert(answers).values(
        qs.map((q) => ({
          userId: att.userId,
          questionId: q.id,
          chosenLetter: chosen.get(q.id) ?? null,
          isCorrect: outcomeOf(q, chosen.get(q.id) ?? null) === 'correct',
          timeSpentMs: existing.get(q.id)?.timeSpentMs ?? 0,
          simuladoAttemptId: attemptId,
          answeredAt: existing.get(q.id)?.answeredAt ?? end,
        })),
      );
    }
    const summary = summarize(qs, chosen);
    await tx
      .update(simuladoAttempts)
      .set({
        status: 'finished',
        finishedAt: end,
        rawScore: summary.correct,
        triScore: summary.triScore,
      })
      .where(eq(simuladoAttempts.id, attemptId));
  });
}

export async function finishAttempt(userId: string, attemptId: string) {
  const attempt = await loadOwnedAttempt(userId, attemptId);
  if (attempt.status === 'in_progress') {
    const late = !!attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime();
    await finishInternal(attemptId, late ? attempt.deadlineAt : null);
  }
  return getAttemptResult(userId, attemptId);
}

export async function getAttemptResult(userId: string, attemptId: string): Promise<AttemptResult> {
  const attempt = await settle(await loadOwnedAttempt(userId, attemptId));
  if (attempt.status === 'in_progress') {
    throw new ServiceError(409, 'Finalize a tentativa para ver o resultado.');
  }
  const [sim] = await db.select().from(simulados).where(eq(simulados.id, attempt.simuladoId));
  const qs = await loadQuestionData(db, attempt.simuladoId);
  const rows = await loadAnswerRows(db, attemptId);
  const chosen = new Map<string, AlternativeLetter | null>();
  for (const q of qs) chosen.set(q.id, rows.get(q.id)?.chosenLetter ?? null);
  const summary = summarize(qs, chosen);

  return {
    attempt: toAttemptDto(attempt),
    title: sim!.title,
    mode: sim!.mode,
    total: summary.total,
    correct: summary.correct,
    wrong: summary.wrong,
    blank: summary.blank,
    percentage: summary.percentage,
    triScore: summary.triScore,
    coherence: summary.coherence,
    totalTimeMs: [...rows.values()].reduce((s, r) => s + (r.timeSpentMs ?? 0), 0),
    areas: summary.areas,
    bySubject: summary.bySubject,
    questions: qs.map((q) => ({
      id: q.id,
      position: q.position,
      number: q.number,
      statement: q.statement,
      imageUrls: q.imageUrls,
      subject: q.subject,
      area: q.area,
      alternatives: q.alts,
      chosenLetter: chosen.get(q.id) ?? null,
      correctLetter: q.correctLetter,
      outcome: outcomeOf(q, chosen.get(q.id) ?? null),
      timeSpentMs: rows.get(q.id)?.timeSpentMs ?? 0,
      resolution: q.resolution,
      hasIrtParams: q.params !== null,
    })),
  };
}

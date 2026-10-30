import { and, asc, count, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import {
  DIFFICULTY_B_THRESHOLDS,
  difficultyFromB,
  type QuestionFilter,
  type QuestionListResponse,
  type QuestionSummary,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { publicUrls } from '../../lib/storage.js';

const { questions, exams, institutions, subjects, alternatives, questionTopics, topics } = schema;

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString('base64url');
}
export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  const n = Number(Buffer.from(cursor, 'base64url').toString());
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Condição "questão tem o assunto X (ou um filho dele)". */
export function topicCondition(topicId: string): SQL {
  return sql`exists (
    select 1 from ${questionTopics} qt join ${topics} t on t.id = qt.topic_id
    where qt.question_id = ${questions.id} and (t.id = ${topicId} or t.parent_id = ${topicId})
  )`;
}

export function difficultyCondition(d: 'easy' | 'medium' | 'hard'): SQL | undefined {
  const { easyMax, hardMin } = DIFFICULTY_B_THRESHOLDS;
  if (d === 'easy') return lt(questions.irtB, easyMax);
  if (d === 'hard') return gte(questions.irtB, hardMin);
  return and(gte(questions.irtB, easyMax), lt(questions.irtB, hardMin));
}

export interface ListContext {
  userId: string | null;
  /** reviewer/admin podem ver outros status */
  canSeeAllStatuses: boolean;
}

export async function listQuestions(
  f: QuestionFilter,
  ctx: ListContext,
): Promise<QuestionListResponse> {
  const conds: (SQL | undefined)[] = [];

  if (ctx.canSeeAllStatuses && f.status) conds.push(eq(questions.status, f.status));
  else conds.push(eq(questions.status, 'published'));

  if (f.institutionId) conds.push(eq(exams.institutionId, f.institutionId));
  if (f.year) conds.push(eq(exams.year, f.year));
  if (f.subjectId) conds.push(eq(questions.subjectId, f.subjectId));
  if (f.topicId) conds.push(topicCondition(f.topicId));
  if (f.q) conds.push(sql`${questions.search} @@ websearch_to_tsquery('portuguese', ${f.q})`);
  if (f.difficulty) conds.push(difficultyCondition(f.difficulty));

  if (ctx.userId) {
    const uid = ctx.userId;
    if (f.onlyUnanswered) {
      conds.push(sql`not exists (
        select 1 from ${schema.answers} a where a.user_id = ${uid} and a.question_id = ${questions.id}
      )`);
    }
    if (f.onlyWrong) {
      conds.push(sql`(
        select a.is_correct from ${schema.answers} a
        where a.user_id = ${uid} and a.question_id = ${questions.id}
        order by a.answered_at desc limit 1
      ) = false`);
    }
    if (f.onlySaved) {
      conds.push(sql`exists (
        select 1 from ${schema.savedQuestions} s where s.user_id = ${uid} and s.question_id = ${questions.id}
      )`);
    }
  }

  const where = and(...conds);
  const offset = decodeCursor(f.cursor);

  const orderBy = f.q
    ? [
        desc(sql`ts_rank(${questions.search}, websearch_to_tsquery('portuguese', ${f.q}))`),
        desc(exams.year),
        asc(questions.id),
      ]
    : [desc(exams.year), asc(exams.label), asc(questions.number), asc(questions.id)];

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: questions.id,
        number: questions.number,
        statement: questions.statement,
        imageUrls: questions.imageUrls,
        status: questions.status,
        irtB: questions.irtB,
        sourceName: questions.sourceName,
        sourceUrl: questions.sourceUrl,
        sourceLicense: questions.sourceLicense,
        year: exams.year,
        institution: institutions.name,
        subject: subjects.name,
      })
      .from(questions)
      .innerJoin(exams, eq(exams.id, questions.examId))
      .innerJoin(institutions, eq(institutions.id, exams.institutionId))
      .leftJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(where)
      .orderBy(...orderBy)
      .limit(f.limit + 1)
      .offset(offset),
    db
      .select({ n: count() })
      .from(questions)
      .innerJoin(exams, eq(exams.id, questions.examId))
      .where(where),
  ]);

  const hasMore = rows.length > f.limit;
  const page = rows.slice(0, f.limit);
  const items = await hydrate(page, ctx.userId);
  return {
    items,
    nextCursor: hasMore ? encodeCursor(offset + f.limit) : null,
    total: totalRows[0]?.n ?? 0,
  };
}

interface BaseRow {
  id: string;
  number: number | null;
  statement: string;
  imageUrls: string[];
  status: 'draft' | 'reviewed' | 'published';
  irtB: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceLicense: string | null;
  year: number;
  institution: string;
  subject: string | null;
}

/** Anexa alternativas (sem gabarito), assuntos e estado do usuário. */
async function hydrate(rows: BaseRow[], userId: string | null): Promise<QuestionSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [alts, tps, answered, saved] = await Promise.all([
    db
      .select({
        questionId: alternatives.questionId,
        letter: alternatives.letter,
        text: alternatives.text,
        imageUrl: alternatives.imageUrl,
      })
      .from(alternatives)
      .where(inArray(alternatives.questionId, ids))
      .orderBy(asc(alternatives.letter)),
    db
      .select({ questionId: questionTopics.questionId, name: topics.name })
      .from(questionTopics)
      .innerJoin(topics, eq(topics.id, questionTopics.topicId))
      .where(inArray(questionTopics.questionId, ids)),
    userId
      ? db
          .selectDistinctOn([schema.answers.questionId], {
            questionId: schema.answers.questionId,
            isCorrect: schema.answers.isCorrect,
          })
          .from(schema.answers)
          .where(and(eq(schema.answers.userId, userId), inArray(schema.answers.questionId, ids)))
          .orderBy(schema.answers.questionId, desc(schema.answers.answeredAt))
      : Promise.resolve([]),
    userId
      ? db
          .select({ questionId: schema.savedQuestions.questionId })
          .from(schema.savedQuestions)
          .where(
            and(
              eq(schema.savedQuestions.userId, userId),
              inArray(schema.savedQuestions.questionId, ids),
            ),
          )
      : Promise.resolve([]),
  ]);

  const answeredMap = new Map(answered.map((a) => [a.questionId, a.isCorrect]));
  const savedSet = new Set(saved.map((s) => s.questionId));

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    institution: r.institution,
    year: r.year,
    subject: r.subject ?? 'Sem matéria',
    topics: tps.filter((t) => t.questionId === r.id).map((t) => t.name),
    statement: publicUrls(r.statement),
    imageUrls: r.imageUrls.map(publicUrls),
    // Nunca inclui is_correct aqui: o gabarito só sai em /answers, /check e /review.
    alternatives: alts
      .filter((a) => a.questionId === r.id)
      .map((a) => ({
        letter: a.letter,
        text: publicUrls(a.text),
        imageUrl: a.imageUrl ? publicUrls(a.imageUrl) : null,
      })),
    difficulty: difficultyFromB(r.irtB),
    source: r.sourceName
      ? { name: r.sourceName, url: r.sourceUrl, license: r.sourceLicense }
      : null,
    status: r.status,
    answered: answeredMap.has(r.id),
    wasCorrect: answeredMap.has(r.id) ? (answeredMap.get(r.id) ?? null) : null,
    saved: savedSet.has(r.id),
  }));
}

export async function getQuestion(id: string, ctx: ListContext): Promise<QuestionSummary | null> {
  const [row] = await db
    .select({
      id: questions.id,
      number: questions.number,
      statement: questions.statement,
      imageUrls: questions.imageUrls,
      status: questions.status,
      irtB: questions.irtB,
      sourceName: questions.sourceName,
      sourceUrl: questions.sourceUrl,
      sourceLicense: questions.sourceLicense,
      year: exams.year,
      institution: institutions.name,
      subject: subjects.name,
    })
    .from(questions)
    .innerJoin(exams, eq(exams.id, questions.examId))
    .innerJoin(institutions, eq(institutions.id, exams.institutionId))
    .leftJoin(subjects, eq(subjects.id, questions.subjectId))
    .where(eq(questions.id, id))
    .limit(1);
  if (!row) return null;
  if (row.status !== 'published' && !ctx.canSeeAllStatuses) return null;
  const [item] = await hydrate([row], ctx.userId);
  return item ?? null;
}

export async function setSaved(userId: string, questionId: string, saved: boolean) {
  if (saved) {
    await db.insert(schema.savedQuestions).values({ userId, questionId }).onConflictDoNothing();
  } else {
    await db
      .delete(schema.savedQuestions)
      .where(
        and(
          eq(schema.savedQuestions.userId, userId),
          eq(schema.savedQuestions.questionId, questionId),
        ),
      );
  }
}

export async function questionIsVisible(id: string, canSeeAll: boolean): Promise<boolean> {
  const [row] = await db
    .select({ status: questions.status })
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1);
  return Boolean(row && (row.status === 'published' || canSeeAll));
}

/**
 * Progresso por matéria (só questões publicadas). Respostas contam como nas estatísticas:
 * avulsas e de simulados finalizados (o autosave de simulado em andamento fica de fora).
 */
export async function getSubjectProgress(userId: string | null) {
  const answered = userId
    ? sql<number>`(count(distinct ${schema.answers.questionId}))::int`
    : sql<number>`0`;
  const correct = userId
    ? sql<number>`(count(distinct ${schema.answers.questionId}) filter (where ${schema.answers.isCorrect}))::int`
    : sql<number>`0`;

  const totals = await db
    .select({
      subjectId: subjects.id,
      slug: subjects.slug,
      name: subjects.name,
      area: subjects.area,
      total: sql<number>`count(*)::int`,
    })
    .from(subjects)
    .innerJoin(
      questions,
      and(eq(questions.subjectId, subjects.id), eq(questions.status, 'published')),
    )
    .groupBy(subjects.id)
    .orderBy(asc(subjects.position), asc(subjects.name));

  const bySubject = new Map<string, { answered: number; correct: number }>();
  if (userId) {
    const rows = await db
      .select({ subjectId: questions.subjectId, answered, correct })
      .from(schema.answers)
      .innerJoin(
        questions,
        and(eq(questions.id, schema.answers.questionId), eq(questions.status, 'published')),
      )
      .where(
        sql`${schema.answers.userId} = ${userId} and (${schema.answers.simuladoAttemptId} is null or exists (
          select 1 from ${schema.simuladoAttempts}
          where ${schema.simuladoAttempts.id} = ${schema.answers.simuladoAttemptId}
            and ${schema.simuladoAttempts.status} = 'finished'))`,
      )
      .groupBy(questions.subjectId);
    for (const r of rows) if (r.subjectId) bySubject.set(r.subjectId, r);
  }

  return totals.map((t) => ({
    ...t,
    answered: bySubject.get(t.subjectId)?.answered ?? 0,
    correct: bySubject.get(t.subjectId)?.correct ?? 0,
  }));
}

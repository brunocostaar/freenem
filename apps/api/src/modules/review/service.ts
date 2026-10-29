import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  ReviewListQuery,
  ReviewListResponse,
  ReviewPatch,
  ReviewQuestion,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { decodeCursor, encodeCursor } from '../questions/service.js';

const { questions, exams, institutions, subjects, alternatives, questionTopics, topics } = schema;

async function hydrate(
  rows: {
    id: string;
    number: number | null;
    statement: string;
    resolution: string | null;
    status: 'draft' | 'reviewed' | 'published';
    subjectId: string | null;
    subject: string | null;
    institution: string | null;
    year: number | null;
    examLabel: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    sourceLicense: string | null;
    externalId: string | null;
    irtB: number | null;
    updatedAt: Date;
  }[],
): Promise<ReviewQuestion[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [alts, tps] = await Promise.all([
    db
      .select()
      .from(alternatives)
      .where(inArray(alternatives.questionId, ids))
      .orderBy(asc(alternatives.letter)),
    db
      .select({ questionId: questionTopics.questionId, id: topics.id, name: topics.name })
      .from(questionTopics)
      .innerJoin(topics, eq(topics.id, questionTopics.topicId))
      .where(inArray(questionTopics.questionId, ids)),
  ]);
  return rows.map((r) => {
    const mine = tps.filter((t) => t.questionId === r.id);
    return {
      id: r.id,
      number: r.number,
      institution: r.institution ?? '—',
      year: r.year,
      examLabel: r.examLabel,
      subjectId: r.subjectId,
      subject: r.subject,
      topicIds: mine.map((t) => t.id),
      topics: mine.map((t) => t.name),
      statement: r.statement,
      resolution: r.resolution,
      status: r.status,
      alternatives: alts
        .filter((a) => a.questionId === r.id)
        .map((a) => ({
          letter: a.letter,
          text: a.text,
          imageUrl: a.imageUrl,
          isCorrect: a.isCorrect,
        })),
      source: r.sourceName
        ? { name: r.sourceName, url: r.sourceUrl, license: r.sourceLicense }
        : null,
      externalId: r.externalId,
      irtB: r.irtB,
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

const baseSelect = {
  id: questions.id,
  number: questions.number,
  statement: questions.statement,
  resolution: questions.resolution,
  status: questions.status,
  subjectId: questions.subjectId,
  subject: subjects.name,
  institution: institutions.name,
  year: exams.year,
  examLabel: exams.label,
  sourceName: questions.sourceName,
  sourceUrl: questions.sourceUrl,
  sourceLicense: questions.sourceLicense,
  externalId: questions.externalId,
  irtB: questions.irtB,
  updatedAt: questions.updatedAt,
};

function baseQuery() {
  return db
    .select(baseSelect)
    .from(questions)
    .leftJoin(exams, eq(exams.id, questions.examId))
    .leftJoin(institutions, eq(institutions.id, exams.institutionId))
    .leftJoin(subjects, eq(subjects.id, questions.subjectId));
}

export async function listForReview(f: ReviewListQuery): Promise<ReviewListResponse> {
  const conds: (SQL | undefined)[] = [eq(questions.status, f.status)];
  if (f.year) conds.push(eq(exams.year, f.year));
  if (f.subjectId) conds.push(eq(questions.subjectId, f.subjectId));
  if (f.q) conds.push(sql`${questions.search} @@ websearch_to_tsquery('portuguese', ${f.q})`);
  const where = and(...conds);
  const offset = decodeCursor(f.cursor);

  const [rows, total] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(desc(exams.year), asc(questions.number), asc(questions.id))
      .limit(f.limit + 1)
      .offset(offset),
    db
      .select({ n: count() })
      .from(questions)
      .leftJoin(exams, eq(exams.id, questions.examId))
      .where(where),
  ]);
  const page = rows.slice(0, f.limit);
  return {
    items: await hydrate(page),
    nextCursor: rows.length > f.limit ? encodeCursor(offset + f.limit) : null,
    total: total[0]?.n ?? 0,
  };
}

export async function getForReview(id: string): Promise<ReviewQuestion | null> {
  const rows = await baseQuery().where(eq(questions.id, id)).limit(1);
  const [item] = await hydrate(rows);
  return item ?? null;
}

export type PatchResult =
  { ok: true } | { ok: false; code: 'NOT_FOUND' | 'INVALID'; message: string };

export async function patchQuestion(
  id: string,
  patch: ReviewPatch,
  reviewerId: string,
): Promise<PatchResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(questions).where(eq(questions.id, id)).limit(1);
    if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'Questão não encontrada.' };

    const current = await tx.select().from(alternatives).where(eq(alternatives.questionId, id));
    const nextLetters = patch.alternatives
      ? patch.alternatives.map((a) => a.letter)
      : current.map((a) => a.letter);
    if (new Set(nextLetters).size !== nextLetters.length) {
      return { ok: false, code: 'INVALID', message: 'Letras de alternativas repetidas.' };
    }
    const nextCorrect = patch.correctLetter ?? current.find((a) => a.isCorrect)?.letter;
    if (!nextCorrect || !nextLetters.includes(nextCorrect)) {
      return { ok: false, code: 'INVALID', message: 'O gabarito deve ser uma das alternativas.' };
    }
    if (patch.status && patch.status !== 'draft' && existing.status === 'draft') {
      // Ao liberar uma questão exige-se um conjunto completo A–E.
      if (nextLetters.length < 5) {
        return {
          ok: false,
          code: 'INVALID',
          message: 'Publique apenas questões com 5 alternativas.',
        };
      }
    }

    if (patch.alternatives || patch.correctLetter) {
      const byLetter = new Map(current.map((a) => [a.letter, a]));
      const incoming = patch.alternatives ?? current;
      // remove as que saíram, atualiza/insere as demais
      const removed = current.filter((a) => !nextLetters.includes(a.letter)).map((a) => a.id);
      if (removed.length) await tx.delete(alternatives).where(inArray(alternatives.id, removed));
      for (const a of incoming) {
        const prev = byLetter.get(a.letter);
        const imageUrl = 'imageUrl' in a ? (a.imageUrl ?? null) : (prev?.imageUrl ?? null);
        const values = {
          questionId: id,
          letter: a.letter,
          text: a.text,
          imageUrl,
          isCorrect: a.letter === nextCorrect,
        };
        await tx
          .insert(alternatives)
          .values(values)
          .onConflictDoUpdate({
            target: [alternatives.questionId, alternatives.letter],
            set: { text: values.text, imageUrl: values.imageUrl, isCorrect: values.isCorrect },
          });
      }
    }

    if (patch.topicIds) {
      await tx.delete(questionTopics).where(eq(questionTopics.questionId, id));
      const unique = [...new Set(patch.topicIds)];
      if (unique.length) {
        await tx
          .insert(questionTopics)
          .values(unique.map((topicId) => ({ questionId: id, topicId })));
      }
    }

    const reviewedNow = patch.status !== undefined && patch.status !== 'draft';
    await tx
      .update(questions)
      .set({
        ...(patch.statement !== undefined ? { statement: patch.statement } : {}),
        ...(patch.resolution !== undefined ? { resolution: patch.resolution || null } : {}),
        ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(reviewedNow ? { reviewedBy: reviewerId, reviewedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id));
    return { ok: true };
  });
}

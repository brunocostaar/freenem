import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type {
  MyResolutions,
  Resolution,
  ResolutionListResponse,
  ResolutionModeration,
  ResolutionReviewList,
  ResolutionStatus,
  VoteResolutionResponse,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { sanitizeResolutionBody } from './sanitize.js';

const {
  questionResolutions: R,
  resolutionVotes: V,
  questions,
  exams,
  institutions,
  subjects,
  user,
} = schema;

type Row = typeof R.$inferSelect & { authorName: string; myVote: number | null };

function toResolution(r: Row, viewerId: string | null): Resolution {
  return {
    id: r.id,
    body: r.body,
    status: r.status,
    rejectReason: r.rejectReason,
    score: r.score,
    authorName: r.authorName,
    mine: viewerId === r.authorId,
    myVote: r.myVote ?? 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function selectWithViewer(viewerId: string | null) {
  return db
    .select({
      id: R.id,
      questionId: R.questionId,
      authorId: R.authorId,
      body: R.body,
      status: R.status,
      rejectReason: R.rejectReason,
      score: R.score,
      createdAt: R.createdAt,
      updatedAt: R.updatedAt,
      moderatedBy: R.moderatedBy,
      moderatedAt: R.moderatedAt,
      authorName: user.name,
      myVote: viewerId
        ? sql<
            number | null
          >`(select ${V.value} from ${V} where ${V.resolutionId} = ${R.id} and ${V.userId} = ${viewerId})`
        : sql<number | null>`null`,
    })
    .from(R)
    .innerJoin(user, eq(user.id, R.authorId));
}

/** A questão existe e o usuário pode vê-la (publicadas; revisores veem todas). */
export async function questionAccessible(questionId: string, canSeeAll: boolean) {
  const [q] = await db
    .select({ status: questions.status })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  return Boolean(q && (q.status === 'published' || canSeeAll));
}

export async function listResolutions(
  questionId: string,
  viewerId: string | null,
): Promise<ResolutionListResponse> {
  const approved = await selectWithViewer(viewerId)
    .where(and(eq(R.questionId, questionId), eq(R.status, 'approved')))
    .orderBy(desc(R.score), desc(R.createdAt));
  let mine: Resolution | null = null;
  if (viewerId) {
    const [own] = await selectWithViewer(viewerId).where(
      and(eq(R.questionId, questionId), eq(R.authorId, viewerId)),
    );
    if (own && own.status !== 'approved') mine = toResolution(own, viewerId);
  }
  return { items: approved.map((r) => toResolution(r, viewerId)), mine };
}

async function getOwn(questionId: string, userId: string) {
  const [row] = await selectWithViewer(userId).where(
    and(eq(R.questionId, questionId), eq(R.authorId, userId)),
  );
  return row;
}

export type WriteResult =
  { ok: true; resolution: Resolution } | { ok: false; code: 'EMPTY' | 'DUPLICATE' | 'NOT_FOUND' };

export async function createResolution(
  userId: string,
  questionId: string,
  rawBody: string,
): Promise<WriteResult> {
  const body = sanitizeResolutionBody(rawBody);
  if (body.length < 20) return { ok: false, code: 'EMPTY' };
  const inserted = await db
    .insert(R)
    .values({ questionId, authorId: userId, body })
    .onConflictDoNothing()
    .returning({ id: R.id });
  if (inserted.length === 0) return { ok: false, code: 'DUPLICATE' };
  const row = await getOwn(questionId, userId);
  return { ok: true, resolution: toResolution(row!, userId) };
}

/** Edita a própria resolução: volta para análise. */
export async function updateResolution(
  userId: string,
  resolutionId: string,
  rawBody: string,
): Promise<WriteResult> {
  const body = sanitizeResolutionBody(rawBody);
  if (body.length < 20) return { ok: false, code: 'EMPTY' };
  const updated = await db
    .update(R)
    .set({
      body,
      status: 'pending',
      rejectReason: null,
      moderatedBy: null,
      moderatedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(R.id, resolutionId), eq(R.authorId, userId)))
    .returning({ questionId: R.questionId });
  const q = updated[0];
  if (!q) return { ok: false, code: 'NOT_FOUND' };
  const row = await getOwn(q.questionId, userId);
  return { ok: true, resolution: toResolution(row!, userId) };
}

export async function deleteResolution(userId: string, resolutionId: string): Promise<boolean> {
  const rows = await db
    .delete(R)
    .where(and(eq(R.id, resolutionId), eq(R.authorId, userId)))
    .returning({ id: R.id });
  return rows.length > 0;
}

export type VoteResult =
  { ok: true; vote: VoteResolutionResponse } | { ok: false; code: 'NOT_FOUND' | 'OWN' };

/** Vota (ou remove o voto ao repetir o mesmo valor); recalcula o score na mesma transação. */
export async function voteResolution(
  userId: string,
  resolutionId: string,
  value: 1 | -1,
): Promise<VoteResult> {
  return db.transaction(async (tx) => {
    // trava a linha para serializar votos concorrentes na mesma resolução
    const [r] = await tx
      .select({ authorId: R.authorId, status: R.status })
      .from(R)
      .where(eq(R.id, resolutionId))
      .for('update');
    if (!r || r.status !== 'approved') return { ok: false, code: 'NOT_FOUND' } as const;
    if (r.authorId === userId) return { ok: false, code: 'OWN' } as const;

    const [existing] = await tx
      .select({ value: V.value })
      .from(V)
      .where(and(eq(V.resolutionId, resolutionId), eq(V.userId, userId)));
    let myVote: number = value;
    if (existing && existing.value === value) {
      await tx.delete(V).where(and(eq(V.resolutionId, resolutionId), eq(V.userId, userId)));
      myVote = 0;
    } else if (existing) {
      await tx
        .update(V)
        .set({ value })
        .where(and(eq(V.resolutionId, resolutionId), eq(V.userId, userId)));
    } else {
      await tx.insert(V).values({ resolutionId, userId, value });
    }
    const [sum] = await tx
      .select({ s: sql<number>`coalesce(sum(${V.value}), 0)::int` })
      .from(V)
      .where(eq(V.resolutionId, resolutionId));
    const score = sum?.s ?? 0;
    await tx.update(R).set({ score }).where(eq(R.id, resolutionId));
    return { ok: true, vote: { score, myVote } } as const;
  });
}

function excerpt(md: string, n = 140): string {
  const plain = md
    .replace(/[*_`#>$\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > n ? `${plain.slice(0, n)}…` : plain;
}

export async function myResolutions(userId: string): Promise<MyResolutions> {
  const rows = await db
    .select({
      id: R.id,
      questionId: R.questionId,
      status: R.status,
      score: R.score,
      body: R.body,
      updatedAt: R.updatedAt,
      institution: institutions.name,
      year: exams.year,
      number: questions.number,
    })
    .from(R)
    .innerJoin(questions, eq(questions.id, R.questionId))
    .leftJoin(exams, eq(exams.id, questions.examId))
    .leftJoin(institutions, eq(institutions.id, exams.institutionId))
    .where(eq(R.authorId, userId))
    .orderBy(desc(R.updatedAt))
    .limit(100);
  const n = (s: ResolutionStatus) => rows.filter((r) => r.status === s).length;
  return {
    pending: n('pending'),
    approved: n('approved'),
    rejected: n('rejected'),
    total: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      status: r.status,
      score: r.score,
      excerpt: excerpt(r.body, 100),
      institution: r.institution ?? '—',
      year: r.year,
      number: r.number,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

/* ---------------------------------- moderação --------------------------------- */

export async function listForModeration(
  status: ResolutionStatus,
  limit: number,
): Promise<ResolutionReviewList> {
  const [pendingRow] = await db.select({ n: count() }).from(R).where(eq(R.status, 'pending'));
  const rows = await db
    .select({
      id: R.id,
      body: R.body,
      status: R.status,
      rejectReason: R.rejectReason,
      score: R.score,
      createdAt: R.createdAt,
      updatedAt: R.updatedAt,
      authorName: user.name,
      qId: questions.id,
      qNumber: questions.number,
      qStatement: questions.statement,
      qStatus: questions.status,
      qResolution: questions.resolution,
      subject: subjects.name,
      institution: institutions.name,
      year: exams.year,
    })
    .from(R)
    .innerJoin(user, eq(user.id, R.authorId))
    .innerJoin(questions, eq(questions.id, R.questionId))
    .leftJoin(exams, eq(exams.id, questions.examId))
    .leftJoin(institutions, eq(institutions.id, exams.institutionId))
    .leftJoin(subjects, eq(subjects.id, questions.subjectId))
    .where(eq(R.status, status))
    // fila: mais antigas primeiro; demais: mais recentes
    .orderBy(status === 'pending' ? R.updatedAt : desc(R.updatedAt))
    .limit(limit);

  const qIds = [...new Set(rows.map((r) => r.qId))];
  const correct = qIds.length
    ? await db
        .select({ questionId: schema.alternatives.questionId, letter: schema.alternatives.letter })
        .from(schema.alternatives)
        .where(
          and(
            inArray(schema.alternatives.questionId, qIds),
            eq(schema.alternatives.isCorrect, true),
          ),
        )
    : [];

  return {
    pendingTotal: pendingRow?.n ?? 0,
    items: rows.map((r) => ({
      id: r.id,
      body: r.body,
      status: r.status,
      rejectReason: r.rejectReason,
      score: r.score,
      authorName: r.authorName,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      question: {
        id: r.qId,
        number: r.qNumber,
        institution: r.institution ?? '—',
        year: r.year,
        subject: r.subject,
        status: r.qStatus,
        statement: r.qStatement,
        correctLetter: correct.find((c) => c.questionId === r.qId)?.letter ?? null,
        hasOfficialResolution: Boolean(r.qResolution),
      },
    })),
  };
}

export type ModerateResult = { ok: true } | { ok: false; code: 'NOT_FOUND' | 'NOT_APPROVED' };

export async function moderateResolution(
  id: string,
  reviewerId: string,
  action: ResolutionModeration,
): Promise<ModerateResult> {
  return db.transaction(async (tx) => {
    const [r] = await tx
      .select({ status: R.status, body: R.body, questionId: R.questionId })
      .from(R)
      .where(eq(R.id, id))
      .for('update');
    if (!r) return { ok: false, code: 'NOT_FOUND' } as const;
    if (action.action === 'promote') {
      if (r.status !== 'approved') return { ok: false, code: 'NOT_APPROVED' } as const;
      await tx
        .update(questions)
        .set({ resolution: r.body, updatedAt: new Date() })
        .where(eq(questions.id, r.questionId));
      return { ok: true } as const;
    }
    const now = new Date();
    await tx
      .update(R)
      .set(
        action.action === 'approve'
          ? { status: 'approved', rejectReason: null, moderatedBy: reviewerId, moderatedAt: now }
          : {
              status: 'rejected',
              rejectReason: action.reason,
              moderatedBy: reviewerId,
              moderatedAt: now,
            },
      )
      .where(eq(R.id, id));
    return { ok: true } as const;
  });
}

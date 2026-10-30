import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  AUTO_HIDE_REPORT_KINDS,
  AUTO_HIDE_REPORT_THRESHOLD,
  type CreateReport,
  type ReportGroup,
  type ReportListQuery,
  type ReportListResponse,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';

const { questionReports, questions, exams, institutions, subjects, user } = schema;

export type CreateReportResult =
  { ok: true; id: string } | { ok: false; code: 'NOT_FOUND' | 'DUPLICATE' };

/** Registra o reporte; ao atingir o limiar de reportes graves, esconde a questão (rascunho). */
export async function createReport(
  userId: string,
  questionId: string,
  input: CreateReport,
): Promise<CreateReportResult> {
  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!q) return { ok: false, code: 'NOT_FOUND' };

  const inserted = await db
    .insert(questionReports)
    .values({ questionId, userId, kind: input.kind, message: input.message })
    .onConflictDoNothing()
    .returning({ id: questionReports.id });
  const row = inserted[0];
  if (!row) return { ok: false, code: 'DUPLICATE' };

  if (AUTO_HIDE_REPORT_KINDS.includes(input.kind)) {
    const [counted] = await db
      .select({ n: count() })
      .from(questionReports)
      .where(
        and(
          eq(questionReports.questionId, questionId),
          eq(questionReports.status, 'open'),
          inArray(questionReports.kind, [...AUTO_HIDE_REPORT_KINDS]),
        ),
      );
    if ((counted?.n ?? 0) >= AUTO_HIDE_REPORT_THRESHOLD) {
      await db
        .update(questions)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(and(eq(questions.id, questionId), sql`${questions.status} <> 'draft'`));
    }
  }
  return { ok: true, id: row.id };
}

function excerpt(md: string, n = 140): string {
  const plain = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[imagem]')
    .replace(/[*_`#>$\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > n ? `${plain.slice(0, n)}…` : plain;
}

export async function listReports(f: ReportListQuery): Promise<ReportListResponse> {
  const [openTotalRow] = await db
    .select({ n: count() })
    .from(questionReports)
    .where(eq(questionReports.status, 'open'));

  // questões com reportes no status pedido, mais recentes primeiro
  const qRows = await db
    .select({ questionId: questionReports.questionId })
    .from(questionReports)
    .where(eq(questionReports.status, f.status))
    .groupBy(questionReports.questionId)
    .orderBy(desc(sql`max(${questionReports.createdAt})`))
    .limit(f.limit);
  const ids = qRows.map((r) => r.questionId);
  if (ids.length === 0) return { groups: [], openTotal: openTotalRow?.n ?? 0 };

  const [qs, reps, opens] = await Promise.all([
    db
      .select({
        id: questions.id,
        number: questions.number,
        statement: questions.statement,
        status: questions.status,
        subject: subjects.name,
        institution: institutions.name,
        year: exams.year,
      })
      .from(questions)
      .leftJoin(exams, eq(exams.id, questions.examId))
      .leftJoin(institutions, eq(institutions.id, exams.institutionId))
      .leftJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(inArray(questions.id, ids)),
    db
      .select({
        id: questionReports.id,
        questionId: questionReports.questionId,
        kind: questionReports.kind,
        message: questionReports.message,
        status: questionReports.status,
        createdAt: questionReports.createdAt,
        resolvedAt: questionReports.resolvedAt,
        userName: user.name,
      })
      .from(questionReports)
      .innerJoin(user, eq(user.id, questionReports.userId))
      .where(and(inArray(questionReports.questionId, ids), eq(questionReports.status, f.status)))
      .orderBy(desc(questionReports.createdAt)),
    db
      .select({ questionId: questionReports.questionId, n: count() })
      .from(questionReports)
      .where(and(inArray(questionReports.questionId, ids), eq(questionReports.status, 'open')))
      .groupBy(questionReports.questionId),
  ]);

  const groups: ReportGroup[] = [];
  for (const id of ids) {
    const q = qs.find((x) => x.id === id);
    if (!q) continue;
    groups.push({
      question: {
        id: q.id,
        number: q.number,
        institution: q.institution ?? '—',
        year: q.year,
        subject: q.subject,
        status: q.status,
        excerpt: excerpt(q.statement),
      },
      openCount: opens.find((o) => o.questionId === id)?.n ?? 0,
      reports: reps
        .filter((r) => r.questionId === id)
        .map((r) => ({
          id: r.id,
          kind: r.kind,
          message: r.message,
          status: r.status,
          userName: r.userName,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
        })),
    });
  }
  return { groups, openTotal: openTotalRow?.n ?? 0 };
}

/** Resolve/descarta um reporte. Devolve false se não existir. */
export async function closeReport(
  id: string,
  status: 'resolved' | 'dismissed',
  reviewerId: string,
): Promise<boolean> {
  const rows = await db
    .update(questionReports)
    .set({ status, resolvedBy: reviewerId, resolvedAt: new Date() })
    .where(eq(questionReports.id, id))
    .returning({ id: questionReports.id });
  return rows.length > 0;
}

import { eq, inArray } from 'drizzle-orm';
import type { DataExport } from '@freenem/shared';
import { db, schema } from '../../db/index.js';

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

/** Reúne tudo o que o usuário produziu (LGPD, portabilidade). Sem hash de senha, tokens ou sessões. */
export async function buildDataExport(userId: string): Promise<DataExport> {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
  if (!u) throw new Error('Usuário não encontrado.');

  const [
    accounts,
    answers,
    saved,
    simulados,
    attempts,
    essayRows,
    plans,
    resolutions,
    votes,
    reports,
  ] = await Promise.all([
    db
      .select({ providerId: schema.account.providerId })
      .from(schema.account)
      .where(eq(schema.account.userId, userId)),
    db.select().from(schema.answers).where(eq(schema.answers.userId, userId)),
    db.select().from(schema.savedQuestions).where(eq(schema.savedQuestions.userId, userId)),
    db.select().from(schema.simulados).where(eq(schema.simulados.userId, userId)),
    db.select().from(schema.simuladoAttempts).where(eq(schema.simuladoAttempts.userId, userId)),
    db
      .select({
        essay: schema.essays,
        themeTitle: schema.essayThemes.title,
        correction: schema.essayCorrections,
      })
      .from(schema.essays)
      .innerJoin(schema.essayThemes, eq(schema.essayThemes.id, schema.essays.themeId))
      .leftJoin(schema.essayCorrections, eq(schema.essayCorrections.essayId, schema.essays.id))
      .where(eq(schema.essays.userId, userId)),
    db.select().from(schema.studyPlans).where(eq(schema.studyPlans.userId, userId)),
    db
      .select()
      .from(schema.questionResolutions)
      .where(eq(schema.questionResolutions.authorId, userId)),
    db.select().from(schema.resolutionVotes).where(eq(schema.resolutionVotes.userId, userId)),
    db.select().from(schema.questionReports).where(eq(schema.questionReports.userId, userId)),
  ]);

  const planIds = plans.map((p) => p.id);
  const items = planIds.length
    ? await db
        .select()
        .from(schema.studyPlanItems)
        .where(inArray(schema.studyPlanItems.planId, planIds))
    : [];

  return {
    exportedAt: iso(new Date()),
    profile: {
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      image: u.image,
      role: u.role,
      createdAt: iso(u.createdAt),
      updatedAt: iso(u.updatedAt),
      loginProviders: accounts.map((a) => a.providerId),
    },
    answers: answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      chosenLetter: a.chosenLetter,
      isCorrect: a.isCorrect,
      timeSpentMs: a.timeSpentMs,
      simuladoAttemptId: a.simuladoAttemptId,
      answeredAt: iso(a.answeredAt),
    })),
    savedQuestions: saved.map((s) => ({ questionId: s.questionId, createdAt: iso(s.createdAt) })),
    simulados: simulados.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      questionCount: s.questionCount,
      timeLimitMinutes: s.timeLimitMinutes,
      createdAt: iso(s.createdAt),
    })),
    simuladoAttempts: attempts.map((a) => ({
      id: a.id,
      simuladoId: a.simuladoId,
      status: a.status,
      startedAt: iso(a.startedAt),
      finishedAt: isoOrNull(a.finishedAt),
      rawScore: a.rawScore,
      triScore: a.triScore,
    })),
    essays: essayRows.map((r) => ({
      id: r.essay.id,
      themeId: r.essay.themeId,
      themeTitle: r.themeTitle,
      text: r.essay.text,
      status: r.essay.status,
      createdAt: iso(r.essay.createdAt),
      correction: r.correction
        ? {
            totalScore: r.correction.totalScore,
            c1: r.correction.c1,
            c2: r.correction.c2,
            c3: r.correction.c3,
            c4: r.correction.c4,
            c5: r.correction.c5,
            feedback: r.correction.feedback ?? null,
            model: r.correction.model,
            createdAt: iso(r.correction.createdAt),
          }
        : null,
    })),
    studyPlans: plans.map((p) => ({
      id: p.id,
      examDate: p.examDate,
      hoursPerWeek: p.hoursPerWeek,
      availableDays: p.availableDays,
      active: p.active,
      createdAt: iso(p.createdAt),
      items: items
        .filter((i) => i.planId === p.id)
        .map((i) => ({
          id: i.id,
          topicId: i.topicId,
          week: i.week,
          kind: i.kind,
          done: i.done,
          doneAt: isoOrNull(i.doneAt),
          notes: i.notes,
        })),
    })),
    resolutions: resolutions.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      body: r.body,
      status: r.status,
      rejectReason: r.rejectReason,
      score: r.score,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    })),
    resolutionVotes: votes.map((v) => ({
      resolutionId: v.resolutionId,
      value: v.value,
      createdAt: iso(v.createdAt),
    })),
    reports: reports.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      kind: r.kind,
      message: r.message,
      status: r.status,
      createdAt: iso(r.createdAt),
    })),
  };
}

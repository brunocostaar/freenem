import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  ITEM_MINUTES,
  type EnemArea,
  type StudyPlan,
  type StudyPlanCreate,
  type StudyPlanItem,
  type StudyPlanWeek,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { saoPauloDate } from '../stats/dates.js';
import { topicStats } from '../stats/service.js';
import {
  diffDays,
  generateTopicItems,
  layoutWeeks,
  type GenTopic,
  type TopicItemKind,
} from './generator.js';

const { studyPlans, studyPlanItems, topics, subjects, questions, questionTopics } = schema;

const KIND_ORDER: Record<string, number> = { theory: 0, questions: 1, review: 2 };

type PlanRow = typeof studyPlans.$inferSelect;

/** Tópicos candidatos + incidência (questões publicadas) + desempenho do aluno. */
async function loadGenTopics(userId: string): Promise<GenTopic[]> {
  const [topicRows, incidenceRows, stats] = await Promise.all([
    db
      .select({
        id: topics.id,
        area: subjects.area,
        hasChildren: sql<boolean>`exists (select 1 from ${topics} c where c.parent_id = ${topics.id})`,
      })
      .from(topics)
      .innerJoin(subjects, eq(subjects.id, topics.subjectId)),
    db
      .select({ topicId: questionTopics.topicId, n: sql<number>`count(*)::int` })
      .from(questionTopics)
      .innerJoin(questions, eq(questions.id, questionTopics.questionId))
      .where(eq(questions.status, 'published'))
      .groupBy(questionTopics.topicId),
    topicStats(userId),
  ]);
  const incidence = new Map(incidenceRows.map((r) => [r.topicId, r.n]));
  const perf = new Map(stats.map((s) => [s.topicId, s]));
  return topicRows
    .filter((t) => !t.hasChildren || (incidence.get(t.id) ?? 0) > 0)
    .map((t) => ({
      topicId: t.id,
      area: t.area,
      incidence: incidence.get(t.id) ?? 0,
      answered: perf.get(t.id)?.total ?? 0,
      correct: perf.get(t.id)?.correct ?? 0,
    }));
}

export async function createPlan(
  app: FastifyInstance,
  userId: string,
  body: StudyPlanCreate,
): Promise<StudyPlan> {
  const today = saoPauloDate();
  if (diffDays(today, body.examDate) < 1) {
    throw app.httpErrors.badRequest('A data da prova precisa estar no futuro.');
  }
  const genTopics = await loadGenTopics(userId);
  const availableDays = [...new Set(body.availableDays)].sort((a, b) => a - b);
  const items = generateTopicItems({
    startDate: today,
    examDate: body.examDate,
    hoursPerWeek: body.hoursPerWeek,
    availableDays,
    focusAreas: body.focusAreas,
    topics: genTopics,
  });
  const planId = await db.transaction(async (tx) => {
    await tx.delete(studyPlans).where(eq(studyPlans.userId, userId));
    const [plan] = await tx
      .insert(studyPlans)
      .values({
        userId,
        examDate: body.examDate,
        hoursPerWeek: body.hoursPerWeek,
        availableDays,
      })
      .returning({ id: studyPlans.id });
    for (let i = 0; i < items.length; i += 500) {
      await tx.insert(studyPlanItems).values(
        items.slice(i, i + 500).map((it) => ({
          planId: plan!.id,
          topicId: it.topicId,
          week: it.week,
          kind: it.kind,
        })),
      );
    }
    return plan!.id;
  });
  const view = await viewPlan(userId, planId);
  return view!;
}

async function activePlan(userId: string): Promise<PlanRow | undefined> {
  const [plan] = await db
    .select()
    .from(studyPlans)
    .where(and(eq(studyPlans.userId, userId), eq(studyPlans.active, true)))
    .orderBy(desc(studyPlans.createdAt))
    .limit(1);
  return plan;
}

export async function getPlan(userId: string): Promise<StudyPlan | null> {
  const plan = await activePlan(userId);
  return plan ? viewPlan(userId, plan.id) : null;
}

async function viewPlan(userId: string, planId: string): Promise<StudyPlan | null> {
  const [plan] = await db.select().from(studyPlans).where(eq(studyPlans.id, planId)).limit(1);
  if (!plan) return null;
  const today = saoPauloDate();
  const startDate = saoPauloDate(plan.createdAt);
  const layout = layoutWeeks({
    startDate,
    examDate: plan.examDate,
    hoursPerWeek: plan.hoursPerWeek,
  });
  const totalWeeks = layout.length;
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.floor(diffDays(startDate, today) / 7) + 1),
  );

  const [rows, essayRows, attemptRows] = await Promise.all([
    db
      .select({
        id: studyPlanItems.id,
        week: studyPlanItems.week,
        kind: studyPlanItems.kind,
        done: studyPlanItems.done,
        topicId: topics.id,
        topicName: topics.name,
        subjectName: subjects.name,
        area: subjects.area,
      })
      .from(studyPlanItems)
      .innerJoin(topics, eq(topics.id, studyPlanItems.topicId))
      .innerJoin(subjects, eq(subjects.id, topics.subjectId))
      .where(eq(studyPlanItems.planId, plan.id)),
    db
      .select({ at: schema.essays.createdAt })
      .from(schema.essays)
      .where(and(eq(schema.essays.userId, userId), sql`${schema.essays.status} <> 'failed'`)),
    db
      .select({ at: schema.simuladoAttempts.finishedAt })
      .from(schema.simuladoAttempts)
      .where(
        and(
          eq(schema.simuladoAttempts.userId, userId),
          eq(schema.simuladoAttempts.status, 'finished'),
        ),
      ),
  ]);
  const essayDays = essayRows.map((r) => saoPauloDate(r.at));
  const attemptDays = attemptRows.flatMap((r) => (r.at ? [saoPauloDate(r.at)] : []));
  const within = (days: string[], from: string, to: string) =>
    days.some((d) => d >= from && d <= to);

  const weeks: StudyPlanWeek[] = layout.map((l) => {
    const items: StudyPlanItem[] = rows
      .filter((r) => r.week === l.week)
      .sort(
        (a, b) =>
          (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
          a.subjectName.localeCompare(b.subjectName) ||
          a.topicName.localeCompare(b.topicName),
      )
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        topicId: r.topicId,
        topicName: r.topicName,
        subjectName: r.subjectName,
        area: r.area as EnemArea,
        week: r.week,
        minutes: ITEM_MINUTES[r.kind],
        done: r.done,
        auto: false,
        href: `/questoes?topicId=${r.topicId}`,
      }));
    if (l.simuladoMinutes > 0) {
      items.push({
        id: `simulado-${l.week}`,
        kind: 'simulado',
        topicId: null,
        topicName: null,
        subjectName: null,
        area: null,
        week: l.week,
        minutes: l.simuladoMinutes,
        done: within(attemptDays, l.startDate, l.endDate),
        auto: true,
        href: '/simulados',
      });
    }
    if (l.essayMinutes > 0) {
      items.push({
        id: `essay-${l.week}`,
        kind: 'essay',
        topicId: null,
        topicName: null,
        subjectName: null,
        area: null,
        week: l.week,
        minutes: l.essayMinutes,
        done: within(essayDays, l.startDate, l.endDate),
        auto: true,
        href: '/redacao',
      });
    }
    return {
      week: l.week,
      startDate: l.startDate,
      endDate: l.endDate,
      isCurrent: l.week === currentWeek,
      budgetMinutes: l.budgetMinutes,
      plannedMinutes: items.reduce((s, i) => s + i.minutes, 0),
      items,
    };
  });

  const all = weeks.flatMap((w) => w.items);
  return {
    id: plan.id,
    examDate: plan.examDate,
    startDate,
    hoursPerWeek: plan.hoursPerWeek,
    availableDays: plan.availableDays,
    currentWeek,
    totalWeeks,
    daysUntilExam: Math.max(0, diffDays(today, plan.examDate)),
    progress: { done: all.filter((i) => i.done).length, total: all.length },
    weeks,
  };
}

/**
 * Regenera as semanas futuras (a partir da atual) com o desempenho mais recente,
 * mantendo os itens já concluídos e as semanas passadas.
 */
export async function rebalancePlan(
  app: FastifyInstance,
  userId: string,
  focusAreas?: EnemArea[],
): Promise<StudyPlan> {
  const plan = await activePlan(userId);
  if (!plan) throw app.httpErrors.notFound('Você ainda não tem um plano de estudos.');
  const today = saoPauloDate();
  const startDate = saoPauloDate(plan.createdAt);
  const layout = layoutWeeks({
    startDate,
    examDate: plan.examDate,
    hoursPerWeek: plan.hoursPerWeek,
  });
  const currentWeek = Math.min(
    layout.length,
    Math.max(1, Math.floor(diffDays(startDate, today) / 7) + 1),
  );

  const [genTopics, doneRows] = await Promise.all([
    loadGenTopics(userId),
    db
      .select({
        topicId: studyPlanItems.topicId,
        kind: studyPlanItems.kind,
        week: studyPlanItems.week,
      })
      .from(studyPlanItems)
      .where(and(eq(studyPlanItems.planId, plan.id), eq(studyPlanItems.done, true))),
  ]);
  const items = generateTopicItems({
    startDate,
    examDate: plan.examDate,
    hoursPerWeek: plan.hoursPerWeek,
    availableDays: plan.availableDays,
    focusAreas,
    topics: genTopics,
    fromWeek: currentWeek,
    done: doneRows as { topicId: string; kind: TopicItemKind; week: number }[],
  });
  await db.transaction(async (tx) => {
    await tx
      .delete(studyPlanItems)
      .where(
        and(
          eq(studyPlanItems.planId, plan.id),
          eq(studyPlanItems.done, false),
          sql`${studyPlanItems.week} >= ${currentWeek}`,
        ),
      );
    for (let i = 0; i < items.length; i += 500) {
      await tx.insert(studyPlanItems).values(
        items.slice(i, i + 500).map((it) => ({
          planId: plan.id,
          topicId: it.topicId,
          week: it.week,
          kind: it.kind,
        })),
      );
    }
  });
  return (await viewPlan(userId, plan.id))!;
}

export async function setItemDone(
  app: FastifyInstance,
  userId: string,
  itemId: string,
  done: boolean,
): Promise<{ id: string; done: boolean }> {
  const owned = db
    .select({ id: studyPlans.id })
    .from(studyPlans)
    .where(eq(studyPlans.userId, userId));
  const [row] = await db
    .update(studyPlanItems)
    .set({ done, doneAt: done ? new Date() : null })
    .where(and(eq(studyPlanItems.id, itemId), inArray(studyPlanItems.planId, owned)))
    .returning({ id: studyPlanItems.id, done: studyPlanItems.done });
  if (!row) throw app.httpErrors.notFound('Item do plano não encontrado.');
  return row;
}

import { and, asc, avg, count, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import {
  MIN_TOPIC_SAMPLE,
  computeStreak,
  wilsonLowerBound,
  type AreaStat,
  type DailyActivity,
  type EnemArea,
  type EssayScore,
  type SimuladoScore,
  type StatsOverview,
  type StatsRange,
  type SubjectStat,
  type TopicStat,
} from '@freenem/shared';
import { db, schema } from '../../db/index.js';
import { saoPauloDate } from './dates.js';

const { answers, questions, subjects, topics, questionTopics } = schema;

/** literal inline (não parametrizado) para o Postgres tratar expressões idênticas como iguais no GROUP BY */
const TZ = sql.raw("'America/Sao_Paulo'");
/** teto por resposta ao estimar tempo de estudo (abas esquecidas abertas não contam) */
const MAX_TIME_PER_ANSWER_MS = 10 * 60_000;
const ACTIVITY_DAYS = 182;
const STREAK_LOOKBACK_DAYS = 400;
const RANK_LIMIT = 5;

const DAY_MS = 86_400_000;
const shiftDate = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Início do intervalo (data local YYYY-MM-DD) ou null para "tudo". */
export function rangeStart(range: StatsRange, today: string): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return shiftDate(today, -(days - 1));
}

const sinceCond = (since: string | null): SQL | undefined =>
  since ? gte(answers.answeredAt, sql`(${since}::date)::timestamp AT TIME ZONE ${TZ}`) : undefined;

const timeSum = sql<number>`coalesce(sum(least(coalesce(${answers.timeSpentMs}, 0), ${MAX_TIME_PER_ANSWER_MS})), 0)::float8`;
const correctCount = sql<number>`(count(*) filter (where ${answers.isCorrect}))::int`;
const avgTime = sql<number | null>`avg(${answers.timeSpentMs})::float8`;

const ratio = (c: number, t: number) => (t > 0 ? c / t : 0);

export async function getOverview(userId: string, range: StatsRange): Promise<StatsOverview> {
  const today = saoPauloDate();
  const since = rangeStart(range, today);
  const where = and(eq(answers.userId, userId), sinceCond(since));
  const dayExpr = sql<string>`to_char((${answers.answeredAt} AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD')`;

  const [totalsRows, lifetimeRows, dayRows, subjectRows, topicRows, simuladoRows, essayRows] =
    await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          correct: correctCount,
          time: timeSum,
          avgTime,
        })
        .from(answers)
        .where(where),
      db.select({ total: count() }).from(answers).where(eq(answers.userId, userId)),
      db
        .select({
          date: dayExpr,
          total: sql<number>`count(*)::int`,
          correct: correctCount,
        })
        .from(answers)
        .where(
          and(eq(answers.userId, userId), sinceCond(shiftDate(today, -(STREAK_LOOKBACK_DAYS - 1)))),
        )
        .groupBy(dayExpr)
        .orderBy(dayExpr),
      db
        .select({
          subjectId: subjects.id,
          subject: subjects.name,
          area: subjects.area,
          total: sql<number>`count(*)::int`,
          correct: correctCount,
          avgTime,
        })
        .from(answers)
        .innerJoin(questions, eq(questions.id, answers.questionId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(where)
        .groupBy(subjects.id, subjects.name, subjects.area, subjects.position)
        .orderBy(asc(subjects.position), asc(subjects.name)),
      topicStats(userId, { since }),
      db
        .select({
          attemptId: schema.simuladoAttempts.id,
          simuladoId: schema.simulados.id,
          title: schema.simulados.title,
          finishedAt: schema.simuladoAttempts.finishedAt,
          questionCount: schema.simulados.questionCount,
          rawScore: schema.simuladoAttempts.rawScore,
          triScore: schema.simuladoAttempts.triScore,
        })
        .from(schema.simuladoAttempts)
        .innerJoin(schema.simulados, eq(schema.simulados.id, schema.simuladoAttempts.simuladoId))
        .where(
          and(
            eq(schema.simuladoAttempts.userId, userId),
            eq(schema.simuladoAttempts.status, 'finished'),
          ),
        )
        .orderBy(desc(schema.simuladoAttempts.finishedAt))
        .limit(10),
      db
        .select({
          essayId: schema.essays.id,
          createdAt: schema.essays.createdAt,
          themeTitle: schema.essayThemes.title,
          totalScore: schema.essayCorrections.totalScore,
        })
        .from(schema.essayCorrections)
        .innerJoin(schema.essays, eq(schema.essays.id, schema.essayCorrections.essayId))
        .innerJoin(schema.essayThemes, eq(schema.essayThemes.id, schema.essays.themeId))
        .where(and(eq(schema.essays.userId, userId), eq(schema.essays.status, 'corrected')))
        .orderBy(desc(schema.essays.createdAt))
        .limit(20),
    ]);

  const totals = totalsRows[0]!;
  const bySubject: SubjectStat[] = subjectRows.map((r) => ({
    subjectId: r.subjectId,
    subject: r.subject,
    area: r.area,
    total: r.total,
    correct: r.correct,
    accuracy: ratio(r.correct, r.total),
    avgTimeMs: r.avgTime,
  }));
  const areaMap = new Map<EnemArea, { total: number; correct: number }>();
  for (const s of bySubject) {
    const cur = areaMap.get(s.area) ?? { total: 0, correct: 0 };
    areaMap.set(s.area, { total: cur.total + s.total, correct: cur.correct + s.correct });
  }
  const byArea: AreaStat[] = (['linguagens', 'humanas', 'natureza', 'matematica'] as const)
    .filter((a) => areaMap.has(a))
    .map((area) => {
      const v = areaMap.get(area)!;
      return { area, ...v, accuracy: ratio(v.correct, v.total) };
    });

  const sampled = topicRows.filter((t) => t.total >= MIN_TOPIC_SAMPLE);
  const bestTopics = [...sampled]
    .sort((a, b) => b.confidence - a.confidence || b.total - a.total)
    .slice(0, RANK_LIMIT);
  const weakTopics = [...sampled]
    .sort((a, b) => a.confidence - b.confidence || b.total - a.total)
    .slice(0, RANK_LIMIT);

  const activityAll: DailyActivity[] = dayRows;
  const activityFrom = shiftDate(today, -(ACTIVITY_DAYS - 1));
  const essaysChrono: EssayScore[] = [];
  for (const e of [...essayRows].reverse()) {
    if (e.totalScore === null) continue;
    essaysChrono.push({
      essayId: e.essayId,
      createdAt: e.createdAt.toISOString(),
      themeTitle: e.themeTitle,
      totalScore: e.totalScore,
    });
  }
  const [essayAvg] = await db
    .select({ v: avg(schema.essayCorrections.totalScore) })
    .from(schema.essayCorrections)
    .innerJoin(schema.essays, eq(schema.essays.id, schema.essayCorrections.essayId))
    .where(and(eq(schema.essays.userId, userId), eq(schema.essays.status, 'corrected')));

  const simulados: SimuladoScore[] = [];
  for (const s of [...simuladoRows].reverse()) {
    if (!s.finishedAt) continue;
    simulados.push({ ...s, finishedAt: s.finishedAt.toISOString() });
  }

  return {
    range,
    totalAnswers: totals.total,
    correctAnswers: totals.correct,
    accuracy: ratio(totals.correct, totals.total),
    timeStudiedMs: Math.round(totals.time),
    avgTimeMs: totals.avgTime,
    streakDays: computeStreak(
      activityAll.map((d) => d.date),
      today,
    ),
    lifetimeAnswers: lifetimeRows[0]?.total ?? 0,
    activity: activityAll.filter((d) => d.date >= activityFrom),
    byArea,
    bySubject,
    bestTopics,
    weakTopics,
    recentSimulados: simulados,
    essays: essaysChrono,
    essayAverage: essayAvg?.v != null ? Number(essayAvg.v) : null,
  };
}

/**
 * Acertos por tópico. Respostas em simulados contam (todas ficam em `answers`).
 * `includeEmpty` lista também os tópicos sem respostas (para a tabela de uma matéria).
 */
export async function topicStats(
  userId: string,
  opts: { since?: string | null; subjectId?: string; includeEmpty?: boolean } = {},
): Promise<TopicStat[]> {
  const rows = await db
    .select({
      topicId: topics.id,
      topic: topics.name,
      subjectId: subjects.id,
      subject: subjects.name,
      total: sql<number>`count(${answers.id})::int`,
      correct: sql<number>`(count(${answers.id}) filter (where ${answers.isCorrect}))::int`,
      avgTime,
    })
    .from(topics)
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .leftJoin(questionTopics, eq(questionTopics.topicId, topics.id))
    .leftJoin(
      answers,
      and(
        eq(answers.questionId, questionTopics.questionId),
        eq(answers.userId, userId),
        sinceCond(opts.since ?? null),
      ),
    )
    .where(opts.subjectId ? eq(topics.subjectId, opts.subjectId) : undefined)
    .groupBy(topics.id, topics.name, topics.position, subjects.id, subjects.name)
    .having(opts.includeEmpty ? undefined : sql`count(${answers.id}) > 0`)
    .orderBy(asc(topics.position), asc(topics.name));
  return rows.map((r) => ({
    topicId: r.topicId,
    topic: r.topic,
    subjectId: r.subjectId,
    subject: r.subject,
    total: r.total,
    correct: r.correct,
    accuracy: ratio(r.correct, r.total),
    avgTimeMs: r.avgTime,
    confidence: wilsonLowerBound(r.correct, r.total),
  }));
}

export async function getTopics(
  userId: string,
  q: { subjectId?: string; range: StatsRange },
): Promise<TopicStat[]> {
  return topicStats(userId, {
    since: rangeStart(q.range, saoPauloDate()),
    subjectId: q.subjectId,
    includeEmpty: Boolean(q.subjectId),
  });
}

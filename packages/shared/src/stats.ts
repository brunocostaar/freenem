import { z } from 'zod';
import { enemAreaSchema } from './enums.js';

export const statsRangeSchema = z.enum(['7d', '30d', '90d', 'all']);
export type StatsRange = z.infer<typeof statsRangeSchema>;

export const statsOverviewQuerySchema = z.object({
  range: statsRangeSchema.default('30d'),
});
export type StatsOverviewQuery = z.infer<typeof statsOverviewQuerySchema>;

/** Amostra mínima de respostas para um tópico entrar nos rankings de melhores/piores. */
export const MIN_TOPIC_SAMPLE = 5;

/**
 * Limite inferior do intervalo de confiança de Wilson (95%) para a taxa de acerto.
 * Penaliza amostras pequenas: 2/2 vale menos que 90/100.
 */
export function wilsonLowerBound(correct: number, total: number, z = 1.96): number {
  if (total <= 0) return 0;
  const p = correct / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return Math.max(0, (center - margin) / denom);
}

/**
 * Sequência de dias consecutivos com atividade. `days` são datas YYYY-MM-DD (fuso do aluno)
 * e `today` a data atual. Se hoje ainda não teve atividade, a sequência de ontem continua viva.
 */
export function computeStreak(days: readonly string[], today: string): number {
  const set = new Set(days);
  const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const DAY = 86_400_000;
  let cursor = toMs(today);
  if (!set.has(fmt(cursor))) cursor -= DAY;
  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

export const areaStatSchema = z.object({
  area: enemAreaSchema,
  total: z.number().int(),
  correct: z.number().int(),
  /** 0..1 */
  accuracy: z.number(),
});
export type AreaStat = z.infer<typeof areaStatSchema>;

export const subjectStatSchema = z.object({
  subjectId: z.string().uuid(),
  subject: z.string(),
  area: enemAreaSchema,
  total: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number(),
  avgTimeMs: z.number().nullable(),
});
export type SubjectStat = z.infer<typeof subjectStatSchema>;

export const topicStatSchema = z.object({
  topicId: z.string().uuid(),
  topic: z.string(),
  subjectId: z.string().uuid(),
  subject: z.string(),
  total: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number(),
  avgTimeMs: z.number().nullable(),
  /** limite inferior de Wilson (0..1), usado para ranquear */
  confidence: z.number(),
});
export type TopicStat = z.infer<typeof topicStatSchema>;

export const dailyActivitySchema = z.object({
  /** YYYY-MM-DD (America/Sao_Paulo) */
  date: z.string(),
  total: z.number().int(),
  correct: z.number().int(),
});
export type DailyActivity = z.infer<typeof dailyActivitySchema>;

export const simuladoScoreSchema = z.object({
  attemptId: z.string().uuid(),
  simuladoId: z.string().uuid(),
  title: z.string(),
  finishedAt: z.string(),
  questionCount: z.number().int(),
  rawScore: z.number().int().nullable(),
  triScore: z.number().nullable(),
});
export type SimuladoScore = z.infer<typeof simuladoScoreSchema>;

export const essayScoreSchema = z.object({
  essayId: z.string().uuid(),
  createdAt: z.string(),
  themeTitle: z.string(),
  totalScore: z.number().int(),
});
export type EssayScore = z.infer<typeof essayScoreSchema>;

export const statsOverviewSchema = z.object({
  range: statsRangeSchema,
  totalAnswers: z.number().int(),
  correctAnswers: z.number().int(),
  accuracy: z.number(),
  /** estimativa (soma de timeSpentMs, com teto por resposta) */
  timeStudiedMs: z.number().int(),
  avgTimeMs: z.number().nullable(),
  streakDays: z.number().int(),
  /** respostas de todo o histórico: usado para saber se é um usuário novo */
  lifetimeAnswers: z.number().int(),
  /** últimos ~6 meses, só dias com atividade */
  activity: z.array(dailyActivitySchema),
  byArea: z.array(areaStatSchema),
  bySubject: z.array(subjectStatSchema),
  bestTopics: z.array(topicStatSchema),
  weakTopics: z.array(topicStatSchema),
  recentSimulados: z.array(simuladoScoreSchema),
  essays: z.array(essayScoreSchema),
  essayAverage: z.number().nullable(),
});
export type StatsOverview = z.infer<typeof statsOverviewSchema>;

export const statsTopicsQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  range: statsRangeSchema.default('all'),
});
export type StatsTopicsQuery = z.infer<typeof statsTopicsQuerySchema>;

export const statsTopicsResponseSchema = z.object({ topics: z.array(topicStatSchema) });
export type StatsTopicsResponse = z.infer<typeof statsTopicsResponseSchema>;

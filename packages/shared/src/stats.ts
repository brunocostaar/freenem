import { z } from 'zod';

export const subjectStatSchema = z.object({
  subjectId: z.string().uuid(),
  subject: z.string(),
  total: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number(),
  avgTimeMs: z.number().nullable(),
});
export type SubjectStat = z.infer<typeof subjectStatSchema>;

export const topicStatSchema = subjectStatSchema.extend({
  topicId: z.string().uuid(),
  topic: z.string(),
});
export type TopicStat = z.infer<typeof topicStatSchema>;

export const evolutionPointSchema = z.object({
  date: z.string(),
  total: z.number().int(),
  correct: z.number().int(),
});

export const statsOverviewSchema = z.object({
  totalAnswers: z.number().int(),
  correctAnswers: z.number().int(),
  accuracy: z.number(),
  avgTimeMs: z.number().nullable(),
  streakDays: z.number().int(),
  bySubject: z.array(subjectStatSchema),
  evolution: z.array(evolutionPointSchema),
});
export type StatsOverview = z.infer<typeof statsOverviewSchema>;

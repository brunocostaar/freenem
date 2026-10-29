import { z } from 'zod';
import { alternativeLetterSchema, attemptStatusSchema, simuladoModeSchema } from './enums.js';

export const simuladoCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  mode: simuladoModeSchema,
  /** mode=official */
  examId: z.string().uuid().optional(),
  /** mode=custom */
  filters: z
    .object({
      institutionIds: z.array(z.string().uuid()).optional(),
      years: z.array(z.number().int()).optional(),
      subjectIds: z.array(z.string().uuid()).optional(),
      topicIds: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  questionCount: z.number().int().min(1).max(180).default(20),
  /** tempo total em minutos; null = sem limite */
  timeLimitMinutes: z.number().int().min(1).max(600).nullable().default(null),
});
export type SimuladoCreate = z.infer<typeof simuladoCreateSchema>;

export const simuladoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  mode: simuladoModeSchema,
  questionCount: z.number().int(),
  timeLimitMinutes: z.number().int().nullable(),
  createdAt: z.string(),
});
export type Simulado = z.infer<typeof simuladoSchema>;

export const attemptSchema = z.object({
  id: z.string().uuid(),
  simuladoId: z.string().uuid(),
  status: attemptStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
});
export type Attempt = z.infer<typeof attemptSchema>;

export const attemptAnswerSchema = z.object({
  questionId: z.string().uuid(),
  letter: alternativeLetterSchema.nullable(),
  timeSpentMs: z.number().int().min(0).optional(),
});
export type AttemptAnswer = z.infer<typeof attemptAnswerSchema>;

export const attemptSaveSchema = z.object({ answers: z.array(attemptAnswerSchema).max(200) });
export type AttemptSave = z.infer<typeof attemptSaveSchema>;

export const attemptResultSchema = z.object({
  attemptId: z.string().uuid(),
  total: z.number().int(),
  correct: z.number().int(),
  blank: z.number().int(),
  percentage: z.number(),
  /** nota TRI na escala ENEM (média 500, dp 100); null se não aplicável */
  triScore: z.number().nullable(),
  bySubject: z.array(
    z.object({
      subject: z.string(),
      total: z.number().int(),
      correct: z.number().int(),
    }),
  ),
});
export type AttemptResult = z.infer<typeof attemptResultSchema>;

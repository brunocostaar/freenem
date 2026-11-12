import { z } from 'zod';
import { alternativeLetterSchema, questionStatusSchema } from './enums.js';

// ---------- Revisão por IA (temporária, admin) ----------

export const aiVerdictSchema = z.enum(['ok', 'problem', 'unsure']);
export type AiVerdict = z.infer<typeof aiVerdictSchema>;

export const aiReviewFilterSchema = z.enum(['pending', 'ok', 'problem', 'unsure', 'mismatch']);
export type AiReviewFilter = z.infer<typeof aiReviewFilterSchema>;

export const aiReviewSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  model: z.string(),
  verdict: aiVerdictSchema,
  modelAnswer: alternativeLetterSchema.nullable(),
  answerMatches: z.boolean().nullable(),
  issues: z.array(z.string()),
  summary: z.string(),
  costUsd: z.number().nullable(),
  createdAt: z.string(),
});
export type AiReview = z.infer<typeof aiReviewSchema>;

export const aiReviewStatusSchema = z.object({
  enabled: z.boolean(),
  defaultModel: z.string(),
  models: z.array(z.string()),
  counts: z.object({
    ok: z.number().int(),
    problem: z.number().int(),
    unsure: z.number().int(),
    mismatch: z.number().int(),
  }),
  totalCostUsd: z.number(),
});
export type AiReviewStatus = z.infer<typeof aiReviewStatusSchema>;

export const aiReviewListQuerySchema = z.object({
  status: questionStatusSchema.default('draft'),
  filter: aiReviewFilterSchema.default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AiReviewListQuery = z.infer<typeof aiReviewListQuerySchema>;

export const aiReviewItemSchema = z.object({
  questionId: z.string().uuid(),
  number: z.number().int().nullable(),
  year: z.number().int().nullable(),
  examLabel: z.string().nullable(),
  subject: z.string().nullable(),
  statementExcerpt: z.string(),
  correctLetter: alternativeLetterSchema.nullable(),
  review: aiReviewSchema.nullable(),
});
export type AiReviewItem = z.infer<typeof aiReviewItemSchema>;

export const aiReviewListResponseSchema = z.object({
  items: z.array(aiReviewItemSchema),
  total: z.number().int(),
});
export type AiReviewListResponse = z.infer<typeof aiReviewListResponseSchema>;

export const aiReviewRunBodySchema = z.object({ model: z.string().min(1).max(200).optional() });
export type AiReviewRunBody = z.infer<typeof aiReviewRunBodySchema>;

/** Saída que o modelo deve produzir (validada no servidor). */
export const aiModelOutputSchema = z.object({
  answer: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    alternativeLetterSchema.nullable(),
  ),
  confidence: z.enum(['high', 'medium', 'low']),
  issues: z.array(z.string()).default([]),
  summary: z.string().default(''),
});
export type AiModelOutput = z.infer<typeof aiModelOutputSchema>;

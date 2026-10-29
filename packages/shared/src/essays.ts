import { z } from 'zod';
import { essayStatusSchema } from './enums.js';

export const ESSAY_MIN_CHARS = 500;
export const ESSAY_MAX_CHARS = 4000;

export const essayThemeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  year: z.number().int().nullable(),
  description: z.string().nullable(),
});
export type EssayTheme = z.infer<typeof essayThemeSchema>;

export const essaySubmitSchema = z.object({
  themeId: z.string().uuid(),
  text: z.string().min(ESSAY_MIN_CHARS).max(ESSAY_MAX_CHARS),
});
export type EssaySubmit = z.infer<typeof essaySubmitSchema>;

/** Nota de competência ENEM: 0..200 em passos de 40 */
export const competencyScoreSchema = z
  .number()
  .int()
  .min(0)
  .max(200)
  .refine((n) => n % 40 === 0, 'A nota deve ser múltiplo de 40');

export const competencyFeedbackSchema = z.object({
  score: competencyScoreSchema,
  feedback: z.string().max(1200),
});

export const essayCorrectionSchema = z.object({
  c1: competencyFeedbackSchema,
  c2: competencyFeedbackSchema,
  c3: competencyFeedbackSchema,
  c4: competencyFeedbackSchema,
  c5: competencyFeedbackSchema,
  generalFeedback: z.string().max(2000),
  injectionSuspected: z.boolean(),
});
export type EssayCorrection = z.infer<typeof essayCorrectionSchema>;

export const essayResultSchema = z.object({
  id: z.string().uuid(),
  themeId: z.string().uuid(),
  themeTitle: z.string(),
  text: z.string(),
  status: essayStatusSchema,
  totalScore: z.number().int().nullable(),
  correction: essayCorrectionSchema.nullable(),
  createdAt: z.string(),
});
export type EssayResult = z.infer<typeof essayResultSchema>;

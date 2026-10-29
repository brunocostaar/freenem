import { z } from 'zod';
import { alternativeLetterSchema, enemAreaSchema, questionStatusSchema } from './enums.js';
import { paginated, paginationQuerySchema } from './common.js';

export const subjectSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  area: enemAreaSchema,
});
export type Subject = z.infer<typeof subjectSchema>;

export const topicSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  slug: z.string(),
  name: z.string(),
});
export type Topic = z.infer<typeof topicSchema>;

export const institutionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
});
export type Institution = z.infer<typeof institutionSchema>;

export const alternativeSchema = z.object({
  letter: alternativeLetterSchema,
  text: z.string(),
  imageUrl: z.string().nullable().optional(),
});
export type Alternative = z.infer<typeof alternativeSchema>;

export const questionSummarySchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().nullable(),
  institution: z.string(),
  year: z.number().int(),
  subject: z.string(),
  topics: z.array(z.string()),
  statement: z.string(),
  imageUrls: z.array(z.string()),
  alternatives: z.array(alternativeSchema),
  /** estado do usuário autenticado */
  answered: z.boolean().default(false),
  wasCorrect: z.boolean().nullable().default(null),
  saved: z.boolean().default(false),
});
export type QuestionSummary = z.infer<typeof questionSummarySchema>;

const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const questionFilterSchema = paginationQuerySchema.extend({
  institutionId: z.string().uuid().optional(),
  year: z.coerce.number().int().optional(),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  q: z.string().trim().min(2).max(200).optional(),
  /** faixa de dificuldade (parâmetro b da TRI normalizado em 0..1) */
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  onlyUnanswered: queryBool.optional(),
  onlyWrong: queryBool.optional(),
  onlySaved: queryBool.optional(),
  status: questionStatusSchema.optional(),
});
export type QuestionFilter = z.infer<typeof questionFilterSchema>;

export const questionListResponseSchema = paginated(questionSummarySchema);
export type QuestionListResponse = z.infer<typeof questionListResponseSchema>;

export const answerSubmitSchema = z.object({
  questionId: z.string().uuid(),
  letter: alternativeLetterSchema,
  timeSpentMs: z.number().int().min(0).max(3_600_000).optional(),
  simuladoAttemptId: z.string().uuid().optional(),
});
export type AnswerSubmit = z.infer<typeof answerSubmitSchema>;

export const answerResultSchema = z.object({
  correct: z.boolean(),
  correctLetter: alternativeLetterSchema,
  resolution: z.string().nullable(),
});
export type AnswerResult = z.infer<typeof answerResultSchema>;

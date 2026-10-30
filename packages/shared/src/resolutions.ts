import { z } from 'zod';
import { questionStatusSchema } from './enums.js';

export const RESOLUTION_BODY_MAX = 8000;
export const RESOLUTION_BODY_MIN = 20;

export const resolutionStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ResolutionStatus = z.infer<typeof resolutionStatusSchema>;

export const RESOLUTION_STATUS_LABELS: Record<ResolutionStatus, string> = {
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

/** Texto + LaTeX apenas; HTML e imagens são removidos no servidor. */
export const resolutionBodySchema = z.object({
  body: z.string().trim().min(RESOLUTION_BODY_MIN).max(RESOLUTION_BODY_MAX),
});
export type ResolutionBodyInput = z.infer<typeof resolutionBodySchema>;

export const resolutionSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  status: resolutionStatusSchema,
  rejectReason: z.string().nullable(),
  score: z.number().int(),
  authorName: z.string(),
  mine: z.boolean(),
  /** voto do usuário logado: -1, 0 (nenhum) ou 1 */
  myVote: z.number().int().min(-1).max(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Resolution = z.infer<typeof resolutionSchema>;

export const resolutionListResponseSchema = z.object({
  /** aprovadas, por pontuação e data */
  items: z.array(resolutionSchema),
  /** resolução da própria pessoa quando ainda não aprovada (em análise ou rejeitada) */
  mine: resolutionSchema.nullable(),
});
export type ResolutionListResponse = z.infer<typeof resolutionListResponseSchema>;

export const voteResolutionSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });
export const voteResolutionResponseSchema = z.object({
  score: z.number().int(),
  myVote: z.number().int().min(-1).max(1),
});
export type VoteResolutionResponse = z.infer<typeof voteResolutionResponseSchema>;

export const resolutionReviewQuerySchema = z.object({
  status: resolutionStatusSchema.default('pending'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const resolutionReviewItemSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  status: resolutionStatusSchema,
  rejectReason: z.string().nullable(),
  score: z.number().int(),
  authorName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  question: z.object({
    id: z.string().uuid(),
    number: z.number().int().nullable(),
    institution: z.string(),
    year: z.number().int().nullable(),
    subject: z.string().nullable(),
    status: questionStatusSchema,
    statement: z.string(),
    correctLetter: z.string().nullable(),
    hasOfficialResolution: z.boolean(),
  }),
});
export type ResolutionReviewItem = z.infer<typeof resolutionReviewItemSchema>;

export const resolutionReviewListSchema = z.object({
  items: z.array(resolutionReviewItemSchema),
  pendingTotal: z.number().int(),
});
export type ResolutionReviewList = z.infer<typeof resolutionReviewListSchema>;

export const resolutionModerationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(3).max(500) }),
  /** promove uma resolução aprovada a `questions.resolution` */
  z.object({ action: z.literal('promote') }),
]);
export type ResolutionModeration = z.infer<typeof resolutionModerationSchema>;

export const myResolutionItemSchema = z.object({
  id: z.string().uuid(),
  questionId: z.string().uuid(),
  status: resolutionStatusSchema,
  score: z.number().int(),
  excerpt: z.string(),
  institution: z.string(),
  year: z.number().int().nullable(),
  number: z.number().int().nullable(),
  updatedAt: z.string(),
});
export const myResolutionsSchema = z.object({
  pending: z.number().int(),
  approved: z.number().int(),
  rejected: z.number().int(),
  total: z.number().int(),
  items: z.array(myResolutionItemSchema),
});
export type MyResolutions = z.infer<typeof myResolutionsSchema>;

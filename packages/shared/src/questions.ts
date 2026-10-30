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

export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

/** Faixas do parâmetro b (escala do ENEM): easy < EASY_MAX_B <= medium < HARD_MIN_B <= hard. */
export const DIFFICULTY_B_THRESHOLDS = { easyMax: 0.85, hardMin: 1.7 } as const;

export function difficultyFromB(b: number | null | undefined): Difficulty | null {
  if (b == null) return null;
  if (b < DIFFICULTY_B_THRESHOLDS.easyMax) return 'easy';
  if (b >= DIFFICULTY_B_THRESHOLDS.hardMin) return 'hard';
  return 'medium';
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Média',
  hard: 'Difícil',
};

export const questionSourceSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
  license: z.string().nullable(),
});
export type QuestionSource = z.infer<typeof questionSourceSchema>;

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
  /** faixa de dificuldade derivada do parâmetro b da TRI (null = sem parâmetros) */
  difficulty: difficultySchema.nullable().default(null),
  /** atribuição da fonte (ex.: "ENEM 2023 · INEP") */
  source: questionSourceSchema.nullable().default(null),
  status: questionStatusSchema.default('published'),
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
  difficulty: difficultySchema.optional(),
  onlyUnanswered: queryBool.optional(),
  onlyWrong: queryBool.optional(),
  onlySaved: queryBool.optional(),
  status: questionStatusSchema.optional(),
});
export type QuestionFilter = z.infer<typeof questionFilterSchema>;

export const questionListResponseSchema = paginated(questionSummarySchema).extend({
  total: z.number().int(),
});
export type QuestionListResponse = z.infer<typeof questionListResponseSchema>;

export const answerSubmitSchema = z.object({
  questionId: z.string().uuid(),
  letter: alternativeLetterSchema,
  timeSpentMs: z.number().int().min(0).max(3_600_000).optional(),
  simuladoAttemptId: z.string().uuid().optional(),
});
export type AnswerSubmit = z.infer<typeof answerSubmitSchema>;

export const subjectWithTopicsSchema = subjectSchema.extend({
  topics: z.array(topicSchema.extend({ children: z.array(topicSchema) })),
});
export type SubjectWithTopics = z.infer<typeof subjectWithTopicsSchema>;

export const catalogResponseSchema = z.object({
  institutions: z.array(institutionSchema),
  subjects: z.array(subjectWithTopicsSchema),
  /** anos com questões publicadas, do mais recente ao mais antigo */
  years: z.array(z.number().int()),
  /** instituição -> anos disponíveis */
  institutionYears: z.record(z.string(), z.array(z.number().int())),
  /** base pública das imagens (substitui `storage://` nos textos do modo de revisão) */
  storageBaseUrl: z.string(),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

export const subjectProgressSchema = z.object({
  subjectId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  area: enemAreaSchema,
  /** questões publicadas da matéria */
  total: z.number().int(),
  /** questões distintas já respondidas pelo usuário */
  answered: z.number().int(),
  /** questões distintas já acertadas pelo usuário */
  correct: z.number().int(),
});
export type SubjectProgress = z.infer<typeof subjectProgressSchema>;

export const subjectProgressResponseSchema = z.object({
  subjects: z.array(subjectProgressSchema),
});
export type SubjectProgressResponse = z.infer<typeof subjectProgressResponseSchema>;

export const answerResultSchema = z.object({
  correct: z.boolean(),
  correctLetter: alternativeLetterSchema,
  resolution: z.string().nullable(),
});
export type AnswerResult = z.infer<typeof answerResultSchema>;

export const letterStatSchema = z.object({
  letter: alternativeLetterSchema,
  count: z.number().int(),
  /** 0..100, arredondado */
  percent: z.number(),
});
export type LetterStat = z.infer<typeof letterStatSchema>;

/** Resposta de POST /answers e /questions/:id/check: gabarito + resolução + distribuição das respostas. */
export const answerResponseSchema = answerResultSchema.extend({
  stats: z.array(letterStatSchema),
  totalAnswers: z.number().int(),
});
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

export const checkAnswerSchema = z.object({ letter: alternativeLetterSchema });
export type CheckAnswer = z.infer<typeof checkAnswerSchema>;

export const savedResponseSchema = z.object({ saved: z.boolean() });

// ---------- revisão (reviewer/admin) ----------

export const reviewAlternativeSchema = z.object({
  letter: alternativeLetterSchema,
  text: z.string(),
  imageUrl: z.string().nullable().optional(),
  isCorrect: z.boolean(),
});

export const reviewQuestionSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().nullable(),
  institution: z.string(),
  year: z.number().int().nullable(),
  examLabel: z.string().nullable(),
  subjectId: z.string().uuid().nullable(),
  subject: z.string().nullable(),
  topicIds: z.array(z.string().uuid()),
  topics: z.array(z.string()),
  /** Markdown cru (imagens como `storage://...`) */
  statement: z.string(),
  resolution: z.string().nullable(),
  status: questionStatusSchema,
  alternatives: z.array(reviewAlternativeSchema),
  source: questionSourceSchema.nullable(),
  externalId: z.string().nullable(),
  irtB: z.number().nullable(),
  updatedAt: z.string(),
});
export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>;

export const reviewListQuerySchema = paginationQuerySchema.extend({
  status: questionStatusSchema.default('draft'),
  year: z.coerce.number().int().optional(),
  subjectId: z.string().uuid().optional(),
  q: z.string().trim().min(2).max(200).optional(),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;

export const reviewListResponseSchema = paginated(reviewQuestionSchema).extend({
  total: z.number().int(),
});
export type ReviewListResponse = z.infer<typeof reviewListResponseSchema>;

export const reviewPatchSchema = z.object({
  statement: z.string().trim().min(1).max(20_000).optional(),
  resolution: z.string().trim().max(20_000).nullable().optional(),
  alternatives: z
    .array(
      z.object({
        letter: alternativeLetterSchema,
        text: z.string().max(5_000),
        imageUrl: z.string().max(1_000).nullable().optional(),
      }),
    )
    .min(2)
    .max(5)
    .optional(),
  correctLetter: alternativeLetterSchema.optional(),
  subjectId: z.string().uuid().nullable().optional(),
  topicIds: z.array(z.string().uuid()).max(5).optional(),
  status: questionStatusSchema.optional(),
});
export type ReviewPatch = z.infer<typeof reviewPatchSchema>;

// ---------- estado de filtros na URL (web) ----------

/** Search params de `/questoes` (booleanos de verdade, ao contrário da query string da API). */
export const questionSearchSchema = z.object({
  institutionId: z.string().uuid().optional().catch(undefined),
  year: z.coerce.number().int().optional().catch(undefined),
  subjectId: z.string().uuid().optional().catch(undefined),
  topicId: z.string().uuid().optional().catch(undefined),
  // o roteador converte "2023" em número: aceitamos e devolvemos como texto
  q: z
    .preprocess((v) => (typeof v === 'number' ? String(v) : v), z.string().trim().min(2).max(200))
    .optional()
    .catch(undefined),
  difficulty: difficultySchema.optional().catch(undefined),
  onlyUnanswered: z.boolean().optional().catch(undefined),
  onlyWrong: z.boolean().optional().catch(undefined),
  onlySaved: z.boolean().optional().catch(undefined),
  view: z.enum(['focus', 'list']).optional().catch(undefined),
  /** pula a grade de matérias e abre a prática com todas misturadas */
  all: z.boolean().optional().catch(undefined),
});
export type QuestionSearch = z.infer<typeof questionSearchSchema>;

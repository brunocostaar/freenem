import { z } from 'zod';
import {
  alternativeLetterSchema,
  attemptStatusSchema,
  enemAreaSchema,
  simuladoModeSchema,
} from './enums.js';

/** Língua estrangeira do ENEM (Inglês e Espanhol repetem os números 1–5 no Dia 1). */
export const simuladoLanguageSchema = z.enum(['ingles', 'espanhol']);
export type SimuladoLanguage = z.infer<typeof simuladoLanguageSchema>;

export const SIMULADO_CUSTOM_MIN_QUESTIONS = 5;
export const SIMULADO_CUSTOM_MAX_QUESTIONS = 90;

/** Filtros de um simulado personalizado (também guardados em `simulados.filters`). */
export const simuladoFiltersSchema = z.object({
  areas: z.array(enemAreaSchema).optional(),
  institutionIds: z.array(z.string().uuid()).optional(),
  years: z.array(z.number().int()).optional(),
  subjectIds: z.array(z.string().uuid()).optional(),
  topicIds: z.array(z.string().uuid()).optional(),
  /** exclui questões que o usuário já respondeu */
  excludeAnswered: z.boolean().optional(),
});
export type SimuladoFilters = z.infer<typeof simuladoFiltersSchema>;

export const simuladoCreateSchema = z
  .object({
    /** opcional: o servidor gera um título quando omitido */
    title: z.string().trim().min(3).max(120).optional(),
    mode: simuladoModeSchema,
    /** mode=official */
    examId: z.string().uuid().optional(),
    /** mode=official: restringe a uma área do ENEM */
    area: enemAreaSchema.optional(),
    /**
     * mode=official: língua estrangeira escolhida (padrão: inglês). Só vale
     * para provas que têm as duas línguas; a outra é removida do simulado.
     */
    language: simuladoLanguageSchema.optional(),
    /** mode=custom */
    filters: simuladoFiltersSchema.optional(),
    /** mode=custom: 5–90 */
    questionCount: z.number().int().min(1).max(180).optional(),
    /**
     * tempo total em minutos. `null` = sem limite; omitido = padrão
     * (oficial: tempo proporcional ao do ENEM; personalizado: sem limite).
     */
    timeLimitMinutes: z.number().int().min(1).max(600).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'official' && !v.examId) {
      ctx.addIssue({ code: 'custom', path: ['examId'], message: 'Escolha uma prova.' });
    }
    if (v.mode === 'custom') {
      const n = v.questionCount ?? 20;
      if (n < SIMULADO_CUSTOM_MIN_QUESTIONS || n > SIMULADO_CUSTOM_MAX_QUESTIONS) {
        ctx.addIssue({
          code: 'custom',
          path: ['questionCount'],
          message: `Escolha entre ${SIMULADO_CUSTOM_MIN_QUESTIONS} e ${SIMULADO_CUSTOM_MAX_QUESTIONS} questões.`,
        });
      }
    }
  });
export type SimuladoCreate = z.infer<typeof simuladoCreateSchema>;

export const attemptSummarySchema = z.object({
  id: z.string().uuid(),
  status: attemptStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  rawScore: z.number().int().nullable(),
  /** média das notas TRI estimadas por área; null se não aplicável */
  triScore: z.number().nullable(),
});
export type AttemptSummary = z.infer<typeof attemptSummarySchema>;

export const simuladoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  mode: simuladoModeSchema,
  examId: z.string().uuid().nullable(),
  questionCount: z.number().int(),
  timeLimitMinutes: z.number().int().nullable(),
  createdAt: z.string(),
  filters: simuladoFiltersSchema
    .extend({ area: enemAreaSchema.optional(), language: simuladoLanguageSchema.optional() })
    .nullable(),
  /** tentativas, da mais recente para a mais antiga */
  attempts: z.array(attemptSummarySchema),
});
export type Simulado = z.infer<typeof simuladoSchema>;

export const simuladoListSchema = z.object({ items: z.array(simuladoSchema) });
export type SimuladoList = z.infer<typeof simuladoListSchema>;

export const attemptSchema = z.object({
  id: z.string().uuid(),
  simuladoId: z.string().uuid(),
  status: attemptStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  deadlineAt: z.string().nullable(),
});
export type Attempt = z.infer<typeof attemptSchema>;

// ---- Opções para montar simulados ----

export const simuladoOptionsSchema = z.object({
  exams: z.array(
    z.object({
      id: z.string().uuid(),
      institution: z.string(),
      institutionSlug: z.string(),
      year: z.number().int(),
      label: z.string(),
      phase: z.string().nullable(),
      color: z.string().nullable(),
      questionCount: z.number().int(),
      areas: z.array(z.object({ area: enemAreaSchema, count: z.number().int() })),
      /** questões publicadas por língua estrangeira (a prova tem opção de língua se ambas > 0) */
      languageCounts: z.object({ ingles: z.number().int(), espanhol: z.number().int() }),
      /** tempo oficial sugerido para a prova completa, em minutos (null se desconhecido) */
      officialMinutes: z.number().int().nullable(),
    }),
  ),
  subjects: z.array(
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      name: z.string(),
      area: enemAreaSchema,
      questionCount: z.number().int(),
    }),
  ),
  institutions: z.array(
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      name: z.string(),
      questionCount: z.number().int(),
    }),
  ),
  years: z.array(z.number().int()),
});
export type SimuladoOptions = z.infer<typeof simuladoOptionsSchema>;

// ---- Fazer a prova ----

export const attemptAnswerSchema = z.object({
  questionId: z.string().uuid(),
  letter: alternativeLetterSchema.nullable(),
  /** tempo total acumulado nesta questão, em ms */
  timeSpentMs: z.number().int().min(0).max(86_400_000).optional(),
});
export type AttemptAnswer = z.infer<typeof attemptAnswerSchema>;

export const attemptSaveSchema = z.object({ answers: z.array(attemptAnswerSchema).max(200) });
export type AttemptSave = z.infer<typeof attemptSaveSchema>;

export const attemptSaveResponseSchema = z.object({
  saved: z.number().int(),
  remainingMs: z.number().int().nullable(),
});

/** Questão durante a prova: sem gabarito. */
export const attemptQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  number: z.number().int().nullable(),
  statement: z.string(),
  imageUrls: z.array(z.string()),
  subject: z.string().nullable(),
  area: enemAreaSchema.nullable(),
  alternatives: z.array(
    z.object({
      letter: alternativeLetterSchema,
      text: z.string(),
      imageUrl: z.string().nullable(),
    }),
  ),
});
export type AttemptQuestion = z.infer<typeof attemptQuestionSchema>;

export const attemptSessionSchema = z.object({
  attempt: attemptSchema,
  title: z.string(),
  /** hora do servidor, para corrigir o relógio do cliente */
  serverNow: z.string(),
  /** ms restantes até o prazo; null = sem limite */
  remainingMs: z.number().int().nullable(),
  /** vazio quando a tentativa já foi finalizada */
  questions: z.array(attemptQuestionSchema),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      letter: alternativeLetterSchema.nullable(),
      timeSpentMs: z.number().int(),
    }),
  ),
});
export type AttemptSession = z.infer<typeof attemptSessionSchema>;

// ---- Resultado ----

export const triEstimateSchema = z.object({
  /** nota estimada na escala ENEM (500 + 100·θ) */
  score: z.number(),
  theta: z.number(),
  /** erro-padrão em pontos da escala ENEM */
  standardError: z.number(),
  itemsUsed: z.number().int(),
});
export type TriEstimate = z.infer<typeof triEstimateSchema>;

export const areaResultSchema = z.object({
  area: enemAreaSchema,
  total: z.number().int(),
  correct: z.number().int(),
  blank: z.number().int(),
  /** itens da área que têm parâmetros TRI */
  itemsWithParams: z.number().int(),
  /** null quando há menos de 5 itens com parâmetros */
  tri: triEstimateSchema.nullable(),
  /** 0..1; null quando não há itens suficientes */
  coherence: z.number().nullable(),
});
export type AreaResult = z.infer<typeof areaResultSchema>;

export const questionOutcomeSchema = z.enum(['correct', 'wrong', 'blank']);
export type QuestionOutcome = z.infer<typeof questionOutcomeSchema>;

export const resultQuestionSchema = attemptQuestionSchema.extend({
  alternatives: z.array(
    z.object({
      letter: alternativeLetterSchema,
      text: z.string(),
      imageUrl: z.string().nullable(),
      isCorrect: z.boolean(),
    }),
  ),
  chosenLetter: alternativeLetterSchema.nullable(),
  correctLetter: alternativeLetterSchema.nullable(),
  outcome: questionOutcomeSchema,
  timeSpentMs: z.number().int(),
  resolution: z.string().nullable(),
  hasIrtParams: z.boolean(),
});
export type ResultQuestion = z.infer<typeof resultQuestionSchema>;

export const attemptResultSchema = z.object({
  attempt: attemptSchema,
  title: z.string(),
  mode: simuladoModeSchema,
  total: z.number().int(),
  correct: z.number().int(),
  wrong: z.number().int(),
  blank: z.number().int(),
  percentage: z.number(),
  /** média das notas TRI por área; null se nenhuma área tem TRI */
  triScore: z.number().nullable(),
  /** coerência pedagógica geral (0..1) */
  coherence: z.number().nullable(),
  totalTimeMs: z.number().int(),
  areas: z.array(areaResultSchema),
  bySubject: z.array(
    z.object({
      subjectId: z.string().uuid().nullable(),
      subject: z.string(),
      area: enemAreaSchema.nullable(),
      total: z.number().int(),
      correct: z.number().int(),
      blank: z.number().int(),
    }),
  ),
  questions: z.array(resultQuestionSchema),
});
export type AttemptResult = z.infer<typeof attemptResultSchema>;

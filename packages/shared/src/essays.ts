import { z } from 'zod';
import { essayStatusSchema } from './enums.js';

export const ESSAY_MIN_CHARS = 500;
export const ESSAY_MAX_CHARS = 4000;
/** Rascunhos aceitam um pouco mais, para o aluno editar antes de enviar. */
export const ESSAY_DRAFT_MAX_CHARS = 8000;
/** Folha oficial do ENEM: 30 linhas. */
export const ESSAY_SHEET_LINES = 30;
/** Estimativa de caracteres por linha manuscrita da folha (usada no contador de linhas). */
export const ESSAY_CHARS_PER_LINE = 90;
/** Correções por usuário por dia (America/Sao_Paulo). */
export const ESSAY_DAILY_LIMIT = 1;

export const essayThemeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  year: z.number().int().nullable(),
  description: z.string().nullable(),
  /** textos motivadores (Markdown), quando disponíveis */
  supportingTexts: z.string().nullable(),
});
export type EssayTheme = z.infer<typeof essayThemeSchema>;

export const essayThemeListSchema = z.object({ items: z.array(essayThemeSchema) });

/** Salvar rascunho (sem mínimo de caracteres; o mínimo vale na correção). */
export const essayDraftSchema = z.object({
  themeId: z.string().uuid(),
  text: z.string().max(ESSAY_DRAFT_MAX_CHARS),
});
export type EssayDraft = z.infer<typeof essayDraftSchema>;

export const essayDraftUpdateSchema = z.object({
  text: z.string().max(ESSAY_DRAFT_MAX_CHARS),
});
export type EssayDraftUpdate = z.infer<typeof essayDraftUpdateSchema>;

/** Texto pronto para correção. */
export const essaySubmitSchema = z.object({
  themeId: z.string().uuid(),
  text: z.string().min(ESSAY_MIN_CHARS).max(ESSAY_MAX_CHARS),
});
export type EssaySubmit = z.infer<typeof essaySubmitSchema>;

/** Nota de competência ENEM: 0, 40, 80, 120, 160 ou 200. */
export const COMPETENCY_LEVELS = [0, 40, 80, 120, 160, 200] as const;
export const competencyScoreSchema = z.union([
  z.literal(0),
  z.literal(40),
  z.literal(80),
  z.literal(120),
  z.literal(160),
  z.literal(200),
]);

export const COMPETENCY_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5'] as const;
export type CompetencyKey = (typeof COMPETENCY_KEYS)[number];

export const COMPETENCY_LABELS: Record<CompetencyKey, string> = {
  c1: 'Domínio da norma culta',
  c2: 'Compreensão da proposta e tipo textual',
  c3: 'Seleção e organização de argumentos',
  c4: 'Coesão e mecanismos linguísticos',
  c5: 'Proposta de intervenção',
};

export const COMPETENCY_JUSTIFICATION_MAX = 600;
export const COMPETENCY_SUGGESTION_MAX = 200;
export const GENERAL_FEEDBACK_MAX = 1200;

export const competencyResultSchema = z.strictObject({
  score: competencyScoreSchema,
  justification: z.string().max(COMPETENCY_JUSTIFICATION_MAX),
  suggestions: z.array(z.string().max(COMPETENCY_SUGGESTION_MAX)).max(3),
});
export type CompetencyResult = z.infer<typeof competencyResultSchema>;

/** Motivos de nota zero (redação anulada) previstos na cartilha do participante. */
export const zeroReasonSchema = z.enum([
  'fuga_ao_tema',
  'nao_atendimento_tipologia',
  'texto_insuficiente',
  'parte_desconectada',
  'identificacao',
  'copia_motivadores',
]);
export type ZeroReason = z.infer<typeof zeroReasonSchema>;

export const ZERO_REASON_LABELS: Record<ZeroReason, string> = {
  fuga_ao_tema: 'Fuga ao tema',
  nao_atendimento_tipologia: 'Não atendimento ao tipo textual dissertativo-argumentativo',
  texto_insuficiente: 'Texto insuficiente (até 7 linhas)',
  parte_desconectada: 'Parte deliberadamente desconectada do tema',
  identificacao: 'Identificação do participante no texto',
  copia_motivadores: 'Cópia dos textos motivadores',
};

/**
 * Formato EXATO que o modelo deve devolver (tool `submit_correction`).
 * Estrito: chaves extras são rejeitadas.
 *
 * `humanRightsViolation`: o desrespeito aos direitos humanos não anula mais a redação inteira
 * (regra mantida nas cartilhas recentes); zera apenas a Competência 5.
 */
export const modelCorrectionOutputSchema = z.strictObject({
  c1: competencyResultSchema,
  c2: competencyResultSchema,
  c3: competencyResultSchema,
  c4: competencyResultSchema,
  c5: competencyResultSchema,
  generalFeedback: z.string().max(GENERAL_FEEDBACK_MAX),
  zeroReason: zeroReasonSchema.nullable(),
  humanRightsViolation: z.boolean(),
  injectionSuspected: z.boolean(),
});
export type ModelCorrectionOutput = z.infer<typeof modelCorrectionOutputSchema>;

export const injectionSourceSchema = z.enum(['heuristic', 'model', 'both']);
export type InjectionSource = z.infer<typeof injectionSourceSchema>;

/** Correção como armazenada e exposta ao aluno (já validada e saneada). */
export const essayCorrectionSchema = modelCorrectionOutputSchema.extend({
  /** quem detectou a tentativa de manipulação (null = ninguém) */
  injectionSource: injectionSourceSchema.nullable(),
  /** correção de demonstração (sem IA) */
  isDemo: z.boolean(),
});
export type EssayCorrection = z.infer<typeof essayCorrectionSchema>;

export const essayListItemSchema = z.object({
  id: z.string().uuid(),
  themeId: z.string().uuid(),
  themeTitle: z.string(),
  status: essayStatusSchema,
  /** sem correção ainda (pode ser editada) */
  isDraft: z.boolean(),
  totalScore: z.number().int().nullable(),
  charCount: z.number().int(),
  createdAt: z.string(),
});
export type EssayListItem = z.infer<typeof essayListItemSchema>;
export const essayListSchema = z.object({ items: z.array(essayListItemSchema) });

export const essayResultSchema = z.object({
  id: z.string().uuid(),
  themeId: z.string().uuid(),
  themeTitle: z.string(),
  themeSupportingTexts: z.string().nullable(),
  text: z.string(),
  status: essayStatusSchema,
  isDraft: z.boolean(),
  totalScore: z.number().int().nullable(),
  correction: essayCorrectionSchema.nullable(),
  model: z.string().nullable(),
  createdAt: z.string(),
});
export type EssayResult = z.infer<typeof essayResultSchema>;

export const essayQuotaSchema = z.object({
  availableToday: z.boolean(),
  /** ISO 8601; null quando já disponível */
  nextAvailableAt: z.string().nullable(),
  /** a correção usa IA real (false = modo demonstração) */
  aiEnabled: z.boolean(),
});
export type EssayQuota = z.infer<typeof essayQuotaSchema>;

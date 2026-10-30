import { z } from 'zod';
import { questionStatusSchema } from './enums.js';

export const reportKindSchema = z.enum([
  'gabarito_errado',
  'enunciado_incompleto',
  'imagem_quebrada',
  'classificacao_errada',
  'outro',
]);
export type ReportKind = z.infer<typeof reportKindSchema>;

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  gabarito_errado: 'Gabarito errado',
  enunciado_incompleto: 'Enunciado incompleto ou com erro',
  imagem_quebrada: 'Imagem quebrada ou ausente',
  classificacao_errada: 'Matéria ou assunto errado',
  outro: 'Outro problema',
};

export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

/** Tipos que, em número suficiente, tiram a questão do ar até a revisão. */
export const AUTO_HIDE_REPORT_KINDS: readonly ReportKind[] = [
  'gabarito_errado',
  'enunciado_incompleto',
];
export const AUTO_HIDE_REPORT_THRESHOLD = 3;

export const REPORT_MESSAGE_MAX = 1000;

export const createReportSchema = z.object({
  kind: reportKindSchema,
  message: z.string().trim().max(REPORT_MESSAGE_MAX).default(''),
});
export type CreateReport = z.infer<typeof createReportSchema>;

export const createReportResponseSchema = z.object({ id: z.string().uuid() });

export const reportListQuerySchema = z.object({
  status: reportStatusSchema.default('open'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ReportListQuery = z.infer<typeof reportListQuerySchema>;

export const reportItemSchema = z.object({
  id: z.string().uuid(),
  kind: reportKindSchema,
  message: z.string(),
  status: reportStatusSchema,
  userName: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type ReportItem = z.infer<typeof reportItemSchema>;

/** Reportes agrupados por questão. */
export const reportGroupSchema = z.object({
  question: z.object({
    id: z.string().uuid(),
    number: z.number().int().nullable(),
    institution: z.string(),
    year: z.number().int().nullable(),
    subject: z.string().nullable(),
    status: questionStatusSchema,
    excerpt: z.string(),
  }),
  /** reportes abertos da questão (independente do filtro) */
  openCount: z.number().int(),
  reports: z.array(reportItemSchema),
});
export type ReportGroup = z.infer<typeof reportGroupSchema>;

export const reportListResponseSchema = z.object({
  groups: z.array(reportGroupSchema),
  /** total de reportes abertos (para o contador da aba) */
  openTotal: z.number().int(),
});
export type ReportListResponse = z.infer<typeof reportListResponseSchema>;

export const reportPatchSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
});
export type ReportPatch = z.infer<typeof reportPatchSchema>;

/** Confirmação digitada para excluir a conta. */
export const DELETE_ACCOUNT_CONFIRMATION = 'EXCLUIR';
export const deleteAccountSchema = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
});

import { z } from 'zod';
import { enemAreaSchema } from './enums.js';

/** Duração estimada (min) de cada tipo de item de estudo de tópico. */
export const ITEM_MINUTES = { theory: 45, questions: 40, review: 25 } as const;

export const planItemKindSchema = z.enum(['theory', 'questions', 'review', 'simulado', 'essay']);
export type PlanItemKind = z.infer<typeof planItemKindSchema>;

export const studyPlanCreateSchema = z.object({
  examDate: z.string().date(),
  hoursPerWeek: z.number().int().min(1).max(80),
  /** 0 = domingo ... 6 = sábado */
  availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  focusAreas: z.array(enemAreaSchema).max(4).optional(),
});
export type StudyPlanCreate = z.infer<typeof studyPlanCreateSchema>;

export const studyPlanRebalanceSchema = z.object({
  focusAreas: z.array(enemAreaSchema).max(4).optional(),
});
export type StudyPlanRebalance = z.infer<typeof studyPlanRebalanceSchema>;

export const studyPlanItemSchema = z.object({
  /** uuid para itens de tópico; "simulado-<n>"/"essay-<n>" para itens automáticos */
  id: z.string(),
  kind: planItemKindSchema,
  topicId: z.string().uuid().nullable(),
  topicName: z.string().nullable(),
  subjectName: z.string().nullable(),
  area: enemAreaSchema.nullable(),
  week: z.number().int().min(1),
  minutes: z.number().int(),
  done: z.boolean(),
  /** itens de simulado/redação são concluídos automaticamente pela atividade do aluno */
  auto: z.boolean(),
  /** rota do app (com query) que executa o item */
  href: z.string(),
});
export type StudyPlanItem = z.infer<typeof studyPlanItemSchema>;

export const studyPlanWeekSchema = z.object({
  week: z.number().int().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  budgetMinutes: z.number().int(),
  plannedMinutes: z.number().int(),
  items: z.array(studyPlanItemSchema),
});
export type StudyPlanWeek = z.infer<typeof studyPlanWeekSchema>;

export const studyPlanSchema = z.object({
  id: z.string().uuid(),
  examDate: z.string(),
  startDate: z.string(),
  hoursPerWeek: z.number().int(),
  availableDays: z.array(z.number().int()),
  currentWeek: z.number().int(),
  totalWeeks: z.number().int(),
  daysUntilExam: z.number().int(),
  progress: z.object({ done: z.number().int(), total: z.number().int() }),
  weeks: z.array(studyPlanWeekSchema),
});
export type StudyPlan = z.infer<typeof studyPlanSchema>;

export const studyPlanResponseSchema = z.object({ plan: studyPlanSchema.nullable() });
export type StudyPlanResponse = z.infer<typeof studyPlanResponseSchema>;

export const studyPlanItemUpdateSchema = z.object({ done: z.boolean() });
export type StudyPlanItemUpdate = z.infer<typeof studyPlanItemUpdateSchema>;

export const studyPlanItemUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
});

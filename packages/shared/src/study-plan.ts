import { z } from 'zod';
import { studyItemKindSchema } from './enums.js';

export const studyPlanCreateSchema = z.object({
  examDate: z.string().date(),
  hoursPerWeek: z.number().int().min(1).max(80),
  /** 0 = domingo ... 6 = sábado */
  availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});
export type StudyPlanCreate = z.infer<typeof studyPlanCreateSchema>;

export const studyPlanItemSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  topicName: z.string(),
  subjectName: z.string(),
  week: z.number().int().min(1),
  kind: studyItemKindSchema,
  done: z.boolean(),
});
export type StudyPlanItem = z.infer<typeof studyPlanItemSchema>;

export const studyPlanSchema = z.object({
  id: z.string().uuid(),
  examDate: z.string(),
  hoursPerWeek: z.number().int(),
  availableDays: z.array(z.number().int()),
  items: z.array(studyPlanItemSchema),
});
export type StudyPlan = z.infer<typeof studyPlanSchema>;

export const studyPlanItemUpdateSchema = z.object({ done: z.boolean() });

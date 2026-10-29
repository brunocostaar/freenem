import { z } from 'zod';

export const questionStatusSchema = z.enum(['draft', 'reviewed', 'published']);
export type QuestionStatus = z.infer<typeof questionStatusSchema>;

export const roleSchema = z.enum(['student', 'reviewer', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const enemAreaSchema = z.enum(['linguagens', 'humanas', 'natureza', 'matematica']);
export type EnemArea = z.infer<typeof enemAreaSchema>;

export const ENEM_AREA_LABELS: Record<EnemArea, string> = {
  linguagens: 'Linguagens, Códigos e suas Tecnologias',
  humanas: 'Ciências Humanas e suas Tecnologias',
  natureza: 'Ciências da Natureza e suas Tecnologias',
  matematica: 'Matemática e suas Tecnologias',
};

export const alternativeLetterSchema = z.enum(['A', 'B', 'C', 'D', 'E']);
export type AlternativeLetter = z.infer<typeof alternativeLetterSchema>;

export const studyItemKindSchema = z.enum(['theory', 'questions', 'review']);
export type StudyItemKind = z.infer<typeof studyItemKindSchema>;

export const essayStatusSchema = z.enum(['pending', 'corrected', 'flagged', 'failed']);
export type EssayStatus = z.infer<typeof essayStatusSchema>;

export const simuladoModeSchema = z.enum(['custom', 'official']);
export type SimuladoMode = z.infer<typeof simuladoModeSchema>;

export const attemptStatusSchema = z.enum(['in_progress', 'finished', 'abandoned']);
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;

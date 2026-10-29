/**
 * Importação de provas (INEP, FUVEST, UFRGS...). Implementação nas próximas fases.
 * Toda fonte implementa a interface `Source`.
 */
export interface ExamRef {
  institution: string;
  year: number;
  label: string;
  sourceUrl?: string;
}

export interface ExtractedQuestion {
  number: number;
  statement: string;
  alternatives: { letter: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }[];
  correctLetter?: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface Source {
  listExams(): Promise<ExamRef[]>;
  extract(exam: ExamRef): Promise<ExtractedQuestion[]>;
}

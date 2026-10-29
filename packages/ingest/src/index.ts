/**
 * Importação de provas (INEP, FUVEST, UFRGS...). Toda fonte implementa a interface `Source`.
 * O ENEM usa o pipeline dedicado de `import-enem.ts` (dataset aberto + TRI do INEP).
 */
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ExamRef {
  institution: string;
  year: number;
  label: string;
  sourceUrl?: string;
  /** ex.: "2ª fase" */
  phase?: string;
}

export interface ExtractedQuestion {
  number: number;
  statement: string;
  alternatives: { letter: Letter; text: string }[];
  correctLetter?: Letter;
}

export interface Source {
  listExams(): Promise<ExamRef[]>;
  extract(exam: ExamRef): Promise<ExtractedQuestion[]>;
}

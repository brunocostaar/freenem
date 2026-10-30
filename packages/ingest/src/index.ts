/**
 * Importação de provas (INEP, FUVEST, UFRGS, UNICAMP...). Toda fonte implementa a interface `Source`.
 * O ENEM usa o pipeline dedicado de `import-enem.ts` (dataset aberto + TRI do INEP); os
 * vestibulares passam por `import-vestibular.ts` e entram SEMPRE como rascunho.
 */
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ExamRef {
  institution: string;
  year: number;
  label: string;
  sourceUrl?: string;
  /** ex.: "2ª fase" */
  phase?: string;
  /** identifica o caderno dentro da fonte (ex.: UFRGS "d1" / "d2") */
  key?: string;
  /** prefixo do `external_id`, ex.: "fuvest-2024-1f" (vira "fuvest-2024-1f-12") */
  externalPrefix?: string;
  /** texto de atribuição, ex.: "FUVEST 2024 · 1ª fase — prova oficial (fuvest.br)" */
  attribution?: string;
  /** nº esperado de alternativas por questão (padrão 5) */
  expectedAlternatives?: number;
  /** nº esperado de questões (para medir a precisão do parser) */
  expectedQuestions?: number;
  /** URL do gabarito oficial */
  gabaritoUrl?: string;
}

export interface ExtractedQuestion {
  number: number;
  statement: string;
  alternatives: { letter: Letter; text: string }[];
  correctLetter?: Letter;
  /** matéria conhecida pela posição na prova (nome da taxonomia), quando houver */
  subject?: string;
  language?: 'ingles' | 'espanhol';
  /** figuras recortadas do PDF (PNG) */
  images?: Buffer[];
  /** `external_id` explícito (padrão: `${externalPrefix}-${number}`) */
  externalId?: string;
  /** gabarito oficial marca a questão como anulada: não é importada */
  annulled?: boolean;
  /** avisos do parser (vão para o relatório CSV) */
  warnings?: string[];
}

export interface Source {
  listExams(): Promise<ExamRef[]>;
  extract(exam: ExamRef): Promise<ExtractedQuestion[]>;
  /** nº de questões que o gabarito oficial lista para o caderno (quando difere de `expectedQuestions`) */
  expectedCount?(exam: ExamRef): Promise<number | undefined>;
}

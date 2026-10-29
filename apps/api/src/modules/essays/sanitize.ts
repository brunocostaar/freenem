import { ESSAY_CHARS_PER_LINE, ESSAY_MAX_CHARS, ESSAY_MIN_CHARS } from '@freenem/shared';

/** Máximo de "linhas equivalentes" (texto quebrado em ~90 caracteres) aceito para correção. */
export const MAX_LINE_EQUIVALENTS = 45;
/** Máximo de linhas físicas não vazias (impede abusar de quebras de linha). */
export const MAX_PHYSICAL_LINES = 80;

export class SanitizeError extends Error {
  constructor(
    public code: 'TEXT_TOO_SHORT' | 'TEXT_TOO_LONG' | 'TEXT_TOO_MANY_LINES',
    message: string,
  ) {
    super(message);
    this.name = 'SanitizeError';
  }
}

export interface SanitizeResult {
  /** texto seguro para ir ao modelo */
  text: string;
  /** tentativas de forjar as tags de delimitação (</redacao>, <tema>, <system>...) */
  delimiterAttempts: number;
  /** caracteres invisíveis/controle removidos (sinal fraco de ofuscação) */
  removedHiddenChars: number;
  lineEquivalents: number;
}

// Zero-width, marcas direcionais, overrides/isolates bidi, BOM e separadores invisíveis.
const HIDDEN_RE = new RegExp(
  '[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF\\u00AD\\u180E]',
  'gu',
);
// Controle C0/C1 exceto \n (\r e \t viram espaço/quebra antes).
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/gu;
const TAG_RE =
  /<\s*\/?\s*(redacao|redação|tema|system|assistant|user|human|tool|instructions?)\b/giu;

/** Retorna só o necessário para detectar tentativas de forjar delimitadores. */
export function countDelimiterAttempts(text: string): number {
  return (text.match(TAG_RE) ?? []).length;
}

/**
 * Sanitização do texto do aluno (primeira camada contra prompt injection):
 * NFKC, remoção de invisíveis/controle, colapso de linhas em branco, neutralização de
 * `<` e `>` (nenhuma tag consegue fechar/abrir o bloco <redacao>) e limites de tamanho.
 */
export function sanitizeEssayText(
  raw: string,
  limits: { min?: number; max?: number } = {},
): SanitizeResult {
  const min = limits.min ?? ESSAY_MIN_CHARS;
  const max = limits.max ?? ESSAY_MAX_CHARS;

  // Limite duro antes de qualquer processamento (evita custo com entradas gigantes).
  if (raw.length > max * 3) {
    throw new SanitizeError('TEXT_TOO_LONG', `O texto excede ${max} caracteres.`);
  }

  let s = raw.normalize('NFKC');
  s = s.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  // Conta invisíveis depois de NFKC (que já converte alguns espaços especiais).
  const hiddenBefore = s.length;
  s = s.replace(HIDDEN_RE, '').replace(CONTROL_RE, '');
  const removedHiddenChars = hiddenBefore - s.length;

  // Detecta antes de neutralizar.
  const delimiterAttempts = countDelimiterAttempts(s);
  s = s.replace(/</g, '‹').replace(/>/g, '›');

  s = s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (s.length < min) {
    throw new SanitizeError(
      'TEXT_TOO_SHORT',
      `O texto precisa ter ao menos ${min} caracteres para ser corrigido.`,
    );
  }
  if (s.length > max) {
    throw new SanitizeError('TEXT_TOO_LONG', `O texto excede ${max} caracteres.`);
  }

  const lines = s.split('\n').filter((l) => l.trim() !== '');
  const lineEquivalents = countLineEquivalents(s);
  if (lines.length > MAX_PHYSICAL_LINES || lineEquivalents > MAX_LINE_EQUIVALENTS) {
    throw new SanitizeError(
      'TEXT_TOO_MANY_LINES',
      'O texto tem linhas demais. Revise a formatação (parágrafos corridos).',
    );
  }

  return { text: s, delimiterAttempts, removedHiddenChars, lineEquivalents };
}

export function countLineEquivalents(text: string): number {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / ESSAY_CHARS_PER_LINE)), 0);
}

/** Texto curto confiável (tema) pronto para ir entre tags: sem `<`/`>`, uma linha, limitado. */
export function sanitizeShortField(raw: string, maxLen = 500): string {
  return raw
    .normalize('NFKC')
    .replace(HIDDEN_RE, '')
    .replace(CONTROL_RE, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

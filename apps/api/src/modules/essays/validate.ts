import {
  COMPETENCY_JUSTIFICATION_MAX,
  COMPETENCY_KEYS,
  COMPETENCY_SUGGESTION_MAX,
  GENERAL_FEEDBACK_MAX,
  modelCorrectionOutputSchema,
  type EssayCorrection,
  type InjectionSource,
  type ModelCorrectionOutput,
} from '@freenem/shared';
import type { InjectionScan } from './injection.js';

export type ValidationResult =
  { ok: true; data: ModelCorrectionOutput } | { ok: false; error: string };

/**
 * Valida a saída bruta do modelo. Estrito: sem chaves extras, notas só em {0,40,...,200},
 * tamanhos limitados. Texto livre fora desses campos nunca é repassado.
 */
export function validateModelOutput(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'saída não é um objeto' };
  }
  const parsed = modelCorrectionOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.path.join('.')).join(', ') };
  }
  return { ok: true, data: parsed.data };
}

/* eslint-disable no-control-regex */
const CONTROL_RE = new RegExp(
  '[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]',
  'gu',
);

/** Remove HTML/Markdown de link/URLs/controle e limita o tamanho. Saída é texto simples. */
export function cleanText(input: string, max: number): string {
  return input
    .normalize('NFKC')
    .replace(CONTROL_RE, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link removido]')
    .replace(/[`*_#]{2,}/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const INJECTION_FEEDBACK =
  'O texto contém trechos que tentam manipular a correção (por exemplo, instruções dirigidas ao corretor ou à IA). Pelas regras do ENEM, partes deliberadamente desconectadas do tema são desconsideradas, e por isso esta redação foi sinalizada e recebeu nota 0. Se você acredita que houve engano, reescreva o trecho sem frases que se dirijam ao corretor.';
const INJECTION_JUSTIFICATION = 'Não avaliada: texto sinalizado por tentativa de manipulação.';

export interface FinalizedCorrection {
  status: 'corrected' | 'flagged';
  totalScore: number;
  correction: EssayCorrection;
}

export function flaggedCorrection(
  injectionSource: InjectionSource,
  isDemo: boolean,
): FinalizedCorrection {
  const zero = { score: 0 as const, justification: INJECTION_JUSTIFICATION, suggestions: [] };
  return {
    status: 'flagged',
    totalScore: 0,
    correction: {
      c1: zero,
      c2: zero,
      c3: zero,
      c4: zero,
      c5: zero,
      generalFeedback: INJECTION_FEEDBACK,
      zeroReason: 'parte_desconectada',
      humanRightsViolation: false,
      injectionSuspected: true,
      injectionSource,
      isDemo,
    },
  };
}

/**
 * Política final (determinística, não depende do modelo):
 * 1. injeção suspeita (heurística OU modelo) -> status `flagged`, todas as notas 0, feedback
 *    fixo. Não tentamos "corrigir ignorando o trecho": isso depende do próprio modelo
 *    possivelmente comprometido.
 * 2. `zeroReason` -> redação anulada: todas as notas 0.
 * 3. `humanRightsViolation` -> apenas C5 = 0.
 * 4. total = soma das 5 competências (recalculado aqui, nunca vindo do modelo).
 */
export function finalizeCorrection(
  out: ModelCorrectionOutput,
  scan: InjectionScan,
  opts: { isDemo: boolean },
): FinalizedCorrection {
  const heuristic = scan.flagged;
  const model = out.injectionSuspected;
  const injectionSource: InjectionSource | null =
    heuristic && model ? 'both' : heuristic ? 'heuristic' : model ? 'model' : null;

  if (injectionSource) return flaggedCorrection(injectionSource, opts.isDemo);

  const cleaned = {} as Pick<EssayCorrection, (typeof COMPETENCY_KEYS)[number]>;
  for (const k of COMPETENCY_KEYS) {
    const c = out[k];
    cleaned[k] = {
      score: c.score,
      justification: cleanText(c.justification, COMPETENCY_JUSTIFICATION_MAX),
      suggestions: c.suggestions
        .map((s) => cleanText(s, COMPETENCY_SUGGESTION_MAX))
        .filter((s) => s !== ''),
    };
  }

  if (out.zeroReason) {
    for (const k of COMPETENCY_KEYS) cleaned[k] = { ...cleaned[k], score: 0 };
  } else if (out.humanRightsViolation) {
    cleaned.c5 = { ...cleaned.c5, score: 0 };
  }

  const totalScore = COMPETENCY_KEYS.reduce((sum, k) => sum + cleaned[k].score, 0);
  return {
    status: 'corrected',
    totalScore,
    correction: {
      ...cleaned,
      generalFeedback: cleanText(out.generalFeedback, GENERAL_FEEDBACK_MAX),
      zeroReason: out.zeroReason,
      humanRightsViolation: out.humanRightsViolation,
      injectionSuspected: false,
      injectionSource: null,
      isDemo: opts.isDemo,
    },
  };
}

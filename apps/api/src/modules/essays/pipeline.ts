import { scanForInjection, type InjectionScan } from './injection.js';
import type { EssayCorrector } from './corrector.js';
import { sanitizeEssayText } from './sanitize.js';
import { finalizeCorrection, validateModelOutput, type FinalizedCorrection } from './validate.js';

export class CorrectionInvalidOutputError extends Error {
  constructor() {
    super('A IA devolveu uma resposta inválida.');
    this.name = 'CorrectionInvalidOutputError';
  }
}

/**
 * A heurística pré-modelo sinalizou o texto. Não vira correção: o service trata como tentativa
 * falha (não consome a cota diária) e pede ao aluno que revise o texto.
 */
export class HeuristicFlaggedError extends Error {
  constructor(public scan: InjectionScan) {
    super('Texto sinalizado pela heurística de injeção.');
    this.name = 'HeuristicFlaggedError';
  }
}

export interface PipelineResult extends FinalizedCorrection {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  scan: InjectionScan;
}

/**
 * Pipeline completo e independente de transporte:
 * sanitiza -> heurística de injection -> (se limpo) modelo -> valida (1 retry) -> política final.
 *
 * Se a heurística já sinaliza manipulação, o modelo NEM É CHAMADO (evita custo e superfície de
 * ataque) e lança `HeuristicFlaggedError`: nada é gravado e a cota diária não é consumida.
 * Sinalização vinda do modelo continua gerando uma correção `flagged` com nota 0.
 * Lança também `SanitizeError` (texto inválido) ou `CorrectionInvalidOutputError`.
 */
export async function runCorrectionPipeline(
  corrector: EssayCorrector,
  input: { theme: string; text: string },
): Promise<PipelineResult> {
  const sanitized = sanitizeEssayText(input.text);
  const scan = scanForInjection(sanitized.text, sanitized);

  if (scan.flagged) throw new HeuristicFlaggedError(scan);

  let inputTokens = 0;
  let outputTokens = 0;
  let model = 'unknown';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await corrector.correct({ theme: input.theme, text: sanitized.text });
    model = res.model;
    inputTokens += res.inputTokens ?? 0;
    outputTokens += res.outputTokens ?? 0;
    const v = validateModelOutput(res.raw);
    if (v.ok) {
      const fin = finalizeCorrection(v.data, scan, { isDemo: corrector.isDemo });
      return { ...fin, model, inputTokens, outputTokens, scan };
    }
  }
  throw new CorrectionInvalidOutputError();
}

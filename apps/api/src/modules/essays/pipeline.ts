import { scanForInjection, type InjectionScan } from './injection.js';
import type { EssayCorrector } from './corrector.js';
import { sanitizeEssayText } from './sanitize.js';
import {
  finalizeCorrection,
  flaggedCorrection,
  validateModelOutput,
  type FinalizedCorrection,
} from './validate.js';

export class CorrectionInvalidOutputError extends Error {
  constructor() {
    super('A IA devolveu uma resposta inválida.');
    this.name = 'CorrectionInvalidOutputError';
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
 * Se a heurística já sinaliza manipulação, o modelo NEM É CHAMADO: o resultado seria `flagged`
 * de qualquer jeito, e evitamos custo e superfície de ataque.
 * Lança `SanitizeError` (texto inválido; não consome a cota) ou `CorrectionInvalidOutputError`.
 */
export async function runCorrectionPipeline(
  corrector: EssayCorrector,
  input: { theme: string; text: string },
): Promise<PipelineResult> {
  const sanitized = sanitizeEssayText(input.text);
  const scan = scanForInjection(sanitized.text, sanitized);

  if (scan.flagged) {
    return {
      ...flaggedCorrection('heuristic', corrector.isDemo),
      model: corrector.isDemo ? 'mock' : 'heuristic',
      inputTokens: null,
      outputTokens: null,
      scan,
    };
  }

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

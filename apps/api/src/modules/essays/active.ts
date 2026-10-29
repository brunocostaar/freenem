import { env } from '../../env.js';
import { ClaudeCorrector, MockCorrector, type EssayCorrector } from './corrector.js';

let override: EssayCorrector | null = null;
let cached: EssayCorrector | null = null;

/** Corretor ativo: Claude se houver ANTHROPIC_API_KEY, senão o mock de demonstração. */
export function getCorrector(): EssayCorrector {
  if (override) return override;
  cached ??= env.ANTHROPIC_API_KEY
    ? new ClaudeCorrector(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL)
    : new MockCorrector();
  return cached;
}

/** Só para testes: troca o corretor (null restaura o padrão). */
export function setCorrectorForTests(c: EssayCorrector | null) {
  override = c;
}

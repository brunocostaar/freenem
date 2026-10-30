import { env } from '../../env.js';
import { ClaudeCorrector, MockCorrector, type EssayCorrector } from './corrector.js';
import { DeepSeekCorrector } from './deepseek.js';

let override: EssayCorrector | null = null;
let cached: EssayCorrector | null = null;

/**
 * Corretor ativo: DeepSeek se houver DEEPSEEK_API_KEY, senão Claude se houver ANTHROPIC_API_KEY,
 * senão o mock de demonstração.
 */
export function getCorrector(): EssayCorrector {
  if (override) return override;
  cached ??= env.DEEPSEEK_API_KEY
    ? new DeepSeekCorrector(env.DEEPSEEK_API_KEY, env.DEEPSEEK_MODEL, env.DEEPSEEK_BASE_URL)
    : env.ANTHROPIC_API_KEY
      ? new ClaudeCorrector(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL, env.ANTHROPIC_EFFORT)
      : new MockCorrector();
  return cached;
}

/** Só para testes: troca o corretor (null restaura o padrão). */
export function setCorrectorForTests(c: EssayCorrector | null) {
  override = c;
}

import type { CorrectorInput, CorrectorResult, EssayCorrector } from './corrector.js';
import { CorrectionRefusedError } from './corrector.js';
import { OUTPUT_JSON_SCHEMA, SYSTEM_PROMPT, buildUserMessage } from './prompt.js';

const MAX_OUTPUT_TOKENS = 4000;
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Sem saída estruturada por schema na API do DeepSeek (só `json_object`): o schema vai no
 * system prompt e a validação estrita (Zod, validate.ts) continua sendo a barreira real.
 */
export const DEEPSEEK_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

# FORMATO DA RESPOSTA
Responda com um único objeto JSON válido que siga exatamente este JSON Schema (score só pode ser 0, 40, 80, 120, 160 ou 200; zeroReason é null quando a redação não deve ser zerada):
${JSON.stringify(OUTPUT_JSON_SCHEMA)}`;

/** Corpo da requisição (função pura, testável). A redação vai só na mensagem do usuário. */
export function buildDeepSeekRequest(input: CorrectorInput, model: string) {
  return {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.2,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: DEEPSEEK_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildUserMessage(input) },
    ],
  };
}

interface ChatCompletion {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** DeepSeek (API compatível com OpenAI) via fetch. Sem ferramentas e sem histórico. */
export class DeepSeekCorrector implements EssayCorrector {
  readonly isDemo = false;

  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl = 'https://api.deepseek.com',
  ) {}

  async correct(input: CorrectorInput): Promise<CorrectorResult> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(buildDeepSeekRequest(input, this.model)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error(`[essays] DeepSeek API error ${res.status}:`, detail);
      throw new Error(`DeepSeek API error ${res.status}`);
    }
    const body = (await res.json()) as ChatCompletion;
    const choice = body.choices?.[0];
    const base = {
      model: body.model ?? this.model,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
    };
    if (choice?.finish_reason === 'content_filter') {
      console.error('[essays] correção bloqueada pelo filtro do DeepSeek');
      throw new CorrectionRefusedError();
    }
    if (choice?.finish_reason === 'length') {
      console.error('[essays] saída truncada (finish_reason=length); tentando de novo');
      return { raw: undefined, ...base };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(choice?.message?.content ?? '');
    } catch {
      raw = undefined; // validação falha -> retry no pipeline
    }
    return { raw, ...base };
  }
}

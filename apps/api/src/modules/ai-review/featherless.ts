import { env } from '../../env.js';

const REQUEST_TIMEOUT_MS = 90_000;

export type ContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatResult {
  content: string;
  costUsd: number | null;
}

interface Completion {
  choices?: { message?: { content?: string | null } }[];
  usage?: { cost?: number | string | null };
}

/** Chat completion (API compatível com OpenAI) na Featherless. Usa o `fetch` global. */
export async function chat(
  model: string,
  system: string,
  user: ContentPart[],
): Promise<ChatResult> {
  const res = await fetch(`${env.FEATHERLESS_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.FEATHERLESS_API_KEY ?? ''}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    console.error(`[ai-review] Featherless error ${res.status}:`, detail);
    throw new Error(`Featherless error ${res.status}`);
  }
  const body = (await res.json()) as Completion;
  const cost = Number(body.usage?.cost);
  return {
    content: body.choices?.[0]?.message?.content ?? '',
    costUsd: Number.isFinite(cost) ? cost : null,
  };
}

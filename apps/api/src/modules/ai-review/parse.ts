import { aiModelOutputSchema, type AiModelOutput, type AiVerdict } from '@freenem/shared';

/** Remove blocos <think>, cercas ``` e extrai o primeiro objeto JSON. Devolve null se inválido. */
export function parseModelOutput(raw: string): AiModelOutput | null {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '');
  text = text.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = aiModelOutputSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface Evaluation {
  verdict: AiVerdict;
  answerMatches: boolean | null;
}

/** Compara a letra do modelo com o gabarito e decide o veredito. */
export function evaluate(output: AiModelOutput, correctLetter: string | null): Evaluation {
  const answerMatches = output.answer && correctLetter ? output.answer === correctLetter : null;
  const issues = output.issues.map((i) => i.trim()).filter(Boolean);
  if (issues.length > 0) return { verdict: 'problem', answerMatches };
  if (answerMatches === false && output.confidence === 'high') {
    return { verdict: 'problem', answerMatches };
  }
  if (output.answer === null || output.confidence === 'low' || answerMatches === false) {
    return { verdict: 'unsure', answerMatches };
  }
  return { verdict: 'ok', answerMatches };
}

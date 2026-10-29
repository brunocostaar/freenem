import Anthropic from '@anthropic-ai/sdk';
import type { ModelCorrectionOutput, CompetencyResult } from '@freenem/shared';
import {
  SUBMIT_TOOL_INPUT_SCHEMA,
  SUBMIT_TOOL_NAME,
  SYSTEM_PROMPT,
  buildUserMessage,
} from './prompt.js';

export interface CorrectorInput {
  /** título do tema (do nosso banco) */
  theme: string;
  /** texto JÁ sanitizado */
  text: string;
}

export interface CorrectorResult {
  /** saída bruta, NÃO validada: o pipeline valida com Zod antes de usar */
  raw: unknown;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface EssayCorrector {
  /** true = correção de demonstração (sem IA) */
  readonly isDemo: boolean;
  correct(input: CorrectorInput): Promise<CorrectorResult>;
}

const MAX_OUTPUT_TOKENS = 2000;
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Claude via tool use com `tool_choice` forçado em uma única ferramenta (`submit_correction`).
 * É o mecanismo mais robusto: o modelo é obrigado a responder com um bloco `tool_use` cujo
 * `input` segue o JSON Schema. Sem outras ferramentas e sem histórico. (O SDK atual não aceita `temperature` nos modelos novos.)
 * (Extended thinking é incompatível com tool_choice forçado, então não é usado.)
 */
export class ClaudeCorrector implements EssayCorrector {
  readonly isDemo = false;
  private client: Anthropic;

  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS });
  }

  async correct(input: CorrectorInput): Promise<CorrectorResult> {
    const msg = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: SUBMIT_TOOL_NAME,
            description:
              'Registra a correção final da redação. Deve ser chamada exatamente uma vez com todos os campos.',
            input_schema: SUBMIT_TOOL_INPUT_SCHEMA as unknown as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: 'tool', name: SUBMIT_TOOL_NAME, disable_parallel_tool_use: true },
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const block = msg.content.find((b) => b.type === 'tool_use' && b.name === SUBMIT_TOOL_NAME);
    return {
      raw: block && block.type === 'tool_use' ? block.input : undefined,
      model: msg.model ?? this.model,
      inputTokens: msg.usage?.input_tokens ?? null,
      outputTokens: msg.usage?.output_tokens ?? null,
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Mock (demonstração): heurísticas determinísticas, sem IA.

const CONNECTIVES = [
  'portanto',
  'entretanto',
  'contudo',
  'todavia',
  'alem disso',
  'ademais',
  'logo',
  'assim',
  'dessa forma',
  'nesse sentido',
  'por conseguinte',
  'em suma',
  'sobretudo',
  'outrossim',
  'consequentemente',
  'porem',
  'pois',
  'visto que',
  'uma vez que',
  'haja vista',
  'dado que',
  'com efeito',
  'por outro lado',
  'em primeiro lugar',
  'nessa perspectiva',
  'diante disso',
  'a fim de',
  'embora',
  'apesar de',
  'dessarte',
];
const INFORMAL = [' vc ', ' tb ', ' pq ', ' kkk', ' blz', ' td ', ' mt ', ' msm ', ' q '];
const STOP = new Set([
  'para',
  'como',
  'sobre',
  'entre',
  'desafios',
  'caminhos',
  'brasil',
  'brasileira',
  'sociedade',
  'pelo',
  'pela',
]);

function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

function band(n: number, thresholds: number[]): number {
  // thresholds ascendentes: devolve 40 * (quantos limiares n alcança), mínimo 40.
  return Math.max(40, 40 * thresholds.filter((t) => n >= t).length) as number;
}
const asScore = (n: number): CompetencyResult['score'] => {
  const v = Math.min(200, Math.max(0, Math.round(n / 40) * 40));
  return v as CompetencyResult['score'];
};

export class MockCorrector implements EssayCorrector {
  readonly isDemo = true;

  async correct(input: CorrectorInput): Promise<CorrectorResult> {
    return { raw: this.score(input), model: 'mock', inputTokens: null, outputTokens: null };
  }

  score({ theme, text }: CorrectorInput): ModelCorrectionOutput {
    const f = ` ${fold(text).replace(/\s+/g, ' ')} `;
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 40);
    const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0);
    const words = f.split(' ').filter(Boolean);
    const avgSentence = words.length / Math.max(1, sentences.length);
    const lowerStarts = sentences.filter((s) => /^[a-zà-ú]/.test(s.trim())).length;
    const informal = INFORMAL.filter((w) => f.includes(w)).length;
    const connectives = CONNECTIVES.filter((c) => f.includes(` ${c} `)).length;
    const unique = new Set(words).size / Math.max(1, words.length);

    const themeWords = fold(theme)
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 5 && !STOP.has(w));
    const overlap = themeWords.length
      ? themeWords.filter((w) => f.includes(w.slice(0, Math.max(5, w.length - 2)))).length /
        themeWords.length
      : 1;

    const lastPara = fold(paragraphs.at(-1) ?? '');
    const elements = [
      /\b(governo|ministerio|estado|escola|midia|sociedade|congresso|ong|familia|poder publico|instituicoes)\b/,
      /\b(deve|devem|cabe|cabem|precisa|e necessario|necessario)\b/,
      /\b(por meio|atraves|mediante|campanhas|programas|leis|projetos|investimento)\b/,
      /\b(a fim de|para que|com o objetivo|com a finalidade|de modo a|visando)\b/,
      /\b(como|isto e|ou seja|por exemplo|tais como|ate)\b/,
    ].filter((re) => re.test(lastPara)).length;

    let c1 = 160 - 40 * Math.min(2, informal) - (avgSentence > 40 || avgSentence < 8 ? 40 : 0);
    if (lowerStarts / Math.max(1, sentences.length) > 0.2) c1 -= 40;
    const c2 =
      (paragraphs.length >= 4 ? 160 : paragraphs.length === 3 ? 120 : 80) -
      (overlap < 0.35 ? 40 : 0) +
      (text.length > 2200 && paragraphs.length >= 4 ? 40 : 0);
    const c3 = band(text.length, [400, 900, 1400, 1900, 2400]) - (unique < 0.45 ? 40 : 0);
    const c4 = band(connectives, [2, 4, 6, 8, 10]);
    const c5 = elements * 40;

    const zeroReason =
      overlap < 0.15 && themeWords.length >= 2
        ? ('fuga_ao_tema' as const)
        : paragraphs.length < 2 && text.length < 800
          ? ('nao_atendimento_tipologia' as const)
          : null;

    const mk = (score: number, justification: string, suggestions: string[]): CompetencyResult => ({
      score: asScore(score),
      justification,
      suggestions,
    });
    const demo = ' (correção de demonstração, sem IA)';
    return {
      c1: mk(c1, `Estimativa por heurística simples sobre registro e extensão das frases${demo}.`, [
        'Revise ortografia e pontuação antes de enviar.',
        'Evite marcas de oralidade e abreviações.',
      ]),
      c2: mk(c2, `Estimativa pela estrutura em parágrafos e aderência ao tema${demo}.`, [
        'Organize em introdução, dois desenvolvimentos e conclusão.',
        'Use repertório sociocultural para sustentar a tese.',
      ]),
      c3: mk(c3, `Estimativa pela extensão e variedade vocabular do texto${demo}.`, [
        'Defenda um ponto de vista claro e desenvolva cada argumento.',
      ]),
      c4: mk(c4, `Identificados ${connectives} conectivos distintos${demo}.`, [
        'Varie os conectivos entre e dentro dos parágrafos.',
      ]),
      c5: mk(c5, `Identificados ${elements} de 5 elementos da proposta de intervenção${demo}.`, [
        'Inclua agente, ação, meio, finalidade e detalhamento.',
      ]),
      generalFeedback:
        'Esta é uma correção de demonstração: as notas foram estimadas por regras simples e não refletem uma avaliação real. Configure a chave da IA no servidor para obter correção completa por competência.',
      zeroReason,
      humanRightsViolation: false,
      injectionSuspected: false,
    };
  }
}

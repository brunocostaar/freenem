/**
 * Detector heurístico de prompt injection, INDEPENDENTE do modelo (segunda camada).
 *
 * Roda sobre uma "pele" normalizada do texto (minúsculas, sem acentos, homóglifos
 * cirílicos/gregos mapeados para latinos, e uma variante leetspeak), em versão com espaços e
 * em versão "colada" (sem separadores) para pegar ofuscações como "i g n o r e".
 *
 * - `strong`: padrões muito específicos de manipulação (qualquer um já sinaliza).
 * - `weak`: indícios fracos; 2 ou mais sinalizam, 1 sozinho só é repassado ao modelo.
 */

export interface InjectionScan {
  strong: string[];
  weak: string[];
  flagged: boolean;
}

const CONFUSABLES: Record<string, string> = {
  // cirílico
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  і: 'i',
  ј: 'j',
  ѕ: 's',
  к: 'k',
  м: 'm',
  н: 'h',
  т: 't',
  в: 'b',
  ԁ: 'd',
  ӏ: 'l',
  // grego
  α: 'a',
  ε: 'e',
  ο: 'o',
  ρ: 'p',
  ν: 'v',
  ι: 'i',
  κ: 'k',
  τ: 't',
  υ: 'u',
  η: 'n',
};
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

function skeleton(text: string, leet: boolean): string {
  let s = text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
  s = Array.from(s, (c) => CONFUSABLES[c] ?? (leet ? (LEET[c] ?? c) : c)).join('');
  return s;
}
const spaced = (s: string) => s.replace(/[^a-z0-9]+/g, ' ').trim();
const squashed = (s: string) => s.replace(/[^a-z0-9]+/g, '');

interface Rule {
  id: string;
  re: RegExp;
}

// Aplicadas na versão com espaços (palavras separadas por 1 espaço).
const SPACED_STRONG: Rule[] = [
  {
    id: 'ignore_instructions',
    re: /\b(ignor\w*|desconsider\w*|esquec\w*|desobedec\w*|disregard|forget|override|bypass|olvid\w*|omit\w*)\b.{0,50}\b(instru\w*|regras?|comandos?|prompts?|orienta\w*|anteriores|previous|prior|above|instructions?|rules|acima|guidelines|diretrizes)\b/,
  },
  {
    id: 'system_prompt',
    re: /\b(system|sistema)\s+prompt\b|\bprompt\s+(do\s+)?(sistema|inicial)\b/,
  },
  {
    id: 'score_command',
    re: /\b(dar|atribua|atribuir|conceda|coloque|ponha|give|assign|award|grant|set|put|dale|otorga|pon)\b.{0,30}\b(nota|score|grade|marks?|pontos?|puntuacion|calificacion)\b.{0,30}\b(maxima|maximo|1000|mil|200|perfect\w*|full|highest|perfeita)\b/,
  },
  {
    id: 'score_command_tight',
    re: /\b(de|da)\s+(uma\s+)?(nota|pontuacao)\s+(maxima|1000|mil|10|dez)\b/,
  },
  {
    id: 'score_command2',
    re: /\b(nota|score|grade|puntuacion|calificacion)\s+(maxima|1000|mil|perfeita|perfect|maximum)\b/,
  },
  { id: 'score_1000', re: /\b(1000|mil)\s+(pontos|points|puntos)\b|\bscore\s+(of\s+)?1000\b/ },
  {
    id: 'role_reassign',
    re: /\b(voce|tu|you|usted)\s+(agora\s+)?(e|eres|es|are|sera|serao|will\s+be|now)\s+(agora\s+)?(um|uma|o|a|an|now|un|una)?\s*\w{0,20}\s*(assistente|assistant|chatbot|modelo|model|ia|ai|gpt|claude|corretor|corretora|grader|avaliador|jailbreak|dan|hacker|robo)\b/,
  },
  {
    id: 'roleplay',
    re: /\b(ahora eres|voce agora e|you are now|atue como|aja como|finja|fingir|pretend|act as|actua como|haz de cuenta|role\s*play|roleplay|jailbreak|modo desenvolvedor|developer mode|dan mode)\b/,
  },
  {
    id: 'special_tokens',
    re: /\b(im start|im end|endoftext|begin system|end system|begin prompt|end prompt)\b|\[\s*\/?\s*inst\s*\]|sys\s*>>/,
  },
  {
    id: 'forged_output',
    re: /\bsubmit correction\b|\btool use\b|\bfunction call\b/,
  },
  {
    id: 'output_directive',
    re: /\b(responda|retorne|devolva|saida|output|respond|reply|return)\b.{0,30}\b(apenas|somente|only|just|exatamente|exactly)?\s*(com\s+|em\s+|in\s+|with\s+)?(json|o seguinte|the following)\b/,
  },
  {
    id: 'address_grader',
    re: /\b(caro|cara|prezado|prezada|querido|querida|dear|hey|hello|ola|oi|atencao|aviso|attention|note|nota para)\b.{0,15}\b(corretor|corretora|avaliador|avaliadora|grader|evaluator|corrector|assistente|assistant|modelo|model|claude|gpt|ia)\b/,
  },
  {
    id: 'meta_instruction',
    re: /\b(nao|do not|dont|never|nunca)\b.{0,25}\b(penalize|penalizar|descontar|desconte|reduza|diminua|reduce|deduct)\b|\b(instrucao|instruction|ordem|order|comando|command)\s+(do|from|of)\s+(sistema|system|desenvolvedor|developer|administrador|admin)\b/,
  },
];

// Aplicadas na versão minúscula SEM remover pontuação (dois pontos, aspas, chaves).
const RAW_STRONG: Rule[] = [
  {
    id: 'role_marker',
    re: /(^|\n)\s*(assistant|assistente|system|sistema|human|humano|ia|ai)\s*:/,
  },
  {
    id: 'forged_json',
    re: /"(c[1-5]|score|totalscore|injectionsuspected|zeroreason|generalfeedback|justification|suggestions|humanrightsviolation)"\s*:|\bc[1-5]\s*[:=]\s*[{[]/,
  },
];

// Aplicadas na versão colada (sem separadores): frases curtas e muito específicas.
const SQUASHED_STRONG: string[] = [
  'ignoreasinstrucoes',
  'ignoretodasasinstrucoes',
  'ignoretudoacima',
  'ignoreasregras',
  'ignoreoanterior',
  'ignoreasanteriores',
  'desconsidereasinstrucoes',
  'desconsidereoanterior',
  'esquecaasinstrucoes',
  'esquecatudo',
  'ignorepreviousinstructions',
  'ignoreallpreviousinstructions',
  'ignoreallinstructions',
  'ignoretheabove',
  'ignoreyourinstructions',
  'disregardpreviousinstructions',
  'disregardallprior',
  'forgetpreviousinstructions',
  'forgetallinstructions',
  'forgetyourinstructions',
  'ignorelasinstrucciones',
  'ignoratodaslasinstrucciones',
  'olvidalasinstrucciones',
  'systemprompt',
  'promptdosistema',
  'danotamaxima',
  'dananotamaxima',
  'atribuanotamaxima',
  'notade1000',
  'nota1000paraessa',
  'givemaxscore',
  'givethisessay',
  'giveascoreof',
  'scoreof1000',
  'maximumscore',
  'dalanotamaxima',
];

const WEAK_RAW: Rule[] = [
  { id: 'you_are_a', re: /\bvoce e (um|uma)\b|\byou are (a|an)\b|\beres un(a)?\b/ },
  { id: 'hash_headings', re: /(^|\n)\s*#{3,}/ },
  { id: 'code_fence', re: /```|~~~/ },
  { id: 'xml_like', re: /[‹<][a-z_]{3,20}[›>]/ },
  { id: 'prompt_word', re: /\bprompt\b|\bchatgpt\b|\bgpt-?4\b|\bllm\b/ },
];

export function scanForInjection(
  text: string,
  signals: { delimiterAttempts?: number; removedHiddenChars?: number } = {},
): InjectionScan {
  const strong = new Set<string>();
  const weak = new Set<string>();

  if ((signals.delimiterAttempts ?? 0) > 0) strong.add('forged_delimiters');
  if ((signals.removedHiddenChars ?? 0) >= 8) weak.add('hidden_chars');

  for (const leet of [false, true]) {
    const sk = skeleton(text, leet);
    const sp = spaced(sk);
    const sq = squashed(sk);
    if (!leet) for (const r of RAW_STRONG) if (r.re.test(sk)) strong.add(r.id);
    for (const r of SPACED_STRONG) if (r.re.test(sp)) strong.add(r.id);
    for (const phrase of SQUASHED_STRONG)
      if (sq.includes(phrase)) strong.add(`obfuscated:${phrase}`);
  }

  const lower = skeleton(text, false);
  const lowerSpaced = spaced(lower);
  for (const r of WEAK_RAW) if (r.re.test(lower) || r.re.test(lowerSpaced)) weak.add(r.id);
  // blobs base64/hex longos sem espaços
  if (/[A-Za-z0-9+/_-]{60,}={0,2}/.test(text)) weak.add('encoded_blob');
  // proporção alta de símbolos (texto não natural)
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (text.length > 0 && letters / text.length < 0.6) weak.add('low_letter_ratio');

  return {
    strong: [...strong],
    weak: [...weak],
    flagged: strong.size > 0 || weak.size >= 2,
  };
}

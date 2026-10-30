import { ALL_SUBJECTS, classify, normalize, PUBLISH_MIN_SUBJECT_CONFIDENCE } from './classify.js';
import type { TopicRef } from './classify.js';

/**
 * Classificação de questões de vestibular (sem áreas do ENEM):
 *  - matéria conhecida pela posição na prova (UFRGS: blocos por matéria) → só os assuntos são inferidos;
 *  - língua estrangeira detectada pelo texto (palavras funcionais de inglês/espanhol);
 *  - senão, pontuação por palavras-chave entre TODAS as matérias; abaixo da confiança mínima a
 *    matéria fica em branco (o revisor define em /admin/revisao).
 */
export interface VestibularClassification {
  subject: string | null;
  topics: TopicRef[];
  confidence: number;
  how: 'posicao' | 'idioma' | 'palavras-chave' | 'indefinida';
}

const EN = new Set(
  'the of and to in is that for with as by on are this from be at or an it not was which have has can their its they more than these also but about into most such other when'.split(
    ' ',
  ),
);
const ES = new Set(
  'el la los las de que y en un una para por con del se su al lo como más pero sus le ya o este sí porque esta entre cuando muy sin sobre también me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos'.split(
    ' ',
  ),
);
const PT = new Set(
  'o a os as de que e em um uma para por com do da dos das se seu sua ao como mais mas não é são foi ser tem já ou este esta isso pelo pela nas nos entre quando muito sobre também até'.split(
    ' ',
  ),
);

/** 'ingles' / 'espanhol' quando o texto é majoritariamente nessa língua; senão `null`. */
export function detectLanguage(text: string): 'ingles' | 'espanhol' | null {
  const words = normalize(text)
    .replace(/[^a-zñ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (words.length < 25) return null;
  const share = (set: Set<string>) => words.filter((w) => set.has(w)).length / words.length;
  const en = share(EN);
  const es = share(ES);
  const pt = share(PT);
  if (en > 0.17 && en > pt * 1.8 && en > es) return 'ingles';
  if (es > 0.17 && es > pt * 1.5 && es > en) return 'espanhol';
  return null;
}

export function classifyVestibular(input: {
  /** enunciado + alternativas */
  text: string;
  /** matéria conhecida pela posição na prova */
  subject?: string;
  language?: 'ingles' | 'espanhol' | null;
}): VestibularClassification {
  if (input.language || input.subject === 'Inglês' || input.subject === 'Espanhol') {
    const language =
      input.language ?? (input.subject === 'Inglês' ? ('ingles' as const) : ('espanhol' as const));
    const c = classify({ text: input.text, subjects: [], language });
    return { subject: c.subject, topics: c.topics, confidence: 1, how: 'idioma' };
  }
  if (input.subject) {
    const c = classify({ text: input.text, subjects: [input.subject] });
    return { subject: input.subject, topics: c.topics, confidence: 1, how: 'posicao' };
  }
  const lang = detectLanguage(input.text);
  if (lang) {
    const c = classify({ text: input.text, subjects: [], language: lang });
    return { subject: c.subject, topics: c.topics, confidence: 0.8, how: 'idioma' };
  }
  const c = classify({ text: input.text, subjects: ALL_SUBJECTS });
  if (c.subjectConfidence < PUBLISH_MIN_SUBJECT_CONFIDENCE) {
    return { subject: null, topics: [], confidence: c.subjectConfidence, how: 'indefinida' };
  }
  return {
    subject: c.subject,
    topics: c.topics,
    confidence: c.confidence,
    how: 'palavras-chave',
  };
}

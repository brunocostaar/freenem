import type { EnemArea } from '@freenem/shared';
import { subjectsSeed } from '../../../apps/api/src/db/seed-data/taxonomy.js';
import { slugify } from '../../../apps/api/src/lib/slug.js';
import { STOPWORDS, SUBJECT_KEYWORDS, TOPIC_KEYWORDS } from './keywords.js';

/**
 * Classificador determinístico por palavras-chave: matéria (restrita à área do ENEM) e
 * assunto(s) da taxonomia semeada. Sem rede, sem LLM; para o refinamento com LLM veja
 * `classify-llm.ts`.
 */

export interface ClassifyInput {
  /** enunciado + alternativas (Markdown) */
  text: string;
  area: EnemArea;
  /** 'ingles' | 'espanhol' quando a questão é de língua estrangeira */
  language?: 'ingles' | 'espanhol' | null;
}

export interface TopicRef {
  subject: string;
  /** slug do assunto no banco (mesma regra do seed) */
  slug: string;
  name: string;
  score: number;
}

export interface Classification {
  subject: string;
  topics: TopicRef[];
  /** 0..1 */
  confidence: number;
  subjectConfidence: number;
  topicConfidence: number;
  /** pontuações por matéria da área, para depuração */
  subjectScores: Record<string, number>;
}

/** Abaixo disso a questão vai para a fila de revisão (`draft`). */
export const PUBLISH_MIN_SUBJECT_CONFIDENCE = 0.25;

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imagens: ignora URL e alt
    .replace(/[*_`#>|]/g, ' ');
}

interface Matcher {
  re: RegExp;
  weight: number;
}

function compile(spec: string): Matcher[] {
  const out: Matcher[] = [];
  for (const raw of spec.split(',')) {
    let kw = raw.trim();
    if (!kw) continue;
    let weight = 1;
    if (kw.startsWith('!')) {
      weight = 3;
      kw = kw.slice(1).trim();
    }
    let end = '';
    if (kw.endsWith('$')) {
      kw = kw.slice(0, -1);
      end = '(?![a-z0-9])';
    }
    kw = normalize(kw).trim();
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out.push({ re: new RegExp(`(?<![a-z0-9])${escaped}${end}`, 'g'), weight });
  }
  return out;
}

function score(text: string, matchers: Matcher[]): number {
  let total = 0;
  for (const m of matchers) {
    m.re.lastIndex = 0;
    const n = (text.match(m.re) ?? []).length;
    total += Math.min(n, 3) * m.weight;
  }
  return total;
}

interface TopicNode {
  subject: string;
  parent: string;
  child: string | null;
  slug: string;
  matchers: Matcher[];
}

const subjectMatchers = new Map<string, Matcher[]>();
const areaSubjects = new Map<EnemArea, string[]>();
const parentNodes = new Map<string, TopicNode[]>(); // subject -> nós de nível 1
const childNodes = new Map<string, TopicNode[]>(); // "subject/parent" -> nós de nível 2

function nameTokens(name: string): string {
  return normalize(name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 5 && !STOPWORDS.has(t))
    .map((t) => `!${t}`)
    .join(',');
}

function init() {
  for (const s of subjectsSeed) {
    areaSubjects.set(s.area, [...(areaSubjects.get(s.area) ?? []), s.name]);
    subjectMatchers.set(s.name, compile(SUBJECT_KEYWORDS[s.name] ?? ''));
    const parents: TopicNode[] = [];
    for (const [parentName, children] of Object.entries(s.topics)) {
      const key = `${s.name}/${parentName}`;
      parents.push({
        subject: s.name,
        parent: parentName,
        child: null,
        slug: slugify(parentName),
        matchers: compile(`${TOPIC_KEYWORDS[key] ?? ''},${nameTokens(parentName)}`),
      });
      childNodes.set(
        key,
        children.map((c) => ({
          subject: s.name,
          parent: parentName,
          child: c,
          slug: `${slugify(parentName)}--${slugify(c)}`,
          matchers: compile(nameTokens(c)),
        })),
      );
    }
    parentNodes.set(s.name, parents);
  }
}
init();

const LANG_SUBJECT = { ingles: 'Inglês', espanhol: 'Espanhol' } as const;

export function classify(input: ClassifyInput): Classification {
  const text = normalize(input.text);

  // 1) matéria
  let subject: string;
  let subjectConfidence: number;
  const subjectScores: Record<string, number> = {};
  if (input.language) {
    subject = LANG_SUBJECT[input.language];
    subjectConfidence = 1;
  } else {
    const candidates = (areaSubjects.get(input.area) ?? []).filter(
      (n) => n !== 'Inglês' && n !== 'Espanhol',
    );
    for (const c of candidates) subjectScores[c] = score(text, subjectMatchers.get(c) ?? []);
    const ranked = Object.entries(subjectScores).sort((a, b) => b[1] - a[1]);
    const [top, second] = ranked;
    subject = top?.[0] ?? candidates[0] ?? 'Português';
    if (candidates.length === 1) {
      subjectConfidence = 1;
    } else {
      const t = top?.[1] ?? 0;
      const s = second?.[1] ?? 0;
      // margem sobre o segundo colocado, ponderada pela evidência absoluta
      subjectConfidence = t === 0 ? 0 : Math.min(1, t / 8) * ((t - s) / t);
    }
  }

  // 2) assuntos dentro da matéria
  const parents = (parentNodes.get(subject) ?? []).map((p) => ({
    node: p,
    score: score(text, p.matchers),
  }));
  parents.sort((a, b) => b.score - a.score);
  const topics: TopicRef[] = [];
  let topicConfidence = 0;

  const pick = (p: { node: TopicNode; score: number }): TopicRef => {
    const kids = (childNodes.get(`${p.node.subject}/${p.node.parent}`) ?? [])
      .map((c) => ({ c, s: score(text, c.matchers) }))
      .sort((a, b) => b.s - a.s);
    const bestKid = kids[0];
    if (bestKid && bestKid.s > 0) {
      return {
        subject,
        slug: bestKid.c.slug,
        name: bestKid.c.child ?? p.node.parent,
        score: p.score,
      };
    }
    return { subject, slug: p.node.slug, name: p.node.parent, score: p.score };
  };

  const first = parents[0];
  const second = parents[1];
  if (first && first.score > 0) {
    topics.push(pick(first));
    if (second && second.score >= 0.6 * first.score && second.score >= 3) {
      topics.push(pick(second));
    }
    const margin = (first.score - (second?.score ?? 0)) / first.score;
    topicConfidence = Math.min(1, first.score / 9) * (0.4 + 0.6 * margin);
  }

  const confidence = subjectConfidence * (topics.length ? 0.35 + 0.65 * topicConfidence : 0.2);
  return { subject, topics, confidence, subjectConfidence, topicConfidence, subjectScores };
}

/**
 * Publica automaticamente quando a matéria é inequívoca (língua estrangeira ou área com uma
 * matéria só) ou a pontuação é clara; em ambos os casos exige ao menos um assunto
 * (exceto línguas, cujos assuntos são pouco "palavra-chave"). O resto vai para a fila de revisão.
 */
export function shouldPublish(c: Classification, language?: 'ingles' | 'espanhol' | null): boolean {
  if (language) return true;
  return c.topics.length > 0 && c.subjectConfidence >= PUBLISH_MIN_SUBJECT_CONFIDENCE;
}

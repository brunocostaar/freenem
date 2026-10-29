import { ITEM_MINUTES, type EnemArea } from '@freenem/shared';

/**
 * Gerador de plano de estudos: função pura e determinística (sem acesso a banco ou relógio).
 *
 * Resumo do algoritmo:
 * 1. Domínio estimado por tópico com suavização bayesiana (prior 50% com peso de 4 respostas).
 * 2. Prioridade = incidência normalizada x (1 - domínio) x bônus de área de foco.
 * 3. Semana a semana: (a) revisões espaçadas vencidas (+1, +3, +7, +14 semanas, escaladas pelo
 *    tamanho do plano), (b) novos tópicos por prioridade, alternando as 4 áreas, cada um com
 *    teoria + questões (só questões se o domínio já é alto), (c) o que sobrar do orçamento vira
 *    questões/revisão dos tópicos já vistos.
 * 4. Cada semana reserva um slot de redação e, a cada N semanas até a prova, um simulado.
 *    Esses dois são "itens automáticos" (calculados em `layoutWeeks`, não persistidos).
 * 5. Nunca ultrapassa o orçamento semanal (horas/semana).
 */

export interface GenTopic {
  topicId: string;
  area: EnemArea;
  /** proxy da frequência no ENEM: nº de questões publicadas do tópico (0 = desconhecido) */
  incidence: number;
  answered: number;
  correct: number;
}

export type TopicItemKind = 'theory' | 'questions' | 'review';

export interface GenDoneItem {
  topicId: string;
  kind: TopicItemKind;
  week: number;
}

export interface LayoutParams {
  /** YYYY-MM-DD, início da semana 1 */
  startDate: string;
  /** YYYY-MM-DD */
  examDate: string;
  hoursPerWeek: number;
}

export interface GenParams extends LayoutParams {
  /** 0 = domingo ... 6 = sábado (reservado para sugestão de dias; não altera o orçamento) */
  availableDays: number[];
  focusAreas?: EnemArea[];
  topics: GenTopic[];
  /** primeira semana a (re)gerar; semanas anteriores são mantidas como estão */
  fromWeek?: number;
  /** itens já concluídos (consumem orçamento e contam como tópico já visto) */
  done?: GenDoneItem[];
}

export interface GenItem {
  week: number;
  kind: TopicItemKind;
  topicId: string;
  minutes: number;
}

export interface WeekLayout {
  week: number;
  startDate: string;
  endDate: string;
  budgetMinutes: number;
  essayMinutes: number;
  simuladoMinutes: number;
  /** minutos disponíveis para itens de tópico */
  topicBudget: number;
}

const MAX_WEEKS = 60;
const REVIEW_GAPS = [1, 3, 7, 14];
const PRIOR_WEIGHT = 4;
const FOCUS_BOOST = 1.5;
const AREAS: EnemArea[] = ['linguagens', 'humanas', 'natureza', 'matematica'];

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fmt(toMs(d) + n * DAY_MS);
export const diffDays = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

export function totalWeeks(p: Pick<LayoutParams, 'startDate' | 'examDate'>): number {
  const days = diffDays(p.startDate, p.examDate);
  return Math.min(MAX_WEEKS, Math.max(1, Math.ceil(days / 7)));
}

/** Estrutura semanal (orçamento, redação, simulado): depende só de datas e horas. */
export function layoutWeeks(p: LayoutParams): WeekLayout[] {
  const W = totalWeeks(p);
  const M = Math.round(p.hoursPerWeek * 60);
  const essayMinutes = M >= 300 ? 60 : M >= 150 ? 45 : 0;
  const simuladoMinutes = M >= 180 ? Math.min(180, Math.floor(M / 2 / 5) * 5) : 0;
  const every = W >= 12 ? 4 : W >= 6 ? 3 : 2;
  const weeks: WeekLayout[] = [];
  for (let w = 1; w <= W; w++) {
    // simulados a cada `every` semanas, contando de trás para frente a partir da penúltima semana
    const hasSimulado = simuladoMinutes > 0 && W >= 3 && w >= 2 && (W - 1 - w) % every === 0;
    const sim = hasSimulado ? simuladoMinutes : 0;
    weeks.push({
      week: w,
      startDate: addDays(p.startDate, 7 * (w - 1)),
      endDate: addDays(p.startDate, 7 * w - 1),
      budgetMinutes: M,
      essayMinutes,
      simuladoMinutes: sim,
      topicBudget: M - essayMinutes - sim,
    });
  }
  return weeks;
}

/** Domínio estimado (0..1) com suavização bayesiana. */
export function estimateMastery(correct: number, answered: number): number {
  return (correct + 0.5 * PRIOR_WEIGHT) / (answered + PRIOR_WEIGHT);
}

interface Scored {
  topic: GenTopic;
  mastery: number;
  priority: number;
}

export function scoreTopics(topics: GenTopic[], focusAreas: EnemArea[] = []): Scored[] {
  const maxInc = topics.reduce((m, t) => Math.max(m, t.incidence), 0);
  return topics
    .map((topic) => {
      const mastery = estimateMastery(topic.correct, topic.answered);
      const inc = maxInc > 0 ? (topic.incidence + 1) / (maxInc + 1) : 1;
      const boost = focusAreas.includes(topic.area) ? FOCUS_BOOST : 1;
      return { topic, mastery, priority: inc * (1 - mastery) * boost };
    })
    .sort((a, b) => b.priority - a.priority || a.topic.topicId.localeCompare(b.topic.topicId));
}

/** Intervalos de revisão (em semanas) escalados pelo tamanho do plano. */
export function reviewGaps(weeks: number): number[] {
  const scale = Math.min(1, Math.max(0.25, weeks / 20));
  return [...new Set(REVIEW_GAPS.map((g) => Math.max(1, Math.round(g * scale))))].sort(
    (a, b) => a - b,
  );
}

export function generateTopicItems(p: GenParams): GenItem[] {
  const layout = layoutWeeks(p);
  const W = layout.length;
  const fromWeek = Math.max(1, p.fromWeek ?? 1);
  const gaps = reviewGaps(W);
  const done = p.done ?? [];

  const scored = scoreTopics(p.topics, p.focusAreas);
  const byId = new Map(scored.map((s) => [s.topic.topicId, s]));
  const rank = new Map(scored.map((s, i) => [s.topic.topicId, i]));
  const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);

  // tópicos já vistos (itens concluídos de teoria/questões) -> semana de introdução
  const introduced = new Map<string, number>();
  for (const d of done) {
    if (d.kind === 'review' || !byId.has(d.topicId)) continue;
    introduced.set(d.topicId, Math.min(introduced.get(d.topicId) ?? Infinity, d.week));
  }

  const dueReviews = new Map<number, string[]>();
  const addReview = (week: number, topicId: string) => {
    if (week > W) return;
    const list = dueReviews.get(week) ?? [];
    if (!list.includes(topicId)) list.push(topicId);
    dueReviews.set(week, list);
  };
  for (const [topicId, intro] of introduced) {
    for (const g of gaps) {
      const rw = intro + g;
      const alreadyDone = done.some(
        (d) => d.topicId === topicId && d.kind === 'review' && d.week === rw,
      );
      if (rw >= fromWeek && !alreadyDone) addReview(rw, topicId);
    }
  }

  // fila de novos tópicos por área, por prioridade
  const queues = new Map<EnemArea, string[]>(AREAS.map((a) => [a, []]));
  for (const s of scored) {
    if (!introduced.has(s.topic.topicId)) queues.get(s.topic.area)?.push(s.topic.topicId);
  }

  const out: GenItem[] = [];
  const seen: string[] = [...introduced.keys()].sort(byRank);
  let carry: string[] = [];

  for (let w = fromWeek; w <= W; w++) {
    const lay = layout[w - 1]!;
    const doneHere = done.filter((d) => d.week === w);
    let used = doneHere.reduce((s, d) => s + ITEM_MINUTES[d.kind], 0);
    const budget = lay.topicBudget;
    const has = new Set(doneHere.map((d) => `${d.topicId}:${d.kind}`));
    const add = (kind: TopicItemKind, topicId: string): boolean => {
      const minutes = ITEM_MINUTES[kind];
      if (used + minutes > budget || has.has(`${topicId}:${kind}`)) return false;
      used += minutes;
      has.add(`${topicId}:${kind}`);
      out.push({ week: w, kind, topicId, minutes });
      return true;
    };

    // (a) revisões vencidas (as não encaixadas passam para a semana seguinte)
    const due = [...new Set([...carry, ...(dueReviews.get(w) ?? [])])].sort(byRank);
    carry = [];
    for (const t of due) {
      if (!add('review', t) && w < W) carry.push(t);
    }

    // (b) novos tópicos, alternando áreas
    const allowNew = !(W >= 4 && w === W);
    const perArea = new Map<EnemArea, number>(AREAS.map((a) => [a, 0]));
    const fresh = new Set<string>();
    while (allowNew) {
      const candidates = AREAS.filter((a) => (queues.get(a)?.length ?? 0) > 0);
      if (candidates.length === 0) break;
      candidates.sort(
        (a, b) =>
          (perArea.get(a) ?? 0) - (perArea.get(b) ?? 0) ||
          byRank(queues.get(a)![0]!, queues.get(b)![0]!),
      );
      const area = candidates[0]!;
      const topicId = queues.get(area)![0]!;
      const s = byId.get(topicId)!;
      const strong = s.mastery >= 0.8 && s.topic.answered >= 10;
      const needTheory = !strong;
      const cost = (needTheory ? ITEM_MINUTES.theory : 0) + ITEM_MINUTES.questions;
      let placed = false;
      if (used + cost <= budget) {
        if (needTheory) add('theory', topicId);
        placed = add('questions', topicId);
      } else if (cost > budget && used === 0 && add('questions', topicId)) {
        placed = true; // semana minúscula: só questões
      }
      if (!placed) break;
      queues.get(area)!.shift();
      perArea.set(area, (perArea.get(area) ?? 0) + 1);
      fresh.add(topicId);
      seen.push(topicId);
      seen.sort(byRank);
      for (const g of gaps) addReview(w + g, topicId);
    }

    // (c) sobra do orçamento: prática dos tópicos já vistos, mais prioritários primeiro
    for (const t of seen) {
      if (budget - used < ITEM_MINUTES.review) break;
      if (fresh.has(t)) continue;
      if (!add('questions', t)) add('review', t);
    }
  }
  return out;
}

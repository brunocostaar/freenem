/**
 * Teoria de Resposta ao Item (TRI), modelo logístico de 3 parâmetros (3PL), com estimativa EAP
 * (Expected A Posteriori) e prior normal padrão.
 *
 *   P(θ) = c + (1 − c) / (1 + exp(−D·a·(θ − b)))
 *
 * Os parâmetros a/b/c publicados nos microdados do INEP já estão na escala logística com D = 1,
 * por isso `D` é configurável e vale 1 por padrão.
 *
 * AVISO: a nota oficial do ENEM é calibrada pelo INEP com a escala de cada área ancorada na
 * população de referência de 2009 (média 500, desvio-padrão 100) e usa o conjunto completo de
 * itens (inclusive os não aproveitados). Aqui convertemos θ com `500 + 100·θ`, que é apenas uma
 * aproximação: a nota real varia por área e por edição. Sempre apresente o resultado como
 * "nota estimada".
 */

export interface ItemParams {
  a: number;
  b: number;
  c: number;
}

export interface ScoredItem {
  /** parâmetros da TRI; null/undefined = item sem parâmetros (fora da TRI) */
  params?: ItemParams | null;
  correct: boolean;
}

export interface ThetaEstimate {
  theta: number;
  /** erro-padrão = desvio-padrão da posteriori */
  se: number;
}

export interface TriResult extends ThetaEstimate {
  /** nota estimada na escala ENEM */
  score: number;
  /** quantidade de itens usados na estimativa */
  itemsUsed: number;
}

export interface TriOptions {
  /** constante de escala logística (padrão 1) */
  D?: number;
  /** limites e resolução da grade de quadratura */
  min?: number;
  max?: number;
  points?: number;
  /** mínimo de itens com parâmetros para devolver TRI (padrão 5) */
  minItems?: number;
}

export const ENEM_SCALE_MEAN = 500;
export const ENEM_SCALE_SD = 100;
export const MIN_TRI_ITEMS = 5;

/** Probabilidade de acerto do item para a proficiência θ. */
export function probability(theta: number, p: ItemParams, D = 1): number {
  return p.c + (1 - p.c) / (1 + Math.exp(-D * p.a * (theta - p.b)));
}

export function thetaToEnemScore(theta: number): number {
  return ENEM_SCALE_MEAN + ENEM_SCALE_SD * theta;
}

export function hasValidParams(p: Partial<ItemParams> | null | undefined): p is ItemParams {
  return (
    !!p &&
    Number.isFinite(p.a) &&
    Number.isFinite(p.b) &&
    Number.isFinite(p.c) &&
    (p.a as number) > 0 &&
    (p.c as number) >= 0 &&
    (p.c as number) < 1
  );
}

type UsableItem = { params: ItemParams; correct: boolean };

function usableItems(items: ScoredItem[]): UsableItem[] {
  const out: UsableItem[] = [];
  for (const i of items)
    if (hasValidParams(i.params)) out.push({ params: i.params, correct: i.correct });
  return out;
}

/** Estimativa EAP de θ com prior N(0,1) sobre uma grade uniforme. */
export function estimateTheta(items: UsableItem[], opts: TriOptions = {}): ThetaEstimate {
  const { D = 1, min = -4, max = 4, points = 81 } = opts;
  const step = (max - min) / (points - 1);
  const grid: number[] = [];
  const logPost: number[] = [];
  for (let k = 0; k < points; k++) {
    const t = min + k * step;
    let ll = -0.5 * t * t; // log do prior normal (constante omitida)
    for (const it of items) {
      const p = probability(t, it.params, D);
      ll += Math.log(it.correct ? p : 1 - p);
    }
    grid.push(t);
    logPost.push(ll);
  }
  const top = Math.max(...logPost);
  const w = logPost.map((l) => Math.exp(l - top));
  let sw = 0;
  let sm = 0;
  for (let k = 0; k < points; k++) {
    sw += w[k]!;
    sm += w[k]! * grid[k]!;
  }
  const theta = sm / sw;
  let sv = 0;
  for (let k = 0; k < points; k++) sv += w[k]! * (grid[k]! - theta) ** 2;
  return { theta, se: Math.sqrt(sv / sw) };
}

/**
 * Nota TRI estimada. Itens sem parâmetros válidos são ignorados; com menos de `minItems`
 * itens com parâmetros devolve null.
 */
export function estimateTri(items: ScoredItem[], opts: TriOptions = {}): TriResult | null {
  const { minItems = MIN_TRI_ITEMS } = opts;
  const usable = usableItems(items);
  if (usable.length < minItems) return null;
  const est = estimateTheta(usable, opts);
  return { ...est, score: thetaToEnemScore(est.theta), itemsUsed: usable.length };
}

/**
 * Coerência pedagógica (tipo Guttman): entre os itens com parâmetro b, conta os pares em que um
 * item mais fácil foi errado enquanto um mais difícil foi acertado (inversões). Normaliza pelo
 * máximo possível dado o número de acertos e erros: 1 = perfeitamente coerente (acertou os mais
 * fáceis), 0 = máximo de incoerência (acertou só os mais difíceis, típico de "chute").
 * Devolve null se houver menos de `minItems` itens com parâmetros; sem mistura de acertos e
 * erros devolve 1.
 */
export function coherence(items: ScoredItem[], minItems = MIN_TRI_ITEMS): number | null {
  const usable = usableItems(items);
  if (usable.length < minItems) return null;
  const right = usable.filter((i) => i.correct);
  const wrong = usable.filter((i) => !i.correct);
  const maxInv = right.length * wrong.length;
  if (maxInv === 0) return 1;
  let inversions = 0;
  for (const w of wrong) for (const r of right) if (w.params.b < r.params.b) inversions++;
  return 1 - inversions / maxInv;
}

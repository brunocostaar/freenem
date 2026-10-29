import type { AlternativeLetter, AreaResult, EnemArea, QuestionOutcome } from '@freenem/shared';
import { coherence, estimateTri, type ItemParams, type ScoredItem } from '../../lib/tri.js';

export interface ScoreQuestion {
  id: string;
  subjectId: string | null;
  subject: string | null;
  area: EnemArea | null;
  params: ItemParams | null;
  correctLetter: AlternativeLetter | null;
}

export function outcomeOf(q: ScoreQuestion, chosen: AlternativeLetter | null): QuestionOutcome {
  if (!chosen) return 'blank';
  return q.correctLetter === chosen ? 'correct' : 'wrong';
}

export interface ScoreSummary {
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  percentage: number;
  triScore: number | null;
  coherence: number | null;
  areas: AreaResult[];
  bySubject: {
    subjectId: string | null;
    subject: string;
    area: EnemArea | null;
    total: number;
    correct: number;
    blank: number;
  }[];
}

const AREA_ORDER: EnemArea[] = ['linguagens', 'humanas', 'natureza', 'matematica'];

/** Nota bruta, TRI estimada por área e quebra por matéria. */
export function summarize(
  questions: ScoreQuestion[],
  chosen: Map<string, AlternativeLetter | null>,
): ScoreSummary {
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  const subjects = new Map<string, ScoreSummary['bySubject'][number]>();
  const byArea = new Map<EnemArea, { q: ScoreQuestion; ok: boolean; blank: boolean }[]>();

  for (const q of questions) {
    const outcome = outcomeOf(q, chosen.get(q.id) ?? null);
    if (outcome === 'correct') correct++;
    else if (outcome === 'wrong') wrong++;
    else blank++;

    const key = q.subjectId ?? '_none';
    const s = subjects.get(key) ?? {
      subjectId: q.subjectId,
      subject: q.subject ?? 'Sem matéria',
      area: q.area,
      total: 0,
      correct: 0,
      blank: 0,
    };
    s.total++;
    if (outcome === 'correct') s.correct++;
    if (outcome === 'blank') s.blank++;
    subjects.set(key, s);

    if (q.area) {
      const list = byArea.get(q.area) ?? [];
      list.push({ q, ok: outcome === 'correct', blank: outcome === 'blank' });
      byArea.set(q.area, list);
    }
  }

  const areas: AreaResult[] = [];
  for (const area of AREA_ORDER) {
    const list = byArea.get(area);
    if (!list) continue;
    // em branco conta como erro na TRI
    const items: ScoredItem[] = list.map((x) => ({ params: x.q.params, correct: x.ok }));
    const tri = estimateTri(items);
    areas.push({
      area,
      total: list.length,
      correct: list.filter((x) => x.ok).length,
      blank: list.filter((x) => x.blank).length,
      itemsWithParams: list.filter((x) => x.q.params).length,
      tri: tri
        ? {
            score: round(tri.score, 1),
            theta: round(tri.theta, 3),
            standardError: round(tri.se * 100, 1),
            itemsUsed: tri.itemsUsed,
          }
        : null,
      coherence: round(coherence(items), 3),
    });
  }

  const withTri = areas.filter((a) => a.tri);
  const triScore = withTri.length
    ? round(withTri.reduce((s, a) => s + a.tri!.score, 0) / withTri.length, 1)
    : null;

  const withCoh = areas.filter((a) => a.coherence !== null);
  const weight = withCoh.reduce((s, a) => s + a.itemsWithParams, 0);
  const overallCoherence = weight
    ? round(withCoh.reduce((s, a) => s + a.coherence! * a.itemsWithParams, 0) / weight, 3)
    : null;

  const total = questions.length;
  return {
    total,
    correct,
    wrong,
    blank,
    percentage: total ? round((correct / total) * 100, 1) : 0,
    triScore,
    coherence: overallCoherence,
    areas,
    bySubject: [...subjects.values()].sort((a, b) => a.subject.localeCompare(b.subject, 'pt-BR')),
  };
}

function round(n: number, digits: number): number;
function round(n: number | null, digits: number): number | null;
function round(n: number | null, digits: number): number | null {
  if (n === null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

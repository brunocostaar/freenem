import { describe, expect, it } from 'vitest';
import { ITEM_MINUTES, type EnemArea } from '@freenem/shared';
import {
  generateTopicItems,
  layoutWeeks,
  reviewGaps,
  totalWeeks,
  type GenParams,
  type GenTopic,
} from './generator.js';

const AREAS: EnemArea[] = ['linguagens', 'humanas', 'natureza', 'matematica'];

function topics(n: number, over: (i: number) => Partial<GenTopic> = () => ({})): GenTopic[] {
  return Array.from({ length: n }, (_, i) => ({
    topicId: `t${String(i).padStart(3, '0')}`,
    area: AREAS[i % 4]!,
    incidence: 10,
    answered: 0,
    correct: 0,
    ...over(i),
  }));
}

function params(over: Partial<GenParams> = {}): GenParams {
  return {
    startDate: '2026-01-05',
    examDate: '2026-05-03', // 17 semanas
    hoursPerWeek: 10,
    availableDays: [1, 2, 3, 4, 5],
    topics: topics(40),
    ...over,
  };
}

describe('layoutWeeks', () => {
  it('calcula o número de semanas até a prova', () => {
    expect(totalWeeks({ startDate: '2026-01-05', examDate: '2026-05-03' })).toBe(17);
    expect(totalWeeks({ startDate: '2026-01-05', examDate: '2026-01-06' })).toBe(1);
  });

  it('reserva redação toda semana e simulados espaçados, nunca na última semana', () => {
    const l = layoutWeeks(params());
    expect(l.every((w) => w.essayMinutes > 0)).toBe(true);
    const sims = l.filter((w) => w.simuladoMinutes > 0).map((w) => w.week);
    expect(sims.length).toBeGreaterThan(1);
    expect(sims).not.toContain(l.length);
    expect(sims).toContain(l.length - 1);
    for (const w of l) {
      expect(w.topicBudget + w.essayMinutes + w.simuladoMinutes).toBe(w.budgetMinutes);
    }
  });

  it('pouco tempo por semana: sem redação nem simulado', () => {
    const l = layoutWeeks(params({ hoursPerWeek: 2 }));
    expect(l.every((w) => w.essayMinutes === 0 && w.simuladoMinutes === 0)).toBe(true);
  });
});

describe('generateTopicItems', () => {
  it('respeita as horas por semana', () => {
    for (const hours of [1, 3, 10, 25]) {
      const p = params({ hoursPerWeek: hours });
      const items = generateTopicItems(p);
      const layout = layoutWeeks(p);
      for (const w of layout) {
        const total = items.filter((i) => i.week === w.week).reduce((s, i) => s + i.minutes, 0);
        expect(total).toBeLessThanOrEqual(w.topicBudget);
      }
      for (const i of items) expect(i.minutes).toBe(ITEM_MINUTES[i.kind]);
    }
  });

  it('cobre primeiro os tópicos fracos e mais frequentes', () => {
    const ts = topics(12, (i) => ({
      area: 'matematica',
      answered: 20,
      correct: i < 3 ? 2 : 19, // t000..t002 fracos, demais fortes
    }));
    const items = generateTopicItems(params({ topics: ts, hoursPerWeek: 4 }));
    const firstWeek = (id: string) =>
      Math.min(...items.filter((i) => i.topicId === id).map((i) => i.week));
    for (const weak of ['t000', 't001', 't002']) {
      expect(firstWeek(weak)).toBeLessThanOrEqual(firstWeek('t005'));
    }
    expect(firstWeek('t000')).toBe(1);
  });

  it('suaviza amostras pequenas: 0/1 não é pior que 2/20', () => {
    const ts: GenTopic[] = [
      { topicId: 'a', area: 'matematica', incidence: 5, answered: 1, correct: 0 },
      { topicId: 'b', area: 'matematica', incidence: 5, answered: 20, correct: 2 },
    ];
    const items = generateTopicItems(params({ topics: ts, hoursPerWeek: 1 }));
    const first = items.find((i) => i.week === 1);
    expect(first?.topicId).toBe('b');
  });

  it('prioriza tópicos de maior incidência', () => {
    const ts = topics(8, (i) => ({ area: 'natureza', incidence: i === 5 ? 100 : 1 }));
    const items = generateTopicItems(params({ topics: ts, hoursPerWeek: 2 }));
    expect(items[0]?.topicId).toBe('t005');
  });

  it('agenda revisões espaçadas após a introdução do tópico', () => {
    const p = params();
    const items = generateTopicItems(p);
    const gaps = reviewGaps(17);
    expect(gaps[0]).toBe(1);
    const intro = Math.min(...items.filter((i) => i.topicId === 't000').map((i) => i.week));
    const reviews = items.filter((i) => i.topicId === 't000' && i.kind === 'review');
    expect(reviews.length).toBeGreaterThan(0);
    for (const g of gaps) {
      if (intro + g <= 17) {
        expect(reviews.some((r) => r.week >= intro + g)).toBe(true);
      }
    }
    expect(reviews.every((r) => r.week > intro)).toBe(true);
  });

  it('equilibra as quatro áreas na primeira semana', () => {
    const items = generateTopicItems(params({ hoursPerWeek: 12 }));
    const areas = new Set(
      items
        .filter((i) => i.week === 1 && i.kind === 'theory')
        .map((i) => AREAS[Number(i.topicId.slice(1)) % 4]),
    );
    expect(areas.size).toBe(4);
  });

  it('bônus para áreas de foco', () => {
    const items = generateTopicItems(params({ focusAreas: ['humanas'], hoursPerWeek: 2 }));
    expect(AREAS[Number(items[0]!.topicId.slice(1)) % 4]).toBe('humanas');
  });

  it('é determinístico', () => {
    const p = params();
    expect(generateTopicItems(p)).toEqual(generateTopicItems(p));
  });

  it('não repete o mesmo tipo de item de um tópico na mesma semana', () => {
    const items = generateTopicItems(params({ topics: topics(3), hoursPerWeek: 20 }));
    const keys = items.map((i) => `${i.week}:${i.topicId}:${i.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sem tópicos, não gera itens', () => {
    expect(generateTopicItems(params({ topics: [] }))).toEqual([]);
  });

  it('semana final não introduz tópicos novos', () => {
    const items = generateTopicItems(params());
    const seenBefore = new Set(items.filter((i) => i.week < 17).map((i) => i.topicId));
    expect(items.filter((i) => i.week === 17).every((i) => seenBefore.has(i.topicId))).toBe(true);
  });

  it('rebalanceamento preserva o passado e usa itens concluídos', () => {
    const base = params();
    const first = generateTopicItems(base);
    const done = first
      .filter((i) => i.week <= 2)
      .map(({ topicId, kind, week }) => ({
        topicId,
        kind,
        week,
      }));
    const again = generateTopicItems({ ...base, fromWeek: 3, done });
    expect(again.every((i) => i.week >= 3)).toBe(true);
    // tópicos já introduzidos não voltam como "teoria"
    const introduced = new Set(done.map((d) => d.topicId));
    expect(again.some((i) => i.kind === 'theory' && introduced.has(i.topicId))).toBe(false);
  });
});

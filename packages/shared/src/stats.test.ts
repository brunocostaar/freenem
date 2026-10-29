import { describe, expect, it } from 'vitest';
import { computeStreak, wilsonLowerBound } from './stats.js';

describe('wilsonLowerBound', () => {
  it('penaliza amostras pequenas', () => {
    expect(wilsonLowerBound(2, 2)).toBeLessThan(wilsonLowerBound(90, 100));
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(10, 10)).toBeGreaterThan(0.7);
  });
});

describe('computeStreak', () => {
  it('conta dias consecutivos terminando hoje', () => {
    expect(computeStreak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10')).toBe(3);
  });
  it('mantém a sequência viva se hoje ainda não teve atividade', () => {
    expect(computeStreak(['2026-03-08', '2026-03-09'], '2026-03-10')).toBe(2);
  });
  it('zera após um dia sem atividade', () => {
    expect(computeStreak(['2026-03-07'], '2026-03-10')).toBe(0);
    expect(
      computeStreak(['2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10'], '2026-03-10'),
    ).toBe(2);
  });
});

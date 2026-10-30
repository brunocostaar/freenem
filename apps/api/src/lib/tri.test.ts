import { describe, expect, it } from 'vitest';
import {
  coherence,
  estimateTheta,
  estimateTri,
  probability,
  thetaToEnemScore,
  type ItemParams,
  type ScoredItem,
} from './tri.js';

/** n itens com b espaçado de -2 a 2 (do mais fácil ao mais difícil) */
function makeParams(n: number, a = 1.5, c = 0.2): ItemParams[] {
  return Array.from({ length: n }, (_, i) => ({ a, b: -2 + (4 * i) / (n - 1), c }));
}
const scored = (ps: ItemParams[], pattern: boolean[]): ScoredItem[] =>
  ps.map((params, i) => ({ params, correct: pattern[i]! }));
const usable = (ps: ItemParams[], pattern: boolean[]) =>
  ps.map((params, i) => ({ params, correct: pattern[i]! }));

describe('probability (3PL)', () => {
  const p = { a: 1.2, b: 0.5, c: 0.2 };
  it('em θ = b vale c + (1 - c)/2', () => {
    expect(probability(0.5, p)).toBeCloseTo(0.2 + 0.8 / 2, 10);
  });
  it('tende a c em -∞ e a 1 em +∞', () => {
    expect(probability(-30, p)).toBeCloseTo(0.2, 6);
    expect(probability(30, p)).toBeCloseTo(1, 6);
  });
  it('é monótona em θ', () => {
    let prev = 0;
    for (let t = -4; t <= 4; t += 0.5) {
      const v = probability(t, p);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });
  it('D maior inclina a curva', () => {
    expect(probability(1.5, p, 1.7)).toBeGreaterThan(probability(1.5, p, 1));
  });
});

describe('estimateTheta (EAP)', () => {
  const ps = makeParams(45);
  it('sem itens devolve o prior (θ=0, se≈1)', () => {
    const e = estimateTheta([]);
    expect(e.theta).toBeCloseTo(0, 6);
    expect(e.se).toBeGreaterThan(0.95);
    expect(e.se).toBeLessThan(1.01);
  });
  it('tudo certo > tudo errado, com limites razoáveis', () => {
    const hi = estimateTheta(
      usable(
        ps,
        ps.map(() => true),
      ),
    );
    const lo = estimateTheta(
      usable(
        ps,
        ps.map(() => false),
      ),
    );
    expect(hi.theta).toBeGreaterThan(1.5);
    expect(hi.theta).toBeLessThan(4);
    expect(lo.theta).toBeLessThan(-1.5);
    expect(lo.theta).toBeGreaterThan(-4);
  });
  it('mais itens, menor erro-padrão', () => {
    const pat = (n: number) => Array.from({ length: n }, (_, i) => i < n / 2);
    const e1 = estimateTheta(usable(makeParams(10), pat(10)));
    const e2 = estimateTheta(usable(makeParams(45), pat(45)));
    expect(e2.se).toBeLessThan(e1.se);
  });
  it('recupera θ aproximado a partir da resposta esperada', () => {
    const truth = 0.8;
    const items = ps.map((params) => ({ params, correct: probability(truth, params) >= 0.5 }));
    expect(Math.abs(estimateTheta(items).theta - truth)).toBeLessThan(0.6);
  });
});

describe('estimateTri', () => {
  const ps = makeParams(45);
  it('monotonicidade: mais acertos (padrão coerente) => nota maior', () => {
    let prev = -Infinity;
    for (let k = 0; k <= 45; k += 5) {
      const r = estimateTri(
        scored(
          ps,
          ps.map((_, i) => i < k),
        ),
      )!;
      expect(r.score).toBeGreaterThan(prev);
      prev = r.score;
    }
  });
  it('trocar um erro por acerto nunca reduz a nota', () => {
    const base = ps.map((_, i) => i % 3 === 0);
    const a = estimateTri(scored(ps, base))!;
    const flipped = [...base];
    flipped[flipped.findIndex((v) => !v)] = true;
    expect(estimateTri(scored(ps, flipped))!.score).toBeGreaterThan(a.score);
  });
  it('limites: tudo errado bem abaixo de 500, tudo certo bem acima, dentro de 100..900', () => {
    const lo = estimateTri(
      scored(
        ps,
        ps.map(() => false),
      ),
    )!;
    const hi = estimateTri(
      scored(
        ps,
        ps.map(() => true),
      ),
    )!;
    expect(lo.score).toBeLessThan(400);
    expect(hi.score).toBeGreaterThan(700);
    expect(lo.score).toBeGreaterThan(100);
    expect(hi.score).toBeLessThan(900);
  });
  it('robustez ao chute: mesmo nº de acertos, acertar só os difíceis vale menos', () => {
    const easy = estimateTri(
      scored(
        ps,
        ps.map((_, i) => i < 20),
      ),
    )!;
    const hard = estimateTri(
      scored(
        ps,
        ps.map((_, i) => i >= 25),
      ),
    )!;
    expect(hard.score).toBeLessThan(easy.score);
    expect(easy.score - hard.score).toBeGreaterThan(50);
  });
  it('padrão coerente pontua mais que o de acertos concentrados nos difíceis', () => {
    const coherent = estimateTri(
      scored(
        ps,
        ps.map((_, i) => i < 22),
      ),
    )!;
    const worst = estimateTri(
      scored(
        ps,
        ps.map((_, i) => i >= 23),
      ),
    )!;
    expect(worst.score).toBeLessThan(coherent.score);
  });
  it('acertar metade (os mais fáceis) com itens centrados dá nota perto de 500', () => {
    const items = makeParams(45, 1.2, 0.15);
    const half = estimateTri(items.map((params) => ({ params, correct: params.b < 0 })))!;
    expect(half.score).toBeGreaterThan(430);
    expect(half.score).toBeLessThan(570);
  });
  it('ignora itens sem parâmetros e devolve null com menos de 5 itens', () => {
    const four = scored(makeParams(4), [true, true, true, true]);
    expect(estimateTri(four)).toBeNull();
    expect(estimateTri([...four, { params: null, correct: true }, { correct: false }])).toBeNull();
    const five = [...scored(makeParams(5), [true, true, false, false, false]), { correct: true }];
    expect(estimateTri(five)!.itemsUsed).toBe(5);
  });
  it('ignora parâmetros inválidos (a<=0, c>=1, NaN)', () => {
    const bad: ScoredItem[] = [
      { params: { a: 0, b: 0, c: 0.2 }, correct: true },
      { params: { a: 1, b: 0, c: 1 }, correct: true },
      { params: { a: NaN, b: 0, c: 0.2 }, correct: true },
    ];
    const ok = scored(makeParams(5), [true, true, true, false, false]);
    expect(estimateTri([...bad, ...ok])!.itemsUsed).toBe(5);
  });
  it('conversão para a escala ENEM', () => {
    expect(thetaToEnemScore(0)).toBe(500);
    expect(thetaToEnemScore(1)).toBe(600);
    expect(thetaToEnemScore(-2.5)).toBe(250);
  });
  it('valor conhecido: 5 itens a=1,b=0,c=0 com 3 acertos => θ levemente positivo', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      params: { a: 1, b: 0, c: 0 },
      correct: i < 3,
    }));
    const r = estimateTri(items)!;
    // posteriori ∝ φ(θ)·σ(θ)^3·(1−σ(θ))^2
    expect(r.theta).toBeGreaterThan(0.05);
    expect(r.theta).toBeLessThan(0.4);
    expect(r.se).toBeGreaterThan(0.5);
    expect(r.se).toBeLessThan(0.9);
  });
  it('simetria: padrões espelhados dão θ opostos (itens simétricos, c=0)', () => {
    const items = [-1, -0.5, 0, 0.5, 1].map((b) => ({ a: 1, b, c: 0 }));
    const pat = [true, true, false, false, false];
    const a = estimateTri(scored(items, pat))!;
    const mirrored = [...pat].reverse().map((v) => !v);
    const b = estimateTri(scored([...items].reverse(), mirrored))!;
    expect(a.theta + b.theta).toBeCloseTo(0, 6);
  });
});

describe('coherence', () => {
  const ps = makeParams(10);
  it('Guttman perfeito = 1', () => {
    expect(
      coherence(
        scored(
          ps,
          ps.map((_, i) => i < 6),
        ),
      ),
    ).toBe(1);
  });
  it('acertar só os mais difíceis = 0', () => {
    expect(
      coherence(
        scored(
          ps,
          ps.map((_, i) => i >= 6),
        ),
      ),
    ).toBe(0);
  });
  it('intermediário entre 0 e 1', () => {
    const c = coherence(
      scored(
        ps,
        ps.map((_, i) => i % 2 === 0),
      ),
    )!;
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(1);
  });
  it('tudo certo ou tudo errado = null (índice indefinido, não 100%)', () => {
    expect(
      coherence(
        scored(
          ps,
          ps.map(() => true),
        ),
      ),
    ).toBeNull();
    expect(
      coherence(
        scored(
          ps,
          ps.map(() => false),
        ),
      ),
    ).toBeNull();
  });
  it('poucos itens = null', () => {
    expect(coherence(scored(makeParams(4), [true, false, true, false]))).toBeNull();
  });
  it('ignora itens sem parâmetros', () => {
    const items: ScoredItem[] = [
      ...scored(
        ps,
        ps.map((_, i) => i < 6),
      ),
      { correct: false },
    ];
    expect(coherence(items)).toBe(1);
  });
});

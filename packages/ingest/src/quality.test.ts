import { describe, expect, it } from 'vitest';
import { checkQuality, escapeDollars, hasUnbalancedLatex, type QualityInput } from './quality.js';

const STATEMENT =
  'Um posto de combustível vende 10.000 litros de álcool por dia, e o proprietário percebeu uma relação entre preço e vendas.';

const ok = (over: Partial<QualityInput> = {}): QualityInput => ({
  statement: STATEMENT,
  imageUrls: [],
  alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter, i) => ({
    letter,
    text: `Resposta ${letter}`,
    imageUrl: null,
    isCorrect: i === 2,
  })),
  ...over,
});
const codes = (q: QualityInput) => checkQuality(q).map((i) => i.code);

describe('checkQuality', () => {
  it('questão boa não tem problemas', () => {
    expect(codes(ok())).toEqual([]);
  });
  it('enunciado curto sem imagem é suspeito; com imagem não', () => {
    expect(codes(ok({ statement: 'O fenômeno decorre da' }))).toContain('statement_short');
    expect(codes(ok({ statement: '![Imagem](storage://a/b.png)\n\nO texto revela' }))).toEqual([]);
    expect(codes(ok({ statement: 'Curto', imageUrls: ['storage://x.png'] }))).toEqual([]);
  });
  it('enunciado vazio', () => {
    expect(codes(ok({ statement: '  ' }))).toContain('statement_empty');
  });
  it('alternativas vazias, duplicadas e em número errado', () => {
    const q = ok();
    q.alternatives[0]!.text = '';
    expect(codes(q)).toContain('alternative_empty');
    const d = ok();
    d.alternatives[1]!.text = ' resposta   A ';
    expect(codes(d)).toContain('alternatives_duplicated');
    expect(codes(ok({ alternatives: ok().alternatives.slice(0, 4) }))).toContain(
      'alternatives_count',
    );
  });
  it('gabarito ausente ou múltiplo', () => {
    const none = ok();
    none.alternatives.forEach((a) => (a.isCorrect = false));
    expect(codes(none)).toContain('no_correct');
    const two = ok();
    two.alternatives[0]!.isCorrect = true;
    expect(codes(two)).toContain('multiple_correct');
  });
  it('imagem quebrada ou ausente no storage', () => {
    expect(codes(ok({ imageUrls: ['https://enem.dev/broken-image.svg'] }))).toContain(
      'broken_image',
    );
    const q = ok({ statement: `${STATEMENT}\n\n![x](storage://enem/a.png)` });
    expect(checkQuality(q, { imageMissing: () => true }).map((i) => i.code)).toContain(
      'broken_image',
    );
    expect(checkQuality(q, { imageMissing: () => false })).toEqual([]);
  });
  it('LaTeX desbalanceado e artefatos de Markdown', () => {
    expect(codes(ok({ statement: `${STATEMENT} $x + 1` }))).toContain('unbalanced_latex');
    expect(codes(ok({ statement: `${STATEMENT} **negrito aberto` }))).toContain(
      'markdown_artifact',
    );
    expect(codes(ok({ statement: `${STATEMENT} &nbsp; undefined` }))).toContain(
      'markdown_artifact',
    );
    expect(codes(ok({ statement: `${STATEMENT} ![x](enem.dev/a.png)` }))).toContain(
      'markdown_artifact',
    );
  });
});

describe('LaTeX / moeda', () => {
  it('hasUnbalancedLatex', () => {
    expect(hasUnbalancedLatex('$x$ e $y$')).toBe(false);
    expect(hasUnbalancedLatex('$$x$$')).toBe(false);
    expect(hasUnbalancedLatex('$x$ e $y')).toBe(true);
    expect(hasUnbalancedLatex('custa R\\$ 5 e R\\$ 7')).toBe(false);
  });
  it('escapeDollars protege moeda e é idempotente', () => {
    const once = escapeDollars('de R$ 1,50 por US$ 2');
    expect(once).toBe('de R\\$ 1,50 por US\\$ 2');
    expect(escapeDollars(once)).toBe(once);
    expect(checkQuality(ok({ statement: `${STATEMENT} ${once}` }))).toEqual([]);
  });
});

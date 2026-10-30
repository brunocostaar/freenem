import { describe, expect, it } from 'vitest';
import { decideReview, type ReviewInput } from './auto-review.js';

const STATEMENT =
  'Um posto de combustível vende 10.000 litros de álcool por dia, e o proprietário percebeu uma relação entre preço e vendas.';

const letters = (n: number) => ['A', 'B', 'C', 'D', 'E'].slice(0, n);
const ok = (over: Partial<ReviewInput> = {}, n = 5): ReviewInput => ({
  statement: STATEMENT,
  imageUrls: [],
  subjectId: 'subj-1',
  institution: 'enem',
  alternatives: letters(n).map((letter, i) => ({
    letter,
    text: `Resposta ${letter}`,
    imageUrl: null,
    isCorrect: i === 1,
  })),
  ...over,
});

describe('decideReview', () => {
  it('publica questão íntegra (ENEM 5 alternativas)', () => {
    expect(decideReview(ok())).toEqual({ publish: true, reasons: [] });
  });
  it('UNICAMP com 4 alternativas é íntegra; ENEM com 4 não', () => {
    expect(decideReview(ok({ institution: 'unicamp' }, 4)).publish).toBe(true);
    expect(decideReview(ok({}, 4)).reasons).toContain('alternatives_count');
  });
  it('sem matéria fica em draft', () => {
    expect(decideReview(ok({ subjectId: null }))).toEqual({
      publish: false,
      reasons: ['no_subject'],
    });
  });
  it('enunciado vazio, sem gabarito ou com gabarito múltiplo ficam em draft', () => {
    expect(decideReview(ok({ statement: ' ' })).reasons).toContain('statement_empty');
    const none = ok();
    none.alternatives.forEach((a) => (a.isCorrect = false));
    expect(decideReview(none).reasons).toContain('no_correct');
    const many = ok();
    many.alternatives.forEach((a) => (a.isCorrect = true));
    expect(decideReview(many).reasons).toContain('multiple_correct');
  });
  it('alternativa vazia e imagem quebrada/ausente ficam em draft', () => {
    const empty = ok();
    empty.alternatives[0] = { letter: 'A', text: '', imageUrl: null, isCorrect: false };
    expect(decideReview(empty).reasons).toContain('alternative_empty');
    expect(decideReview(ok({ imageUrls: ['storage://x/broken-image.png'] })).reasons).toContain(
      'broken_image',
    );
    expect(
      decideReview(ok({ imageUrls: ['storage://x/a.png'] }), { imageMissing: () => true }).reasons,
    ).toContain('broken_image');
  });
  it('problemas de qualidade (enunciado truncado) impedem a publicação', () => {
    expect(decideReview(ok({ statement: 'O fenômeno decorre da' })).reasons).toContain(
      'statement_short',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { competencyScoreSchema, answerSubmitSchema, questionFilterSchema } from './index.js';

describe('shared schemas', () => {
  it('accepts ENEM competency scores in steps of 40', () => {
    expect(competencyScoreSchema.safeParse(120).success).toBe(true);
    expect(competencyScoreSchema.safeParse(130).success).toBe(false);
    expect(competencyScoreSchema.safeParse(240).success).toBe(false);
  });
  it('rejects invalid alternative letters', () => {
    const r = answerSubmitSchema.safeParse({
      questionId: '6f1c3c0e-8d55-4a53-9e0b-3d7a1f3f0a11',
      letter: 'F',
    });
    expect(r.success).toBe(false);
  });
  it('applies default limit to question filter', () => {
    expect(questionFilterSchema.parse({}).limit).toBe(20);
  });
});

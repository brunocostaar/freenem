import { describe, expect, it } from 'vitest';
import { evaluate, parseModelOutput } from './parse.js';

const base = { answer: 'B' as const, confidence: 'high' as const, issues: [], summary: 's' };

describe('parseModelOutput', () => {
  it('lê JSON puro', () => {
    expect(
      parseModelOutput('{"answer":"c","confidence":"high","issues":[],"summary":"ok"}'),
    ).toEqual({
      answer: 'C',
      confidence: 'high',
      issues: [],
      summary: 'ok',
    });
  });
  it('remove <think> e cercas ```', () => {
    const raw = '<think>{"x":1} pensando</think>\n```json\n{"answer":null,"confidence":"low"}\n```';
    const out = parseModelOutput(raw);
    expect(out?.answer).toBeNull();
    expect(out?.issues).toEqual([]);
  });
  it('rejeita lixo e letras inválidas', () => {
    expect(parseModelOutput('sem json')).toBeNull();
    expect(parseModelOutput('{"answer":"Z","confidence":"high"}')).toBeNull();
  });
});

describe('evaluate', () => {
  it('ok quando bate e sem problemas', () => {
    expect(evaluate(base, 'B')).toEqual({ verdict: 'ok', answerMatches: true });
  });
  it('problem quando há issues', () => {
    expect(evaluate({ ...base, issues: ['imagem ausente'] }, 'B').verdict).toBe('problem');
  });
  it('divergência com alta confiança é problem; com média é unsure', () => {
    expect(evaluate(base, 'A')).toEqual({ verdict: 'problem', answerMatches: false });
    expect(evaluate({ ...base, confidence: 'medium' }, 'A').verdict).toBe('unsure');
  });
  it('unsure quando o modelo não sabe', () => {
    expect(evaluate({ ...base, answer: null, confidence: 'low' }, 'A')).toEqual({
      verdict: 'unsure',
      answerMatches: null,
    });
  });
});

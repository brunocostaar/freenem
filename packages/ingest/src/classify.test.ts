import { describe, expect, it } from 'vitest';
import { classify, normalize, shouldPublish } from './classify.js';
import { parseQuestions } from './sources/pdf.js';
import { areaOf, dayOf } from './sources/enem-api.js';
import { parseItens } from './tri.js';

describe('classify', () => {
  it('normaliza acentos e ignora URLs de imagens', () => {
    expect(normalize('Ação ![x](https://a/b.png) Química')).toBe('acao   quimica');
  });

  it('classifica física pela evidência lexical', () => {
    const c = classify({
      text: 'Um carro tem velocidade constante e aceleração nula. Qual a força resultante, segundo as leis de Newton?',
      area: 'natureza',
    });
    expect(c.subject).toBe('Física');
    expect(c.topics.length).toBeGreaterThan(0);
    expect(shouldPublish(c)).toBe(true);
  });

  it('classifica química e biologia', () => {
    expect(
      classify({
        text: 'A reação química entre o ácido e a base produz sal; calcule a concentração da solução em mol/L.',
        area: 'natureza',
      }).subject,
    ).toBe('Química');
    expect(
      classify({
        text: 'A mitose e a meiose são processos da célula; o DNA é duplicado e os cromossomos separados.',
        area: 'natureza',
      }).subject,
    ).toBe('Biologia');
  });

  it('matemática: sempre Matemática, com assunto pelo vocabulário', () => {
    const c = classify({
      text: 'Qual a probabilidade de sortear uma bola vermelha? Calcule a média e o desvio padrão da amostra.',
      area: 'matematica',
    });
    expect(c.subject).toBe('Matemática');
    expect(c.topics[0]?.slug.startsWith('estatistica-e-probabilidade')).toBe(true);
  });

  it('línguas estrangeiras vão para Inglês/Espanhol e publicam', () => {
    const c = classify({
      text: 'Things we carry on the sea',
      area: 'linguagens',
      language: 'ingles',
    });
    expect(c.subject).toBe('Inglês');
    expect(shouldPublish(c, 'ingles')).toBe(true);
  });

  it('sem evidência vira rascunho', () => {
    const c = classify({ text: 'Texto curto sem palavras reconhecíveis.', area: 'humanas' });
    expect(shouldPublish(c)).toBe(false);
  });
});

describe('ENEM: layout das provas', () => {
  it('áreas por posição', () => {
    expect(areaOf(2023, 1)).toBe('linguagens');
    expect(areaOf(2023, 91)).toBe('natureza');
    expect(areaOf(2012, 1)).toBe('humanas');
    expect(areaOf(2012, 100)).toBe('linguagens');
    expect(areaOf(2009, 1)).toBe('natureza');
  });
  it('dia pela área', () => {
    expect(dayOf(2023, 'humanas')).toBe(1);
    expect(dayOf(2023, 'matematica')).toBe(2);
    expect(dayOf(2012, 'natureza')).toBe(1);
    expect(dayOf(2012, 'linguagens')).toBe(2);
  });
});

describe('parseItens', () => {
  it('lê o CSV de itens do INEP', () => {
    const csv =
      'CO_POSICAO;SG_AREA;CO_ITEM;TX_GABARITO;CO_HABILIDADE;IN_ITEM_ABAN;TX_MOTIVO_ABAN;NU_PARAM_A;NU_PARAM_B;NU_PARAM_C;TX_COR;CO_PROVA;TP_LINGUA;IN_ITEM_ADAPTADO\n' +
      '46;CH;140506;D;26;0;;0.98121;1.34897;0.06218;AZUL;1055;;0\n' +
      '1;LC;1;A;1;1;ABAN;;;;AZUL;1055;0;0\n';
    const rows = parseItens(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      position: 46,
      area: 'humanas',
      answer: 'D',
      b: 1.34897,
      lang: null,
    });
    expect(rows[1]).toMatchObject({ area: 'linguagens', b: null, lang: 0 });
  });
});

describe('parseQuestions (PDF)', () => {
  it('extrai enunciado e alternativas', () => {
    const text = [
      'QUESTÃO 01',
      'Qual é a capital do Brasil?',
      '(A) São Paulo',
      '(B) Brasília',
      '(C) Rio de Janeiro',
      '(D) Salvador',
      '(E) Recife',
      'QUESTÃO 02',
      'Quanto é 2 + 2?',
      '(A) 3',
      '(B) 4',
      '(C) 5',
      '(D) 6',
      '(E) 7',
    ].join('\n');
    const qs = parseQuestions(text);
    expect(qs).toHaveLength(2);
    expect(qs[0]?.statement).toBe('Qual é a capital do Brasil?');
    expect(qs[0]?.alternatives.map((a) => a.text)).toEqual([
      'São Paulo',
      'Brasília',
      'Rio de Janeiro',
      'Salvador',
      'Recife',
    ]);
    expect(qs[1]?.number).toBe(2);
  });
});

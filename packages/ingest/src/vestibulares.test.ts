import { describe, expect, it } from 'vitest';
import { classifyVestibular, detectLanguage } from './classify-vestibular.js';
import { assembleQuestions, flowLines } from './pdf/flow.js';
import { col, pageXml, pdfXml, type T } from './pdf/fixtures.js';
import { joinParagraphs, mdEscape, mergeRows, parsePdfXml } from './pdf/layout.js';
import { splitAlternatives } from './pdf/question.js';
import { checkQuality, expectedAlternativesOf } from './quality.js';
import {
  extractFuvest,
  fuvestSpec,
  parseFuvestGabarito,
  type Gabarito,
} from './sources/fuvest.js';
import { extractUfrgs, parseUfrgsGabarito } from './sources/ufrgs.js';
import { extractUnicamp, parseUnicampGabarito } from './sources/unicamp.js';

const L = (letter: string, text: string) => `(${letter}) ${text}`;
const ucol = (left: number, top: number, texts: string[]) => col(left, top, texts, 12, 200);
const alts5 = (p: string) => ['A', 'B', 'C', 'D', 'E'].map((l) => L(l, `${p} alternativa ${l}`));

describe('parsePdfXml', () => {
  it('lê linhas, negrito, entidades e fontes globais (definidas na 1ª página)', () => {
    const xml = pdfXml([
      pageXml(1, [{ top: 50, left: 34, text: 'Ana & Bia', bold: true, font: 1 }]),
      pageXml(2, [
        { top: 20, left: 34, text: 'branco', font: 2 },
        { top: 60, left: 34, text: 'normal' },
      ]),
    ]);
    const pages = parsePdfXml(xml);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.lines[0]).toMatchObject({ text: 'Ana & Bia', bold: true, size: 13 });
    expect(pages[1]?.lines[0]).toMatchObject({ color: '#ffffff', size: 8 });
    expect(pages[1]?.lines[1]).toMatchObject({ bold: false, size: 10, color: '#000000' });
  });
});

describe('mergeRows / joinParagraphs / mdEscape', () => {
  const mk = (top: number, left: number, text: string, width = 40) =>
    ({ page: 1, top, left, width, height: 10, text, bold: false, size: 10, color: '#000' }) as const;
  it('cola elementos da mesma linha, mesmo com `top` 1px diferente', () => {
    const rows = mergeRows([mk(100, 34, 'Instrução:'), mk(101, 80, 'As questões'), mk(120, 34, 'x')]);
    expect(rows.map((r) => r.text)).toEqual(['Instrução: As questões', 'x']);
  });
  it('splitBefore separa células de uma grade de alternativas', () => {
    const rows = mergeRows([mk(100, 34, 'a) 1300 km.', 60), mk(100, 200, 'c) 1500 km.', 60)], 3, /^[a-d]\)/);
    expect(rows.map((r) => r.text)).toEqual(['a) 1300 km.', 'c) 1500 km.']);
  });
  it('junta linhas em parágrafos e desfaz a hifenização do Unicamp', () => {
    const a = mk(100, 34, 'a fronteira é essencial-');
    const b = mk(111, 34, 'mente política e tem-');
    const c = mk(122, 34, '-se que');
    const d = mk(160, 34, 'Outro parágrafo.');
    expect(joinParagraphs([a, b, c, d], { softHyphen: true })).toBe(
      'a fronteira é essencialmente política e tem-se que\n\nOutro parágrafo.',
    );
  });
  it('escapa Markdown/KaTeX do texto da prova', () => {
    expect(mdEscape('R$ 5 * 2 _x_')).toBe('R\\$ 5 \\* 2 \\_x\\_');
    expect(mdEscape('1. item')).toBe('1\\. item');
  });
});

describe('splitAlternatives', () => {
  const ln = (text: string, top: number) =>
    ({ page: 1, top, left: 34, width: 200, height: 10, text, bold: false, size: 10, color: '#000' }) as const;
  it('usa a última cadeia A..E (ignora "(A)" citado no enunciado)', () => {
    const lines = [
      ln('Considere as opções (A) e (B) do texto', 10),
      ln('(A) citada no enunciado', 22),
      ...['A', 'B', 'C', 'D', 'E'].map((x, i) => ln(`(${x}) resp ${x}`, 40 + i * 12)),
    ];
    const r = splitAlternatives(lines, /^\(([A-E])\)\s*/);
    expect(r.stem).toHaveLength(2);
    expect(r.alts.map((a) => a.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('FUVEST', () => {
  const gabText = `
      PROVA DE CONHECIMENTOS GERAIS
      GABARITO
       PROVA V1                   PROVA V2
1      E       46    D        1   A     46   C
2      B       47    ANULADA  2   D     47   E
GABARITO DE CORRESPONDÊNCIA
 RESPOSTA PROVA V1
   E         1        82
`;
  it('parseia o gabarito por versão e ignora a tabela de correspondência', () => {
    const g = parseFuvestGabarito(gabText, 'V1');
    expect([...g.entries()]).toEqual([
      [1, 'E'],
      [46, 'D'],
      [2, 'B'],
      [47, 'ANULADA'],
    ]);
    expect(parseFuvestGabarito(gabText, 'V2').get(46)).toBe('C');
    expect(() => parseFuvestGabarito(gabText, 'V9')).toThrow(/Vers/);
  });

  const page1: T[] = [
    { top: 40, left: 34, text: '01', bold: true, font: 1, width: 15 },
    ...col(34, 70, ['Texto-base da primeira questão com bastante conteúdo para o enunciado.', 'Qual é a resposta correta?']),
    ...col(34, 110, alts5('Q1')),
    { top: 40, left: 312, text: '02', bold: true, font: 1, width: 15 },
    ...col(312, 70, ['Enunciado da segunda questão sobre um tema qualquer da prova.', 'Assinale a correta:']),
    ...col(312, 110, alts5('Q2')),
  ];
  const page2: T[] = [
    { top: 20, left: 400, text: 'Concurso Vestibular FUVEST 2025 – Prova V1' },
    { top: 46, left: 88, text: 'TEXTO PARA AS QUESTÕES 03 E 04', width: 140 },
    ...col(34, 65, ['Um texto compartilhado pelas duas questões seguintes.']),
    { top: 100, left: 34, text: '03', bold: true, font: 1, width: 15 },
    ...col(34, 130, ['Primeira pergunta sobre o texto.']),
    ...col(34, 150, alts5('Q3')),
    { top: 100, left: 312, text: '04', bold: true, font: 1, width: 15 },
    ...col(312, 130, ['Segunda pergunta sobre o texto.']),
    ...col(312, 150, alts5('Q4')),
    // marcadores invisíveis (texto branco)
    { top: 100, left: 20, text: '{', font: 2, width: 3 },
    { top: 300, left: 34, text: '#####', font: 2, width: 20 },
  ];
  const pages = parsePdfXml(pdfXml([pageXml(1, page1), pageXml(2, page2)]));
  const gab: Gabarito = new Map([
    [1, 'E'],
    [2, 'B'],
    [3, 'A'],
    [4, 'ANULADA'],
  ]);

  it('lê as colunas na ordem certa, as alternativas e o gabarito', () => {
    const qs = extractFuvest('x.pdf', gab, pages);
    expect(qs.map((q) => q.number)).toEqual([1, 2, 3, 4]);
    expect(qs[0]?.statement).toContain('Texto-base da primeira questão');
    expect(qs[0]?.alternatives.map((a) => a.text)).toEqual(
      ['A', 'B', 'C', 'D', 'E'].map((l) => `Q1 alternativa ${l}`),
    );
    expect(qs[1]?.statement).toContain('segunda questão');
    expect(qs[0]?.correctLetter).toBe('E');
    expect(qs[3]?.annulled).toBe(true);
    expect(qs[3]?.correctLetter).toBeUndefined();
  });
  it('o texto-base "TEXTO PARA AS QUESTÕES 03 E 04" vai para as duas questões; cabeçalho e marcadores brancos somem', () => {
    const qs = extractFuvest('x.pdf', gab, pages);
    for (const n of [2, 3]) {
      expect(qs[n]?.statement).toContain('Um texto compartilhado');
      expect(qs[n]?.statement).not.toContain('#####');
      expect(qs[n]?.statement).not.toContain('Concurso Vestibular');
    }
    expect(qs[2]?.statement).toContain('Primeira pergunta');
    expect(qs[3]?.statement).toContain('Segunda pergunta');
  });
  it('só aceita numeração sequencial (ignora números em negrito fora de ordem)', () => {
    const flows = flowLines(pages, { topMargin: 30, bottomMargin: 20 });
    const raws = assembleQuestions(pages, flows, fuvestSpec);
    expect(raws.map((r) => r.number)).toEqual([1, 2, 3, 4]);
  });
});

describe('UNICAMP', () => {
  it('parseia o gabarito (tabela em 4 colunas, "*" = anulada)', () => {
    const g = parseUnicampGabarito(`GABARITO - 1ª FASE
             01   B      19    C        37   A   55   D
             02   A      20    *        38   B   56   B
   * Questão anulada. De acordo com o Art.27 da Resolução 2025, a pontuação
`);
    expect(g.get(1)).toBe('B');
    expect(g.get(19)).toBe('C');
    expect(g.get(20)).toBe('ANULADA');
    expect(g.get(55)).toBe('D');
    expect(g.size).toBe(8);
  });

  const lower = (p: string) => ['a', 'b', 'c', 'd'].map((l) => `${l})  ${p} ${l}`);
  const page: T[] = [
    { top: 48, left: 31, text: 'QUESTÃO 1', bold: true, font: 1, width: 66 },
    ...col(31, 70, [
      'Tendo em vista seus conhecimentos, é correto dizer que a fronteira é essencial-',
      'mente política e que o conceito tem-',
      '-se mostrado útil.',
    ]),
    ...col(31, 130, lower('R1')),
    { top: 48, left: 309, text: 'QUESTÃO 2', bold: true, font: 1, width: 66 },
    ...col(309, 70, [
      'Outra pergunta sobre um assunto qualquer.',
      'Segunda linha do enunciado.',
      'Terceira linha do enunciado.',
      'Quarta linha do enunciado.',
      'Quinta linha do enunciado.',
    ]),
    ...col(309, 140, lower('R2')),
    { top: 800, left: 300, text: '1' },
    { top: 600, left: 31, text: 'RASCUNHO' },
  ];
  it('lê QUESTÃO N, alternativas a)–d), desfaz hifenização e descarta rodapé/rascunho', () => {
    const pages = parsePdfXml(pdfXml([pageXml(1, page)]));
    const qs = extractUnicamp('x.pdf', new Map([[1, 'B'], [2, 'ANULADA']]), pages);
    expect(qs.map((q) => q.number)).toEqual([1, 2]);
    expect(qs[0]?.statement).toContain('essencialmente política');
    expect(qs[0]?.statement).toContain('tem-se mostrado');
    expect(qs[0]?.alternatives).toHaveLength(4);
    expect(qs[0]?.alternatives[1]).toEqual({ letter: 'B', text: 'R1 b' });
    expect(qs[0]?.correctLetter).toBe('B');
    expect(qs[1]?.annulled).toBe(true);
    expect(qs[1]?.statement).not.toContain('RASCUNHO');
    expect(qs[0]?.warnings ?? []).toEqual([]);
  });
});

describe('UFRGS', () => {
  const html = `<html><body><nav>Língua Portuguesa Literatura em Língua Portuguesa História</nav>
  <h2>Língua Portuguesa</h2> 01 B 02 D 03 C 04 C 05 D 06 E
  <h2>Literatura em Língua Portuguesa</h2> 03 A 04 C 05 A 06 B 07 B 08 ANULADA
  <h2>Inglês</h2> 01 A 02 D 03 D 04 B 05 A 06 C</body></html>`;
  it('parseia o gabarito por matéria e descarta as seções só com nome (menu)', () => {
    const g = parseUfrgsGabarito(html);
    expect([...g.keys()]).toEqual(['Português', 'Literatura', 'Inglês']);
    expect(g.get('Português')?.get(2)).toBe('D');
    expect(g.get('Literatura')?.get(8)).toBe('ANULADA');
    expect(g.get('Inglês')?.get(1)).toBe('A');
  });

  const gutter = (top: number, n: number): T => ({ top, left: 70, text: `${n}.`, width: 17 });
  const page1: T[] = [
    { top: 88, left: 112, text: 'LÍNGUA PORTUGUESA', bold: true, font: 1, width: 130 },
    { top: 115, left: 71, text: 'Instrução: As questões de 01 a 02 estão', width: 200 },
    ...ucol(92, 140, ['Primeira linha do texto comum às questões.', 'Segunda linha do texto comum.']),
    gutter(140, 1),
    gutter(152, 2),
    { top: 190, left: 71, text: '01.', bold: true, font: 1, width: 16 },
    { top: 190, left: 92, text: 'Assinale a alternativa correta sobre o texto.', width: 200 },
    ...ucol(92, 215, alts5('P1')),
    { top: 190, left: 312, text: '02.', bold: true, font: 1, width: 16 },
    { top: 190, left: 333, text: 'Qual a ideia principal do texto?', width: 200 },
    ...ucol(333, 205, ['Mais uma linha do enunciado.', 'E outra linha do enunciado.']),
    ...ucol(333, 240, alts5('P2')),
    { top: 790, left: 76, text: 'UFRGS-VESTIBULAR/2025-1º DIA' },
  ];
  const page2: T[] = [
    { top: 88, left: 112, text: 'LITERATURA', bold: true, font: 1, width: 130 },
    { top: 120, left: 71, text: '03.', bold: true, font: 1, width: 16 },
    { top: 120, left: 92, text: 'Sobre a obra lida em aula, assinale a correta.', width: 200 },
    ...ucol(92, 145, alts5('L3')),
    { top: 120, left: 312, text: '04.', bold: true, font: 1, width: 16 },
    { top: 120, left: 333, text: 'Outra pergunta de literatura.', width: 200 },
    ...ucol(333, 135, ['Linha extra um.', 'Linha extra dois.']),
    ...ucol(333, 165, alts5('L4')),
  ];
  const pages = parsePdfXml(pdfXml([pageXml(1, page1), pageXml(2, page2)]));
  const gab = parseUfrgsGabarito(html);

  it('identifica a matéria pelo banner, o gabarito por matéria e o texto-base "Instrução"', () => {
    const qs = extractUfrgs('x.pdf', gab, { tag: 'd1' }, pages);
    expect(qs.map((q) => [q.subject, q.number, q.externalId])).toEqual([
      ['Português', 1, 'd1-01'],
      ['Português', 2, 'd1-02'],
      ['Literatura', 3, 'd1-03'],
      ['Literatura', 4, 'd1-04'],
    ]);
    expect(qs[0]?.correctLetter).toBe('B');
    expect(qs[1]?.correctLetter).toBe('D');
    for (const q of qs.slice(0, 2)) {
      expect(q.statement).toContain('Primeira linha do texto comum');
      expect(q.statement).not.toContain('UFRGS-VESTIBULAR');
    }
    // a numeração de linhas do texto ("1.", "2.") não vira questão nem entra no enunciado
    expect(qs[0]?.statement).not.toMatch(/^1\./);
    expect(qs[2]?.statement).not.toContain('texto comum');
    expect(qs[0]?.alternatives.map((a) => a.letter)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
  it('banner de Inglês vira matéria com idioma e id com o idioma', () => {
    const p = parsePdfXml(
      pdfXml([
        pageXml(1, [
          { top: 88, left: 112, text: 'INGLÊS', bold: true, font: 1, width: 60 },
          { top: 120, left: 71, text: '01.', bold: true, font: 1, width: 16 },
          { top: 120, left: 92, text: 'Choose the best option for the sentence.', width: 200 },
          ...ucol(92, 145, alts5('E1')),
          { top: 120, left: 312, text: '02.', bold: true, font: 1, width: 16 },
          { top: 120, left: 333, text: 'Another question in English.', width: 200 },
          ...ucol(333, 135, ['Extra line one.', 'Extra line two.']),
          ...ucol(333, 165, alts5('E2')),
        ]),
      ]),
    );
    const qs = extractUfrgs('x.pdf', gab, { tag: 'd2' }, p);
    expect(qs[0]).toMatchObject({
      subject: 'Inglês',
      language: 'ingles',
      externalId: 'd2-ingles-01',
      correctLetter: 'A',
    });
    const only = extractUfrgs('x.pdf', gab, { tag: 'd2', languageOnly: true }, pages);
    expect(only).toHaveLength(0); // caderno sem idioma: nada a importar com languageOnly
  });
});

describe('qualidade por instituição', () => {
  const q = (n: number) => ({
    statement:
      'Um enunciado suficientemente longo para não ser considerado truncado pela checagem de qualidade.',
    imageUrls: [],
    alternatives: Array.from({ length: n }, (_, i) => ({
      letter: 'ABCDE'[i]!,
      text: `Resposta ${i}`,
      imageUrl: null,
      isCorrect: i === 1,
    })),
  });
  it('UNICAMP espera 4 alternativas; as demais, 5', () => {
    expect(expectedAlternativesOf('unicamp')).toBe(4);
    expect(expectedAlternativesOf('fuvest')).toBe(5);
    expect(expectedAlternativesOf(undefined)).toBe(5);
    const codes = (n: number, e: number) =>
      checkQuality(q(n), { expectedAlternatives: e }).map((i) => i.code);
    expect(codes(4, 4)).toEqual([]);
    expect(codes(4, 5)).toContain('alternatives_count');
    expect(codes(5, 4)).toContain('alternatives_count');
    expect(checkQuality(q(5)).map((i) => i.code)).toEqual([]);
  });
});

describe('classifyVestibular', () => {
  it('matéria conhecida pela posição: só infere assuntos', () => {
    const c = classifyVestibular({
      text: 'Uma partícula tem velocidade e aceleração constantes. Calcule a força resultante.',
      subject: 'Física',
    });
    expect(c).toMatchObject({ subject: 'Física', how: 'posicao' });
    expect(c.topics.length).toBeGreaterThan(0);
  });
  it('detecta inglês e espanhol pelo texto', () => {
    const en =
      'The most important thing about the study is that it shows how people are able to learn from their own mistakes and from the experience of others in this field of research.';
    const es =
      'El estudio muestra que las personas pueden aprender de sus errores y de la experiencia de los otros, sobre todo cuando se trata de un tema que les interesa mucho.';
    expect(detectLanguage(en)).toBe('ingles');
    expect(detectLanguage(es)).toBe('espanhol');
    expect(detectLanguage('Texto curto')).toBeNull();
    expect(classifyVestibular({ text: en })).toMatchObject({ subject: 'Inglês', how: 'idioma' });
  });
  it('sem posição: pontua por palavras-chave entre todas as matérias; evidência fraca = sem matéria', () => {
    const bio = classifyVestibular({
      text: 'A fotossíntese ocorre nos cloroplastos das células vegetais e produz glicose a partir de gás carbônico e água. A respiração celular ocorre nas mitocôndrias.',
    });
    expect(bio.subject).toBe('Biologia');
    expect(bio.how).toBe('palavras-chave');
    expect(classifyVestibular({ text: 'Assinale a alternativa correta.' })).toMatchObject({
      subject: null,
      how: 'indefinida',
    });
  });
});

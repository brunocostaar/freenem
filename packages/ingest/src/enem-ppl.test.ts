import { describe, expect, it } from 'vitest';
import { col, pageXml, pdfXml, type T } from './pdf/fixtures.js';
import { parsePdfXml } from './pdf/layout.js';
import {
  areaOfPpl,
  cleanPplPages,
  extractPpl,
  looksGarbled,
  parsePplGabarito,
  pplFiles,
} from './sources/enem-ppl.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Uma questão no formato do INEP: marcador em negrito, letras soltas (duplicadas) + texto ao lado. */
function question(left: number, top: number, n: string, stem: string[], alts: string[]): T[] {
  return [
    { top, left, text: `QUESTÃO ${n}`, bold: true, width: 64 },
    ...col(left, top + 16, stem, 12, 240),
    ...alts.flatMap((text, i) => {
      const y = top + 16 + stem.length * 12 + 8 + i * 14;
      const letter = { top: y + 2, left, width: 12, text: LETTERS[i]! };
      return [letter, { ...letter }, { top: y, left: left + 17, width: 220, text }];
    }),
  ];
}

const alts = (p: string) => LETTERS.map((l) => `${p} alternativa ${l}`);
const noise: T[] = [
  { top: 700, left: 284, width: 0, text: 'ENEM', font: 2 },
  { top: 800, left: 204, width: 160, text: 'LC - 1° dia | Caderno 1 - AZUL - 2ª Aplicação' },
  { top: 800, left: 532, width: 6, text: '3' },
  { top: 20, left: 300, width: 60, text: '*010175AZ3*' },
];

describe('ENEM PPL', () => {
  it('monta os nomes de arquivo do INEP', () => {
    expect(pplFiles(2022, 1).prova).toBe(
      'https://download.inep.gov.br/enem/provas_e_gabaritos/2022_PV_reaplicacao_PPL_D1_CD1.pdf',
    );
    expect(pplFiles(2023, 2).gabarito).toContain('2023_GB_reaplicacao_PPL_D2_CD7.pdf');
  });

  it('classifica a área pela posição', () => {
    expect([1, 45, 46, 90, 91, 135, 136, 180].map(areaOfPpl)).toEqual([
      'linguagens',
      'linguagens',
      'humanas',
      'humanas',
      'natureza',
      'natureza',
      'matematica',
      'matematica',
    ]);
  });

  it('lê o gabarito (duas respostas em 1–5, ANULADO, duas colunas)', () => {
    const text = `   1           D              B                     46         D
   2           A              C                     47         B
   6                  A                             51         E
  34               ANULADO                          79         B
                                                      01`;
    const g = parsePplGabarito(text, 1);
    expect(g.get(1)).toEqual({ pair: ['D', 'B'] });
    expect(g.get(46)).toEqual({ single: 'D' });
    expect(g.get(6)).toEqual({ single: 'A' });
    expect(g.get(34)).toEqual({ single: 'ANULADA' });
    expect(g.get(79)).toEqual({ single: 'B' });
    // dia 2 só aceita 91–180
    expect(parsePplGabarito('91 C 136 B 12 A', 2).size).toBe(2);
  });

  it('remove marca d’água/duplicatas e transforma a letra solta em "(A)"', () => {
    const pages = parsePdfXml(
      pdfXml([pageXml(1, [...question(31, 60, '01', ['Enunciado'], alts('x')), ...noise])]),
    );
    cleanPplPages(pages);
    const texts = pages[0]!.lines.map((l) => l.text);
    expect(texts.filter((t) => t === '(A)')).toHaveLength(1);
    expect(texts).toContain('x alternativa A');
  });

  it('detecta texto ilegível (fonte sem Unicode)', () => {
    const junk = Array.from({ length: 400 }, () => '&*+ ^{} ~<> _` | 2 (8 &I W').join(' ');
    const pages = parsePdfXml(pdfXml([pageXml(1, [{ top: 100, left: 31, text: junk }])]));
    expect(looksGarbled(pages)).toBe(true);
  });

  it('dia 1: inglês e espanhol (1–5) separados, depois 6+, sem rodapé nem marca d’água', () => {
    const p1: T[] = [
      { top: 40, left: 31, text: 'Questões de 01 a 05 (opção inglês)', bold: true, width: 200 },
      ...question(31, 60, '01', ['English stem one.'], alts('en1')),
      { top: 40, left: 312, text: 'Questões de 01 a 05 (opção espanhol)', bold: true, width: 200 },
      ...question(312, 60, '01', ['Enunciado en español.'], alts('es1')),
      ...noise,
    ];
    const p2: T[] = [
      ...question(31, 60, '06', ['Enunciado seis.'], alts('seis')),
      ...question(312, 60, '07', ['Enunciado sete.'], alts('sete')),
      ...noise,
    ];
    // texto corrido suficiente para não parecer ilegível
    const long: T[] = Array.from({ length: 80 }, (_, i) => ({
      top: 100 + (i % 40) * 15,
      left: 31 + 281 * Math.floor(i / 40),
      width: 240,
      text: 'texto de apoio com palavras comuns para o teste do detector de leitura',
    }));
    const pages = parsePdfXml(pdfXml([pageXml(1, long), pageXml(2, p1), pageXml(3, p2)]));
    const gab = parsePplGabarito('1 D B\n6 C\n7 E', 1);
    const qs = extractPpl('x.pdf', 1, gab, pages);
    expect(qs.map((q) => q.externalId)).toEqual(['1-ingles', '1-espanhol', '6', '7']);
    const [en, es, q6, q7] = qs;
    expect(en?.correctLetter).toBe('D');
    expect(es?.correctLetter).toBe('B');
    expect(en?.language).toBe('ingles');
    expect(en?.area).toBe('linguagens');
    expect(en?.statement).toBe('English stem one.');
    expect(en?.alternatives).toHaveLength(5);
    expect(en?.alternatives[2]).toEqual({ letter: 'C', text: 'en1 alternativa C' });
    expect(es?.alternatives[0]?.text).toBe('es1 alternativa A');
    expect(q6?.statement).toBe('Enunciado seis.');
    expect(q6?.correctLetter).toBe('C');
    expect(q7?.alternatives[4]?.text).toBe('sete alternativa E');
    for (const q of qs) {
      expect(q.statement).not.toMatch(/Caderno|AZUL|\*010175/);
      expect(q.alternatives.map((a) => a.text).join(' ')).not.toMatch(/Caderno|AZUL/);
      expect(q.warnings ?? []).toEqual([]);
    }
  });
});

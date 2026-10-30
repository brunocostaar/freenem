import type { ExamRef, ExtractedQuestion, Letter, Source } from '../index.js';
import { assembleQuestions, flowLines, type FlowSpec } from '../pdf/flow.js';
import { readPdf, type PdfLine, type PdfPage } from '../pdf/layout.js';
import { buildQuestion } from '../pdf/question.js';
import type { Gabarito } from './fuvest.js';
import { fetchPdf, pdfToText } from './pdf.js';

/**
 * UNICAMP (Comvest) — 1ª fase: prova de Conhecimentos Gerais, 72 questões de múltipla escolha com
 * 4 alternativas (a–d). O caderno "Q" é o importado; o gabarito oficial cobre os cadernos Q e Z
 * (ou Q e Y). Questões anuladas (marcadas com "*") não são importadas.
 */
export const UNICAMP_EDITIONS: Record<number, { prova: string; gabarito: string }> = {
  2024: {
    prova: 'https://www.comvest.unicamp.br/vest2024/F1/f12024Q_Y.pdf',
    gabarito: 'https://www.comvest.unicamp.br/wp-content/uploads/2023/10/Q_Y.pdf',
  },
  2025: {
    prova: 'https://www.comvest.unicamp.br/vest2025/F1/f12025Q_Z.pdf',
    gabarito:
      'https://www.comvest.unicamp.br/wp-content/uploads/2024/10/QZ_gabarito_2025_FINAL_site.pdf',
  },
};

export const UNICAMP_YEARS = Object.keys(UNICAMP_EDITIONS).map(Number);

/** Gabarito em tabela "01  B   19  A   37  D   55  B"; `*` marca questão anulada. */
export function parseUnicampGabarito(text: string): Gabarito {
  const out: Gabarito = new Map();
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(/(?<![\d])(\d{1,2})\s+([A-D]|\*)(?![A-Za-z])/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > 72) continue;
      out.set(n, m[2] === '*' ? 'ANULADA' : (m[2] as Letter));
    }
  }
  return out;
}

export const unicampSpec: FlowSpec = {
  questionStart(f) {
    const m = /^QUEST[ÃA]O\s+(\d{1,2})$/i.exec(f.line.text);
    return m && f.line.bold ? { number: Number(m[1]), rest: '' } : null;
  },
  preambleStart(f) {
    if (!/\bser[aã]o?\s+usad[oa]s?\s+para\s+responder/i.test(f.line.text)) return null;
    const nums = [...f.line.text.matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));
    return nums.length ? nums : null;
  },
};

const isJunk = (l: PdfLine, page: PdfPage) =>
  /^RASCUNHO$/i.test(l.text) ||
  /^UNICAMP VESTIBULAR/i.test(l.text) ||
  (/^\d{1,2}$/.test(l.text) && !l.bold && l.top > page.height - 70);

export function extractUnicamp(
  file: string,
  gabarito: Gabarito,
  pages: PdfPage[] = readPdf(file),
): ExtractedQuestion[] {
  const flows = flowLines(pages, {
    topMargin: 20,
    bottomMargin: 10,
    isJunk,
    splitBefore: /^([a-d])\)(?:\s|$)/,
    altMarker: /^([a-d])\)(?:\s|$)/,
  });
  const raws = assembleQuestions(pages, flows, unicampSpec);
  const out: ExtractedQuestion[] = [];
  for (const raw of raws) {
    if (raw.number < 1 || raw.number > 72) continue;
    const built = buildQuestion(file, raw, {
      altRe: /^([a-d])\)(?:\s+|$)/,
      expectedAlternatives: 4,
      softHyphen: true,
    });
    const g = gabarito.get(raw.number);
    out.push({
      number: raw.number,
      statement: built.statement,
      alternatives: built.alternatives.map((a) => ({ letter: a.letter, text: a.text })),
      correctLetter: g && g !== 'ANULADA' ? g : undefined,
      annulled: g === 'ANULADA',
      images: built.images,
      warnings: [...built.warnings, ...(g ? [] : ['sem gabarito'])],
    });
  }
  return out;
}

export function unicampSource(
  opts: { year?: number; pdf?: string; gabarito?: string } = {},
): Source {
  const year = opts.year ?? Math.max(...UNICAMP_YEARS);
  const ed = UNICAMP_EDITIONS[year];
  const pdfUrl = opts.pdf ?? ed?.prova;
  const gabUrl = opts.gabarito ?? ed?.gabarito;
  if (!pdfUrl || !gabUrl) {
    throw new Error(
      `UNICAMP ${year}: sem URL conhecida. Use --pdf <arquivo|url> --gabarito <arquivo|url>.`,
    );
  }
  const ref: ExamRef = {
    institution: 'unicamp',
    year,
    label: `UNICAMP ${year} · 1ª fase`,
    phase: '1ª fase',
    sourceUrl: pdfUrl,
    gabaritoUrl: gabUrl,
    externalPrefix: `unicamp-${year}-1f`,
    attribution: `UNICAMP ${year} · 1ª fase — prova oficial (comvest.unicamp.br)`,
    expectedAlternatives: 4,
    expectedQuestions: 72,
  };
  return {
    async listExams() {
      return [ref];
    },
    async extract() {
      const file = await fetchPdf(pdfUrl, `unicamp-${year}-prova.pdf`);
      const gab = await fetchPdf(gabUrl, `unicamp-${year}-gabarito.pdf`);
      return extractUnicamp(file, parseUnicampGabarito(pdfToText(gab)));
    },
  };
}

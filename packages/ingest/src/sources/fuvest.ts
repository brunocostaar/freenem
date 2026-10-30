import type { ExamRef, ExtractedQuestion, Letter, Source } from '../index.js';
import { assembleQuestions, flowLines, type FlowSpec } from '../pdf/flow.js';
import { readPdf, type PdfPage } from '../pdf/layout.js';
import { buildQuestion } from '../pdf/question.js';
import { fetchPdf, pdfToText } from './pdf.js';

/**
 * FUVEST — 1ª fase (prova de Conhecimentos Gerais, 90 questões de múltipla escolha A–E).
 * PDFs oficiais em fuvest.br/wp-content/uploads/. O "ano" é o do vestibular (FUVEST 2025 = prova
 * aplicada em 17/11/2024). Cada ano tem uma versão de caderno (V1 em 2025; V em 2023/2024) e um
 * PDF de gabarito com todas as versões. Tudo entra como rascunho com a fonte citada.
 */
const BASE = 'https://www.fuvest.br/wp-content/uploads';

export const FUVEST_EDITIONS: Record<number, { prova: string; gabarito: string; version: string }> =
  {
    2023: {
      prova: `${BASE}/fuvest2023_primeira_fase_prova_V.pdf`,
      gabarito: `${BASE}/fuvest2023_gabarito_primeira_fase.pdf`,
      version: 'V',
    },
    2024: {
      prova: `${BASE}/fuvest2024_primeira_fase_prova_V.pdf`,
      gabarito: `${BASE}/fuvest2024_gabarito_primeira_fase.pdf`,
      version: 'V',
    },
    2025: {
      prova: `${BASE}/fuvest2025_primeira_fase_prova_V1.pdf`,
      gabarito: `${BASE}/fuvest2025_gabarito_primeira_fase.pdf`,
      version: 'V1',
    },
  };

export const FUVEST_YEARS = Object.keys(FUVEST_EDITIONS).map(Number);

export type Gabarito = Map<number, Letter | 'ANULADA'>;

/**
 * Gabarito em tabela: cabeçalho "PROVA V1  PROVA V2 ..." e linhas "1 E 46 D  1 A 46 C ...", dois
 * pares (1–45 e 46–90) por versão. Só a primeira página/tabela ("GABARITO") é lida.
 */
export function parseFuvestGabarito(text: string, version: string): Gabarito {
  const out: Gabarito = new Map();
  const cut = text.search(/CORRESPOND[ÊE]NCIA/i);
  const body = cut > 0 ? text.slice(0, cut) : text;
  const lines = body.split('\n');
  const headIdx = lines.findIndex((l) => /PROVA\s+[A-Z0-9]+\s+PROVA\s+[A-Z0-9]+/.test(l));
  const versions = [...(lines[headIdx] ?? '').matchAll(/PROVA\s+([A-Z0-9]+)/g)].map((m) => m[1]!);
  const vi = versions.indexOf(version);
  if (vi < 0) throw new Error(`Versão ${version} não está no gabarito (${versions.join(', ')})`);
  for (const line of lines.slice(headIdx + 1)) {
    const pairs = [...line.matchAll(/(\d{1,2})\s+(ANULAD[AO]|[A-E])\b/g)];
    if (pairs.length !== versions.length * 2) continue;
    for (const j of [vi * 2, vi * 2 + 1]) {
      const p = pairs[j]!;
      const letter = p[2]!;
      out.set(Number(p[1]), letter.startsWith('ANULAD') ? 'ANULADA' : (letter as Letter));
    }
  }
  return out;
}

export const fuvestSpec: FlowSpec = {
  questionStart(f) {
    const l = f.line;
    if (!l.bold || !/^\d{1,2}$/.test(l.text)) return null;
    return { number: Number(l.text), rest: '' };
  },
  preambleStart(f) {
    if (!/^TEXTOS?\s+PARA\s+AS?\s+QUEST/i.test(f.line.text)) return null;
    const nums = [...f.line.text.matchAll(/\d{1,2}/g)].map((m) => Number(m[0]));
    return nums.length ? nums : null;
  },
};

const isJunk = (l: { text: string }) => /^Concurso Vestibular FUVEST/i.test(l.text);

export function extractFuvest(
  file: string,
  gabarito: Gabarito,
  pages: PdfPage[] = readPdf(file),
): ExtractedQuestion[] {
  const flows = flowLines(pages, { topMargin: 30, bottomMargin: 20, isJunk });
  const raws = assembleQuestions(pages, flows, fuvestSpec);
  const out: ExtractedQuestion[] = [];
  for (const raw of raws) {
    if (raw.number < 1 || raw.number > 90) continue;
    const built = buildQuestion(file, raw, { altRe: /^\(([A-E])\)\s*/, expectedAlternatives: 5 });
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

export function fuvestSource(opts: { year?: number; pdf?: string; gabarito?: string; version?: string } = {}): Source {
  const year = opts.year ?? Math.max(...FUVEST_YEARS);
  const ed = FUVEST_EDITIONS[year];
  const pdfUrl = opts.pdf ?? ed?.prova;
  const gabUrl = opts.gabarito ?? ed?.gabarito;
  if (!pdfUrl || !gabUrl) {
    throw new Error(
      `FUVEST ${year}: sem URL conhecida. Use --pdf <arquivo|url> --gabarito <arquivo|url> --version V1.`,
    );
  }
  const ref: ExamRef = {
    institution: 'fuvest',
    year,
    label: `FUVEST ${year} · 1ª fase`,
    phase: '1ª fase',
    sourceUrl: pdfUrl,
    gabaritoUrl: gabUrl,
    externalPrefix: `fuvest-${year}-1f`,
    attribution: `FUVEST ${year} · 1ª fase — prova oficial (fuvest.br)`,
    expectedAlternatives: 5,
    expectedQuestions: 90,
  };
  return {
    async listExams() {
      return [ref];
    },
    async extract() {
      const file = await fetchPdf(pdfUrl, `fuvest-${year}-prova.pdf`);
      const gab = await fetchPdf(gabUrl, `fuvest-${year}-gabarito.pdf`);
      const version = opts.version ?? ed?.version ?? 'V1';
      return extractFuvest(file, parseFuvestGabarito(pdfToText(gab), version));
    },
  };
}

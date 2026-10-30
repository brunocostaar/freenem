import type { ExamRef, ExtractedQuestion, Letter, Source } from '../index.js';
import { assembleQuestions, flowLines, type FlowSpec } from '../pdf/flow.js';
import { readPdf, type PdfLine, type PdfPage } from '../pdf/layout.js';
import { buildQuestion } from '../pdf/question.js';
import { fetchPdf, fetchText, htmlToText } from './pdf.js';

/**
 * UFRGS (COPERSE) — Concurso Vestibular. Dois dias de prova objetiva com alternativas (A)–(E):
 *  - 1º dia: Português (1–15), Literatura (16–30), História (31–45), Geografia (46–60), Matemática (61–75);
 *  - 2º dia: Língua estrangeira (1–15; caderno por idioma), Física (16–30), Química (31–45), Biologia (46–60).
 * Os cadernos ficam em ufrgs.br/coperse/wp-content/uploads/ e o gabarito (por matéria) em
 * vestibular.ufrgs.br/cv<ano>/gabaritos/. Importamos Inglês e Espanhol (as matérias da taxonomia);
 * as questões comuns do 2º dia entram uma única vez (do caderno de Inglês).
 */
const COPERSE = 'https://www.ufrgs.br/coperse/wp-content/uploads';

export interface UfrgsEdition {
  d1: string;
  d2: Record<'ingles' | 'espanhol', string>;
}

export const UFRGS_EDITIONS: Record<number, UfrgsEdition> = {
  2024: {
    d1: `${COPERSE}/2023/12/1o-DIA-PROVA-2024.pdf`,
    d2: {
      ingles: `${COPERSE}/2023/12/2o-DIA-2024-INGLES.pdf`,
      espanhol: `${COPERSE}/2023/12/2o-DIA-2024-ESPANHOL.pdf`,
    },
  },
  2025: {
    d1: `${COPERSE}/2024/12/Prova-1o-DIA.pdf`,
    d2: {
      ingles: `${COPERSE}/2024/12/PROVA-INGLES.pdf`,
      espanhol: `${COPERSE}/2024/12/PROVA-ESPANHOL.pdf`,
    },
  },
  2026: {
    d1: `${COPERSE}/2025/12/PROVA-1-DIA-COM-CAPA.pdf`,
    d2: {
      ingles: `${COPERSE}/2025/12/PROVA-2o-DIA-INGLES-COM-CAPA.pdf`,
      espanhol: `${COPERSE}/2025/12/PROVA-2o-DIA-ESPANHOL-COM-CAPA.pdf`,
    },
  },
};

export const UFRGS_YEARS = Object.keys(UFRGS_EDITIONS).map(Number);
export const ufrgsGabaritoUrl = (year: number) =>
  `https://vestibular.ufrgs.br/cv${year}/gabaritos/`;

/** Nome da matéria no gabarito -> nome na taxonomia do banco. */
const GABARITO_SUBJECTS: [RegExp, string][] = [
  [/Literatura em L[ií]ngua Portuguesa/, 'Literatura'],
  [/L[ií]ngua Portuguesa/, 'Português'],
  [/Hist[óo]ria/, 'História'],
  [/Geografia/, 'Geografia'],
  [/Matem[áa]tica/, 'Matemática'],
  [/Ingl[êe]s/, 'Inglês'],
  [/Espanhol/, 'Espanhol'],
  [/Italiano/, 'Italiano'],
  [/Franc[êe]s/, 'Francês'],
  [/Alem[ãa]o/, 'Alemão'],
  [/F[íi]sica/, 'Física'],
  [/Qu[íi]mica/, 'Química'],
  [/Biologia/, 'Biologia'],
];

export type UfrgsGabarito = Map<string, Map<number, Letter | 'ANULADA'>>;

/** Gabarito por matéria (texto da página HTML): "Língua Portuguesa 01 B 02 D ... Literatura ...". */
export function parseUfrgsGabarito(html: string): UfrgsGabarito {
  const text = htmlToText(html);
  const names = GABARITO_SUBJECTS.map(([re]) => re.source).join('|');
  const tokenRe = new RegExp(`(${names})|\\b(\\d{2})\\s+(ANULADA|[A-E])\\b`, 'g');
  const out: UfrgsGabarito = new Map();
  let current: string | undefined;
  for (const m of text.matchAll(tokenRe)) {
    if (m[1]) {
      current = GABARITO_SUBJECTS.find(([re]) => new RegExp(`^(?:${re.source})$`).test(m[1]!))?.[1];
      continue;
    }
    if (!current) continue;
    const bucket = out.get(current) ?? new Map();
    bucket.set(Number(m[2]), m[3] as Letter | 'ANULADA');
    out.set(current, bucket);
  }
  // seções só com os nomes do menu (sem respostas) não entram
  for (const [k, v] of out) if (v.size < 5) out.delete(k);
  return out;
}

export const ufrgsSpec: FlowSpec = {
  questionStart(f) {
    const l = f.line;
    // o "01" da primeira questão vem em negrito sem o ponto, que fica no trecho seguinte
    if (!l.headBold || !/^\d{2}\.?$/.test(l.headText ?? '')) return null;
    return {
      number: Number(l.headText!.slice(0, 2)),
      rest: l.text
        .slice((l.headText ?? '').length)
        .replace(/^\s*\.\s*/, '')
        .trim(),
    };
  },
  preambleStart(f) {
    if (!/^Instru[cç][aã]o/i.test(f.line.text)) return null;
    const nums = [...f.line.text.matchAll(/\b\d{2}\b/g)].map((m) => Number(m[0]));
    return nums.length ? nums : null;
  },
};

const BANNER =
  /^(L[ÍI]NGUA PORTUGUESA|LITERATURA|HIST[ÓO]RIA|GEOGRAFIA|MATEM[ÁA]TICA|INGL[ÊE]S|ESPANHOL|FRANC[ÊE]S|ITALIANO|ALEM[ÃA]O|F[ÍI]SICA|QU[ÍI]MICA|BIOLOGIA|LITERATURA EM L[ÍI]NGUA PORTUGUESA)$/;

const isJunk = (l: PdfLine, page: PdfPage) =>
  /UFRGS\s*[-–]\s*(VESTIBULAR|CV)/i.test(l.text) ||
  // rodapé do caderno de 2024 vem em dois trechos: "8 … UFRGS" e "– CV/2024 – 1º DIA"
  /^[–-]\s*CV\/\d{4}/.test(l.text) ||
  (l.top > page.height - 90 && /^(\d{1,2}\s+)?UFRGS$/.test(l.text)) ||
  (/^\d{1,2}$/.test(l.text) && !l.bold && (l.top > page.height - 120 || l.top < 40)) ||
  // numeração de linhas dos textos ("49.") fica na margem; os marcadores de questão são negrito
  (/^\d{1,3}\.$/.test(l.text) && !l.bold) ||
  (l.bold && BANNER.test(l.text));

/** Rótulo do banner da seção -> matéria (null = não é prova objetiva, ex.: Redação). */
const BANNER_SUBJECT: [RegExp, string | null][] = [
  [/^LITERATURA/, 'Literatura'],
  [/^L[ÍI]NGUA PORTUGUESA/, 'Português'],
  [/^HIST[ÓO]RIA/, 'História'],
  [/^GEOGRAFIA/, 'Geografia'],
  [/^MATEM[ÁA]TICA/, 'Matemática'],
  [/^INGL[ÊE]S/, 'Inglês'],
  [/^ESPANHOL/, 'Espanhol'],
  [/^FRANC[ÊE]S/, 'Francês'],
  [/^ITALIANO/, 'Italiano'],
  [/^ALEM[ÃA]O/, 'Alemão'],
  [/^F[ÍI]SICA/, 'Física'],
  [/^QU[ÍI]MICA/, 'Química'],
  [/^BIOLOGIA/, 'Biologia'],
  [/^REDA[ÇC][ÃA]O/, null],
];

/** Banners de seção (negrito, topo da página): página em que cada matéria começa. */
export function sectionStarts(pages: PdfPage[]): { page: number; subject: string | null }[] {
  const out: { page: number; subject: string | null }[] = [];
  for (const p of pages) {
    for (const l of p.lines) {
      if (!l.bold || l.top > 160 || !BANNER.test(l.text)) continue;
      const hit = BANNER_SUBJECT.find(([re]) => re.test(l.text));
      if (hit) out.push({ page: p.number, subject: hit[1] });
    }
  }
  return out.sort((a, b) => a.page - b.page);
}

export interface UfrgsExtractOpts {
  /** idioma do caderno do 2º dia: com `languageOnly`, só o bloco de língua é importado */
  languageOnly?: boolean;
  /** língua estrangeira do caderno (Inglês/Espanhol): outras línguas e matérias comuns ficam de fora */
  tag: string;
}

export function extractUfrgs(
  file: string,
  gabarito: UfrgsGabarito,
  opts: UfrgsExtractOpts,
  pages: PdfPage[] = readPdf(file),
): ExtractedQuestion[] {
  const flows = flowLines(pages, { topMargin: 25, bottomMargin: 30, isJunk, detectTables: true });
  const raws = assembleQuestions(pages, flows, ufrgsSpec);
  const sections = sectionStarts(pages);
  const subjectOf = (page: number): string | null | undefined =>
    [...sections].reverse().find((s) => s.page <= page)?.subject;
  const LANGS = ['Inglês', 'Espanhol', 'Francês', 'Italiano', 'Alemão'];
  const out: ExtractedQuestion[] = [];
  for (const raw of raws) {
    const subject = subjectOf(raw.page);
    if (!subject) continue;
    const isLang = LANGS.includes(subject);
    if (opts.languageOnly && !isLang) continue;
    const g = gabarito.get(subject)?.get(raw.number);
    const built = buildQuestion(file, raw, { altRe: /^\(([A-E])\)\s*/, expectedAlternatives: 5 });
    const lang = subject === 'Inglês' ? 'ingles' : subject === 'Espanhol' ? 'espanhol' : undefined;
    out.push({
      number: raw.number,
      statement: built.statement,
      alternatives: built.alternatives.map((a) => ({ letter: a.letter, text: a.text })),
      correctLetter: g && g !== 'ANULADA' ? g : undefined,
      annulled: g === 'ANULADA',
      subject: LANGS.includes(subject) && !lang ? undefined : subject,
      language: lang,
      // idiomas repetem a numeração 01–15: o idioma entra no id
      externalId: isLang
        ? `${opts.tag}-${lang ?? subject.toLowerCase()}-${pad(raw.number)}`
        : `${opts.tag}-${pad(raw.number)}`,
      images: built.images,
      warnings: [...built.warnings, ...(g ? [] : ['sem gabarito'])],
    });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Matérias (do gabarito) que aparecem nos banners do caderno: base do nº esperado de questões. */
export function expectedFor(
  pages: PdfPage[],
  gabarito: UfrgsGabarito,
  languageOnly: boolean,
): number {
  const LANGS = ['Inglês', 'Espanhol', 'Francês', 'Italiano', 'Alemão'];
  const seen = new Set(sectionStarts(pages).flatMap((s) => (s.subject ? [s.subject] : [])));
  let n = 0;
  for (const subject of seen) {
    if (languageOnly && !LANGS.includes(subject)) continue;
    n += gabarito.get(subject)?.size ?? 0;
  }
  return n;
}

export function ufrgsSource(
  opts: {
    year?: number;
    pdf?: string;
    pdf2?: string;
    gabarito?: string;
    languages?: ('ingles' | 'espanhol')[];
  } = {},
): Source {
  const year = opts.year ?? Math.max(...UFRGS_YEARS);
  const ed = UFRGS_EDITIONS[year];
  const gabUrl = opts.gabarito ?? ufrgsGabaritoUrl(year);
  const d1 = opts.pdf ?? ed?.d1;
  if (!d1) {
    throw new Error(
      `UFRGS ${year}: sem URL conhecida. Use --pdf <1º dia> --pdf2 <2º dia (inglês)> [--gabarito <html|url>].`,
    );
  }
  const langs = opts.languages ?? ['ingles', 'espanhol'];
  const common = {
    institution: 'ufrgs',
    year,
    gabaritoUrl: gabUrl,
    expectedAlternatives: 5,
  } as const;
  const exams: ExamRef[] = [
    {
      ...common,
      label: `UFRGS ${year} · 1º dia`,
      phase: '1º dia',
      key: 'd1',
      sourceUrl: d1,
      externalPrefix: `ufrgs-${year}`,
      attribution: `UFRGS ${year} · 1º dia — prova oficial (ufrgs.br/coperse)`,
    },
    {
      ...common,
      label: `UFRGS ${year} · 2º dia`,
      phase: '2º dia',
      key: 'd2',
      sourceUrl: opts.pdf2 ?? ed?.d2.ingles,
      externalPrefix: `ufrgs-${year}`,
      attribution: `UFRGS ${year} · 2º dia — prova oficial (ufrgs.br/coperse)`,
    },
  ];
  const expected = new Map<string, number>();
  return {
    async listExams() {
      return opts.pdf2 === undefined && !ed ? exams.slice(0, 1) : exams;
    },
    async expectedCount(exam) {
      return expected.get(exam.key ?? '');
    },
    async extract(exam) {
      const gab = parseUfrgsGabarito(await fetchText(gabUrl));
      if (exam.key === 'd1') {
        const file = await fetchPdf(d1, `ufrgs-${year}-d1.pdf`);
        const pages = readPdf(file);
        expected.set('d1', expectedFor(pages, gab, false));
        return extractUfrgs(file, gab, { tag: 'd1' }, pages);
      }
      const out: ExtractedQuestion[] = [];
      let total = 0;
      const first = langs[0] ?? 'ingles';
      for (const lang of langs) {
        const url = lang === first ? (opts.pdf2 ?? ed?.d2[lang]) : ed?.d2[lang];
        if (!url) continue;
        const file = await fetchPdf(url, `ufrgs-${year}-d2-${lang}.pdf`);
        const pages = readPdf(file);
        const languageOnly = lang !== first;
        total += expectedFor(pages, gab, languageOnly);
        out.push(...extractUfrgs(file, gab, { tag: 'd2', languageOnly }, pages));
      }
      expected.set('d2', total);
      return out;
    },
  };
}

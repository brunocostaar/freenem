import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EnemArea } from '@freenem/shared';
import type { ExamRef, ExtractedQuestion, Letter, Source } from '../index.js';
import { assembleQuestions, flowLines, type FlowLine, type FlowSpec } from '../pdf/flow.js';
import { readPdf, type PdfLine, type PdfPage } from '../pdf/layout.js';
import { buildQuestion } from '../pdf/question.js';
import { CACHE_DIR } from '../paths.js';
import { downloadInep } from '../remote-zip.js';
import { pdfToText } from './pdf.js';

/**
 * ENEM PPL (Programa Prisional / 2ª aplicação) — provas oficiais do INEP, caderno 1 (azul) do dia 1
 * e caderno 7 (azul) do dia 2. Dia 1: Linguagens (Q1–5 inglês OU espanhol, depois 6–45) + Humanas
 * (46–90); dia 2: Natureza (91–135) + Matemática (136–180). Questões anuladas não são importadas.
 */
const BASE = 'https://download.inep.gov.br/enem/provas_e_gabaritos';

/** Anos com PDFs oficiais encontrados no servidor do INEP (2016–2019 só existem no portal antigo). */
export const PPL_YEARS = [2020, 2021, 2022, 2023, 2024];

export type PplDay = 1 | 2;

/** Nome de arquivo do INEP: o prefixo `reaplicacao_PPL` é o mesmo em todos os anos de 2020 a 2024. */
export function pplFiles(year: number, day: PplDay): { prova: string; gabarito: string } {
  const tail = `reaplicacao_PPL_${day === 1 ? 'D1_CD1' : 'D2_CD7'}`;
  return {
    prova: `${BASE}/${year}_PV_${tail}.pdf`,
    gabarito: `${BASE}/${year}_GB_${tail}.pdf`,
  };
}

async function fetchInepPdf(url: string, name: string): Promise<string> {
  const dest = path.join(CACHE_DIR, 'pdf', name);
  if (existsSync(dest)) return dest;
  const buf = await downloadInep(url);
  if (!buf) throw new Error(`HTTP 404 em ${url}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return dest;
}

// ---------------------------------------------------------------- gabarito

export type PplGabarito = Map<
  number,
  { single?: Letter | 'ANULADA'; pair?: (Letter | 'ANULADA')[] }
>;

/**
 * Gabarito em tabela: "1  D  B   46  D". Nas questões 1–5 do dia 1 vêm duas respostas
 * (inglês, espanhol); nas demais, uma. "ANULADO" marca questão anulada.
 */
export function parsePplGabarito(text: string, day: PplDay): PplGabarito {
  const out: PplGabarito = new Map();
  const [lo, hi] = day === 1 ? [1, 90] : [91, 180];
  for (const line of text.split('\n')) {
    const toks = line.trim().split(/\s+/).filter(Boolean);
    let n: number | null = null;
    let answers: (Letter | 'ANULADA')[] = [];
    const flush = () => {
      if (n !== null && answers.length > 0 && !out.has(n)) {
        out.set(n, answers.length >= 2 ? { pair: answers } : { single: answers[0] });
      }
    };
    for (const t of toks) {
      if (/^\d{1,3}$/.test(t)) {
        flush();
        const v = Number(t);
        n = v >= lo && v <= hi ? v : null;
        answers = [];
      } else if (/^[A-E]$/.test(t)) answers.push(t as Letter);
      else if (/^ANULAD[OA]$/i.test(t)) answers.push('ANULADA');
      else {
        flush();
        n = null;
        answers = [];
      }
    }
    flush();
  }
  return out;
}

// ------------------------------------------------------------------ parser

/** `QUESTÃO 05` / `Questão 5`, em negrito, sozinho na linha. */
export const pplSpec: FlowSpec = {
  questionStart(f) {
    const m = /^QUEST[ÃA]O\s+(\d{1,3})$/i.exec(f.line.text);
    return m && f.line.bold ? { number: Number(m[1]), rest: '' } : null;
  },
};

const LANG_HEADER = /^Quest[õo]es de 0?1 a 0?5 \(op[çc][ãa]o:?\s*(ingl[êe]s|espanhol)\)/i;

const isJunk = (l: PdfLine, page: PdfPage) =>
  (/^\d{1,2}$/.test(l.text) && l.top > page.height - 60) || // número da página
  /^\*\d+[A-Z]{1,3}\d*\*$/.test(l.text) || // código de barras do caderno
  /^(LC|CH|CN|MT)\s*-\s*\d/.test(l.text) || // rodapé "LC - 1° dia | Caderno 1 - AZUL"
  /^(ENEM\s*20\d\d\s*)+$/i.test(l.text) || // marca d'água
  /^RASCUNHO$/i.test(l.text) ||
  (/^Quest[õo]es de \d+ a \d+/i.test(l.text) && !LANG_HEADER.test(l.text)) ||
  /^(LINGUAGENS, C[ÓO]DIGOS|CI[ÊE]NCIAS (HUMANAS|DA NATUREZA)|MATEM[ÁA]TICA E SUAS)/i.test(
    l.text,
  ) ||
  /^E SUAS TECNOLOGIAS$/i.test(l.text);

/**
 * Limpa o XML do `pdftohtml`: remove marcas d'água (fonte minúscula, repetidas), elementos duplicados
 * (o INEP sobrepõe a letra da alternativa duas vezes) e troca a letra solta da alternativa por "(A)".
 */
export function cleanPplPages(pages: PdfPage[]): void {
  for (const page of pages) {
    const seen = new Set<string>();
    const kept: PdfLine[] = [];
    for (const l of page.lines) {
      if (l.size < 4) continue;
      const key = `${Math.round(l.top)}|${Math.round(l.left)}|${l.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // letra da alternativa: elemento solto, seguido do texto na mesma linha (±4pt de altura)
      const isLetter =
        /^[A-E]$/.test(l.text) &&
        l.width <= 20 &&
        page.lines.some(
          (o) =>
            o !== l &&
            Math.abs(o.top - l.top) <= 4 &&
            o.left >= l.left + 8 &&
            o.left <= l.left + 30 &&
            !/^[A-E]$/.test(o.text),
        );
      kept.push(isLetter ? { ...l, text: `(${l.text})`, bold: false } : l);
    }
    page.lines = kept;
  }
}

/** PDFs cuja fonte não tem mapeamento Unicode (ex.: 2021) viram lixo: detecta pela falta de palavras comuns. */
export function looksGarbled(pages: PdfPage[]): boolean {
  const txt = pages
    .flatMap((p) => p.lines)
    .filter((l) => l.size >= 4)
    .map((l) => l.text)
    .join(' ');
  if (txt.length < 5000) return true;
  // texto sadio tem < 0,3% de símbolos de programação; o ilegível passa de 1%
  const sym = (txt.match(/[&*+^{}~<>_`\\|@#]/g) ?? []).length;
  return sym / txt.length > 0.006;
}

/** Textos curtos de alternativa/enunciado: marca de página etc. não entram (veja `isJunk`). */
function segment(flows: FlowLine[], from: number, to: number): FlowLine[] {
  return flows.slice(from, to);
}

export interface PplRaw {
  number: number;
  language?: 'ingles' | 'espanhol';
  built: ReturnType<typeof buildQuestion>;
}

export function areaOfPpl(n: number): EnemArea {
  if (n <= 45) return 'linguagens';
  if (n <= 90) return 'humanas';
  if (n <= 135) return 'natureza';
  return 'matematica';
}

/** Lê as questões de um dia (sem gabarito). */
export function extractPplDay(
  file: string,
  day: PplDay,
  pages: PdfPage[] = readPdf(file),
): PplRaw[] {
  cleanPplPages(pages);
  if (looksGarbled(pages)) {
    throw new Error(
      'texto do PDF ilegível (fonte sem mapeamento Unicode); sem OCR disponível, ano ignorado',
    );
  }
  const flows = flowLines(pages, {
    topMargin: 20,
    bottomMargin: 36,
    isJunk,
    altMarker: /^\(([A-E])\)/,
  });
  const run = (part: FlowLine[], first: number, language?: 'ingles' | 'espanhol'): PplRaw[] => {
    const spec: FlowSpec = {
      ...pplSpec,
      accept: (n, last) => (last === 0 ? n === first : n > last && n <= last + 3),
    };
    return assembleQuestions(pages, part, spec).map((raw) => ({
      number: raw.number,
      language,
      built: buildQuestion(file, raw, { altRe: /^\(([A-E])\)\s*/, expectedAlternatives: 5 }),
    }));
  };
  const headerIdx = (lang: 'ingles' | 'espanhol') =>
    flows.findIndex((f) => {
      const m = LANG_HEADER.exec(f.line.text);
      return m?.[1] !== undefined && (/^ingl/i.test(m[1]) ? 'ingles' : 'espanhol') === lang;
    });
  const dropHeaders = (fs: FlowLine[]) => fs.filter((f) => !LANG_HEADER.test(f.line.text));

  if (day === 2) return run(flows, 91);

  const iEn = headerIdx('ingles');
  const iEs = headerIdx('espanhol');
  if (iEn < 0 || iEs < 0) throw new Error('cabeçalhos de língua estrangeira não encontrados');
  const i6 = flows.findIndex((f, i) => {
    if (i <= iEs) return false;
    const h = pplSpec.questionStart(f);
    return h?.number === 6;
  });
  if (i6 < 0) throw new Error('questão 6 não encontrada');
  return [
    ...run(dropHeaders(segment(flows, iEn, iEs)), 1, 'ingles'),
    ...run(dropHeaders(segment(flows, iEs, i6)), 1, 'espanhol'),
    ...run(dropHeaders(segment(flows, i6, flows.length)), 6),
  ];
}

export function extractPpl(
  file: string,
  day: PplDay,
  gabarito: PplGabarito,
  pages?: PdfPage[],
): ExtractedQuestion[] {
  const out: ExtractedQuestion[] = [];
  for (const r of extractPplDay(file, day, pages)) {
    const g = gabarito.get(r.number);
    let answer: Letter | 'ANULADA' | undefined;
    if (g?.pair) answer = g.pair[r.language === 'espanhol' ? 1 : 0];
    else answer = g?.single;
    out.push({
      number: r.number,
      externalId: r.language ? `${r.number}-${r.language}` : String(r.number),
      statement: r.built.statement,
      alternatives: r.built.alternatives.map((a) => ({ letter: a.letter, text: a.text })),
      correctLetter: answer && answer !== 'ANULADA' ? answer : undefined,
      annulled: answer === 'ANULADA',
      language: r.language,
      area: areaOfPpl(r.number),
      images: r.built.images,
      warnings: [...r.built.warnings, ...(answer ? [] : ['sem gabarito'])],
    });
  }
  return out;
}

export function enemPplSource(opts: { year: number; days?: PplDay[] }): Source {
  const { year } = opts;
  const days = opts.days ?? [1, 2];
  const refs = new Map<string, ExamRef>();
  for (const day of days) {
    const f = pplFiles(year, day);
    refs.set(`d${day}`, {
      institution: 'enem',
      year,
      label: `ENEM PPL ${year} · Dia ${day}`,
      phase: `PPL · Dia ${day}`,
      key: `d${day}`,
      color: 'azul',
      sourceUrl: f.prova,
      gabaritoUrl: f.gabarito,
      externalPrefix: `enem-ppl-${year}`,
      attribution: `ENEM PPL ${year} · Dia ${day} — prova oficial do INEP (download.inep.gov.br)`,
      license: 'Prova © INEP — uso educacional com atribuição; remoção a pedido',
      expectedAlternatives: 5,
      expectedQuestions: day === 1 ? 95 : 90,
      publishable: true,
    });
  }
  return {
    async listExams() {
      return [...refs.values()];
    },
    async extract(exam) {
      const day: PplDay = exam.key === 'd2' ? 2 : 1;
      const f = pplFiles(year, day);
      const file = await fetchInepPdf(f.prova, `enem-ppl-${year}-d${day}-prova.pdf`);
      const gab = await fetchInepPdf(f.gabarito, `enem-ppl-${year}-d${day}-gabarito.pdf`);
      return extractPpl(file, day, parsePplGabarito(pdfToText(gab), day));
    },
  };
}

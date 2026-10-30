import type { Letter } from '../index.js';
import {
  cropPng,
  joinParagraphs,
  mdEscape,
  unionBox,
  type Box,
  type PdfImage,
  type PdfLine,
} from './layout.js';

/** Trecho contíguo de uma questão numa coluna de uma página. */
export interface Slice {
  page: number;
  box: Box;
  lines: PdfLine[];
  images: PdfImage[];
}

export interface AlternativeLines {
  letter: Letter;
  lines: PdfLine[];
}

export interface SplitResult {
  stem: PdfLine[];
  alts: AlternativeLines[];
}

const LETTERS: Letter[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Separa enunciado e alternativas. `markerRe` captura a letra (grupo 1) no início da linha
 * ("(A) texto" ou "a) texto"). Procura a MAIOR cadeia A, B, C... a partir da última
 * linha "A" que fecha a cadeia esperada (evita confundir enumerações dentro do enunciado).
 */
export function splitAlternatives(lines: PdfLine[], markerRe: RegExp, expected = 5): SplitResult {
  const hits: { idx: number; letter: Letter }[] = [];
  lines.forEach((l, idx) => {
    const m = markerRe.exec(l.text);
    if (m?.[1]) hits.push({ idx, letter: m[1].toUpperCase() as Letter });
  });
  let best: { idx: number; letter: Letter }[] = [];
  for (let s = hits.length - 1; s >= 0; s--) {
    if (hits[s]!.letter !== 'A') continue;
    const chain = [hits[s]!];
    for (const h of hits.slice(s + 1)) {
      if (h.letter === LETTERS[chain.length]) chain.push(h);
    }
    if (chain.length >= expected) {
      best = chain;
      break;
    }
    if (chain.length > best.length) best = chain;
  }
  if (best.length < 2) return { stem: lines, alts: [] };
  const stem = lines.slice(0, best[0]!.idx);
  const alts = best.map((h, i) => ({
    letter: h.letter,
    lines: lines.slice(h.idx, best[i + 1]?.idx ?? lines.length),
  }));
  return { stem, alts };
}

/** Texto de uma alternativa: remove o marcador, junta as linhas num parágrafo único. */
export function altText(
  a: AlternativeLines,
  markerRe: RegExp,
  opts: { softHyphen?: boolean } = {},
): string {
  const [first, ...rest] = a.lines;
  if (!first) return '';
  const head: PdfLine = { ...first, text: first.text.replace(markerRe, '').trim() };
  const joined = joinParagraphs(
    [head, ...rest].filter((l) => l.text),
    opts,
  );
  return mdEscape(joined.replace(/\s*\n\n\s*/g, ' ').trim());
}

/**
 * Alternativas em grade (a/b à esquerda, c/d à direita, ou em linhas): reordena as linhas a partir
 * do primeiro marcador para a/b/c/d..., ligando cada linha de continuação ao marcador da sua célula.
 */
export function normalizeGrid(lines: PdfLine[], markerRe: RegExp): PdfLine[] {
  const isMarker = (l: PdfLine) => markerRe.test(l.text);
  const marks = lines.filter(isMarker);
  const grid = marks.some((m) =>
    marks.some((o) => o !== m && o.page === m.page && Math.abs(o.top - m.top) <= 3),
  );
  if (!grid) return lines;
  const start = lines.findIndex(isMarker);
  const head = lines.slice(0, start);
  const block = lines.slice(start);
  const owner = (l: PdfLine): PdfLine | undefined => {
    if (isMarker(l)) return l;
    return marks
      .filter((m) => m.page === l.page && m.top <= l.top + 3 && m.left <= l.left + 3)
      .sort((a, b) => b.top - a.top || b.left - a.left)[0];
  };
  const keyed = block.map((l, i) => {
    const o = owner(l);
    const letter = o ? (markerRe.exec(o.text)?.[1] ?? 'z').toUpperCase() : 'Z';
    return { l, i, letter };
  });
  keyed.sort((a, b) => a.letter.localeCompare(b.letter) || a.l.top - b.l.top || a.i - b.i);
  return [...head, ...keyed.map((k) => k.l)];
}

export function bodySize(lines: PdfLine[]): number {
  const counts = new Map<number, number>();
  for (const l of lines) counts.set(l.size, (counts.get(l.size) ?? 0) + l.text.length);
  let best = 0;
  let bestN = 0;
  for (const [size, n] of counts) {
    if (n > bestN) {
      best = size;
      bestN = n;
    }
  }
  return best;
}

const FIGURE_CUE =
  /\b(figura|figuras|gr[aá]fico|gr[aá]ficos|tabela|tabelas|mapa|mapas|charge|tirinha|tirinhas|ilustra[cç][aã]o|esquema|diagrama|infogr[aá]fico|cartum|histograma|fluxograma|organograma)\b/i;
const MATH_GLYPHS = /[√∑∫∞≤≥≠≈±×÷∆Δπθλμωαβγ→⇌⇄]|⁄/;

export interface FigureInfo {
  /** recortes (em ordem de leitura) */
  boxes: { page: number; box: Box }[];
  /** linhas que ficam dentro da figura e saem do texto */
  droppedLines: Set<PdfLine>;
  warnings: string[];
}

const area = (i: PdfImage) => i.width * i.height;

/**
 * Decide o que recortar do PDF para uma questão:
 *  1. imagens embutidas grandes dentro do trecho;
 *  2. gráficos vetoriais (muitos fragmentos de texto miúdo/isolado, como rótulos de eixos);
 *  3. fórmulas (glifos matemáticos/sobrescritos): recorta a questão inteira;
 *  4. alternativas vazias (provavelmente figuras): recorta a questão inteira;
 *  5. na dúvida (palavra de figura no enunciado, sem nada detectado): recorta o enunciado.
 */
export function detectFigures(
  slices: Slice[],
  split: SplitResult,
  altTexts: string[],
  stemText: string,
): FigureInfo {
  const info: FigureInfo = { boxes: [], droppedLines: new Set(), warnings: [] };
  const stemSet = new Set(split.stem);
  const body = bodySize(slices.flatMap((s) => s.lines));
  const whole = () =>
    slices.map((s) => ({ page: s.page, box: s.box })).filter((b) => b.box.y1 > b.box.y0);

  // 1) imagens embutidas
  for (const s of slices) {
    const imgs = s.images.filter((i) => area(i) >= 900);
    if (imgs.length === 0) continue;
    const u = unionBox(
      imgs.map((i) => ({ x0: i.left, y0: i.top, x1: i.left + i.width, y1: i.top + i.height })),
    );
    info.boxes.push({
      page: s.page,
      box: {
        x0: Math.max(s.box.x0, u.x0 - 1),
        y0: Math.max(s.box.y0, u.y0 - 1),
        x1: Math.min(s.box.x1, u.x1 + 1),
        y1: Math.min(s.box.y1, u.y1 + 1),
      },
    });
  }

  // 2) gráfico vetorial: rótulos miúdos/curtos no enunciado
  if (info.boxes.length === 0) {
    for (const s of slices) {
      const frags = s.lines.filter(
        (l) =>
          stemSet.has(l) &&
          !l.bold &&
          ((body > 0 && l.size <= body - 1.4) || (l.text.length <= 4 && l.width < 30)),
      );
      if (frags.length >= 6 && FIGURE_CUE.test(stemText)) {
        const u = unionBox(
          frags.map((l) => ({
            x0: l.left,
            y0: l.top,
            x1: l.left + l.width,
            y1: l.top + l.height,
          })),
        );
        const box = {
          x0: s.box.x0,
          x1: s.box.x1,
          y0: Math.max(s.box.y0, u.y0 - 14),
          y1: Math.min(s.box.y1, u.y1 + 6),
        };
        info.boxes.push({ page: s.page, box });
        for (const l of s.lines) {
          if (stemSet.has(l) && l.top >= box.y0 && l.top + l.height <= box.y1) {
            info.droppedLines.add(l);
          }
        }
        info.warnings.push('figura vetorial recortada (rótulos removidos do texto)');
      }
    }
  }

  // 3) fórmulas
  const allText = [stemText, ...altTexts].join('\n');
  const sup = slices
    .flatMap((s) => s.lines)
    .filter((l) => !l.bold && body > 0 && l.size <= body - 2.5 && l.text.length <= 3).length;
  const mathy = MATH_GLYPHS.test(allText) || sup >= 2;
  const emptyAlt = altTexts.some((t) => !t.trim());
  if (mathy || emptyAlt) {
    info.boxes = whole();
    info.droppedLines = new Set();
    info.warnings.push(
      emptyAlt
        ? 'alternativa vazia: questão inteira anexada como imagem'
        : 'fórmula/símbolos: questão inteira anexada como imagem',
    );
    return info;
  }

  // 5) na dúvida
  if (
    info.boxes.length === 0 &&
    FIGURE_CUE.test(stemText.replace(/figuras? de (linguagem|palavra|pensamento|sintaxe)/gi, ''))
  ) {
    // recorta só a parte do enunciado (até a primeira alternativa), por trecho
    const stemBoxes: { page: number; box: Box }[] = [];
    for (const s of slices) {
      const lines = s.lines.filter((l) => stemSet.has(l));
      if (lines.length === 0) continue;
      const u = unionBox(
        lines.map((l) => ({ x0: l.left, y0: l.top, x1: l.left + l.width, y1: l.top + l.height })),
      );
      stemBoxes.push({
        page: s.page,
        box: { x0: s.box.x0, x1: s.box.x1, y0: Math.max(s.box.y0, u.y0 - 4), y1: u.y1 + 4 },
      });
    }
    info.boxes = stemBoxes;
    info.warnings.push('possível figura (recorte do enunciado, não detectada com certeza)');
  }
  return info;
}

export function renderCrops(file: string, boxes: { page: number; box: Box }[]): Buffer[] {
  return boxes.map((b) => cropPng(file, b.page, b.box));
}

/** Enunciado em Markdown a partir das linhas (sem as removidas por estarem na figura). */
export function stemMarkdown(
  stem: PdfLine[],
  dropped: Set<PdfLine>,
  opts: { softHyphen?: boolean } = {},
): string {
  return mdEscape(
    joinParagraphs(
      stem.filter((l) => !dropped.has(l)),
      opts,
    ),
  );
}

export interface BuiltQuestion {
  statement: string;
  alternatives: { letter: Letter; text: string }[];
  images: Buffer[];
  warnings: string[];
}

/** Monta enunciado, alternativas e figuras de uma questão a partir das linhas/trechos. */
export function buildQuestion(
  file: string,
  raw: { context: { line: PdfLine }[]; lines: { line: PdfLine }[]; slices: Slice[] },
  opts: { altRe: RegExp; expectedAlternatives: number; softHyphen?: boolean },
): BuiltQuestion {
  const qLines = normalizeGrid(
    raw.lines.map((f) => f.line),
    opts.altRe,
  );
  const split = splitAlternatives(qLines, opts.altRe, opts.expectedAlternatives);
  const stemLines = [...raw.context.map((f) => f.line), ...split.stem];
  // alternativa que é uma figura (rótulos de eixo etc.): o texto extraído seria lixo
  const figLike = (a: AlternativeLines) =>
    a.lines.filter((l) => l.text.replace(/\s/g, '').length <= 3).length >= 3;
  const alts = split.alts.map((a) => ({
    letter: a.letter,
    text: figLike(a) ? '' : altText(a, opts.altRe, opts),
  }));
  const warnings: string[] = [];
  if (alts.length !== opts.expectedAlternatives) {
    warnings.push(
      `${alts.length} alternativas encontradas (esperado ${opts.expectedAlternatives})`,
    );
  }
  const stemPlain = stemLines.map((l) => l.text).join(' ');
  const fig = detectFigures(
    raw.slices,
    { stem: stemLines, alts: split.alts },
    alts.map((a) => a.text),
    stemPlain,
  );
  warnings.push(...fig.warnings);
  const seen = new Set<string>();
  const boxes = fig.boxes.filter((b) => {
    const k = `${b.page}:${Math.round(b.box.x0)}:${Math.round(b.box.y0)}:${Math.round(b.box.y1)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return b.box.y1 - b.box.y0 > 8;
  });
  return {
    statement: stemMarkdown(stemLines, fig.droppedLines, opts),
    alternatives: alts,
    images: renderCrops(file, boxes),
    warnings,
  };
}

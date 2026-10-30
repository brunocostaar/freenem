import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Leitura de PDFs com coordenadas (poppler-utils): `pdftohtml -xml` entrega cada linha de texto com
 * posição, fonte, negrito e as imagens embutidas; `pdftoppm` recorta regiões da página em PNG.
 * Tudo em pontos (zoom 1 = 72 dpi), origem no canto superior esquerdo.
 */

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PdfLine {
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
  text: string;
  bold: boolean;
  /** tamanho da fonte em pt */
  size: number;
  /** cor da fonte (ex.: "#ffffff" para marcadores invisíveis) */
  color: string;
  /** primeiro trecho da linha (antes de mesclar) e se estava em negrito: detecta marcadores "02." */
  headText?: string;
  headBold?: boolean;
}

export interface PdfImage {
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PdfPage {
  number: number;
  width: number;
  height: number;
  lines: PdfLine[];
  images: PdfImage[];
  /** limites das colunas (preenchidos por `flowLines`; sem eles, meio da página) */
  col0Hi?: number;
  col1Lo?: number;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const attr = (s: string, name: string): string | undefined =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1];
const num = (s: string, name: string): number => Number(attr(s, name) ?? 0);

/** Converte o XML do `pdftohtml -xml` em páginas/linhas (função pura, testável com fixtures). */
export function parsePdfXml(xml: string): PdfPage[] {
  const pages: PdfPage[] = [];
  // os ids de fonte são globais ao documento (definidos na primeira página que os usa)
  const fonts = new Map<string, { size: number; color: string }>();
  const pageRe = /<page\b([^>]*)>([\s\S]*?)<\/page>/g;
  for (const pm of xml.matchAll(pageRe)) {
    const head = pm[1] ?? '';
    const body = pm[2] ?? '';
    const page: PdfPage = {
      number: num(head, 'number'),
      width: num(head, 'width'),
      height: num(head, 'height'),
      lines: [],
      images: [],
    };
    for (const fm of body.matchAll(/<fontspec\b([^>]*)\/>/g)) {
      const f = fm[1] ?? '';
      fonts.set(attr(f, 'id') ?? '', { size: num(f, 'size'), color: attr(f, 'color') ?? '#000000' });
    }
    for (const im of body.matchAll(/<image\b([^>]*)\/>/g)) {
      const a = im[1] ?? '';
      page.images.push({
        page: page.number,
        top: num(a, 'top'),
        left: num(a, 'left'),
        width: num(a, 'width'),
        height: num(a, 'height'),
      });
    }
    for (const tm of body.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const a = tm[1] ?? '';
      const inner = tm[2] ?? '';
      const text = decodeEntities(inner.replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const font = fonts.get(attr(a, 'font') ?? '');
      page.lines.push({
        page: page.number,
        top: num(a, 'top'),
        left: num(a, 'left'),
        width: num(a, 'width'),
        height: num(a, 'height'),
        text,
        bold: /^\s*<b>[\s\S]*<\/b>\s*$/.test(inner),
        size: font?.size ?? 0,
        color: font?.color ?? '#000000',
      });
    }
    pages.push(page);
  }
  return pages;
}

/** Lê o PDF inteiro (texto + imagens embutidas) via `pdftohtml -xml`. */
export function readPdf(file: string): PdfPage[] {
  const dir = mkdtempSync(path.join(tmpdir(), 'freenem-pdf-'));
  try {
    execFileSync('pdftohtml', ['-xml', '-zoom', '1', '-q', file, path.join(dir, 'out')], {
      stdio: ['ignore', 'ignore', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    });
    return parsePdfXml(readFileSync(path.join(dir, 'out.xml'), 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Recorta uma região da página (em pt) como PNG. */
export function cropPng(file: string, page: number, box: Box, dpi = 130): Buffer {
  const dir = mkdtempSync(path.join(tmpdir(), 'freenem-crop-'));
  try {
    const k = dpi / 72;
    const x = Math.max(0, Math.floor(box.x0 * k));
    const y = Math.max(0, Math.floor(box.y0 * k));
    const w = Math.max(1, Math.ceil((box.x1 - box.x0) * k));
    const h = Math.max(1, Math.ceil((box.y1 - box.y0) * k));
    execFileSync(
      'pdftoppm',
      [
        ...['-png', '-r', String(dpi), '-f', String(page), '-l', String(page)],
        ...['-x', String(x), '-y', String(y), '-W', String(w), '-H', String(h), '-singlefile'],
        file,
        path.join(dir, 'crop'),
      ],
      { stdio: ['ignore', 'ignore', 'ignore'] },
    );
    return readFileSync(path.join(dir, 'crop.png'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Mescla elementos de texto na mesma linha visual (mesmo `top` ±tol), ordenados por `left`.
 * Elementos que casam `splitBefore` (ex.: "c) texto" numa grade 2x2 de alternativas) começam uma
 * linha nova em vez de se colar ao elemento anterior.
 */
export function mergeRows(lines: PdfLine[], tol = 3, splitBefore?: RegExp): PdfLine[] {
  const sorted = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  // 1) agrupa por proximidade vertical (trechos em negrito costumam ter `top` 1px diferente)
  const clusters: PdfLine[][] = [];
  for (const l of sorted) {
    const c = clusters[clusters.length - 1];
    if (c && Math.abs(c[0]!.top - l.top) <= tol) c.push(l);
    else clusters.push([l]);
  }
  // 2) dentro de cada grupo, da esquerda para a direita, cola o que continua a linha
  const rows: PdfLine[][] = [];
  for (const c of clusters) {
    const local: PdfLine[][] = [];
    for (const l of [...c].sort((a, b) => a.left - b.left)) {
      const fits = splitBefore?.test(l.text)
        ? undefined
        : local
            .map((r) => ({ r, right: Math.max(...r.map((x) => x.left + x.width)) }))
            .filter((x) => x.right <= l.left + 6)
            .sort((a, b) => b.right - a.right)[0];
      if (fits) fits.r.push(l);
      else local.push([l]);
    }
    rows.push(...local);
  }
  return rows.map((r) => {
    r.sort((a, b) => a.left - b.left);
    const first = { ...r[0]!, headText: r[0]!.text, headBold: r[0]!.bold };
    if (r.length === 1) return first;
    const right = Math.max(...r.map((x) => x.left + x.width));
    return {
      ...first,
      text: r.map((x) => x.text).join(' '),
      width: right - first.left,
      height: Math.max(...r.map((x) => x.height)),
      bold: r.every((x) => x.bold),
      size: Math.max(...r.map((x) => x.size)),
    };
  });
}

/**
 * Junta linhas em parágrafos: quebra de linha simples vira espaço; lacuna vertical grande vira
 * parágrafo novo. `joinHyphen` trata a hifenização do PDF (Unicamp: "es-\n-sencial").
 */
export function joinParagraphs(lines: PdfLine[], opts: { softHyphen?: boolean } = {}): string {
  let out = '';
  let prev: PdfLine | undefined;
  for (const l of lines) {
    if (!prev) {
      out = l.text;
    } else {
      const gap = l.page !== prev.page ? 99 : l.top - (prev.top + prev.height);
      const para = gap > Math.max(prev.height, l.height) * 0.9;
      if (para) out += `\n\n${l.text}`;
      else if (opts.softHyphen && /[A-Za-zÀ-ú]-$/.test(out) && /^-/.test(l.text)) {
        out += l.text.slice(1); // "tem-" + "-se" => "tem-se"
      } else if (opts.softHyphen && /[A-Za-zÀ-ú]-$/.test(out) && /^[a-zà-ú]/.test(l.text)) {
        out = out.slice(0, -1) + l.text; // "essencial-" + "mente" => "essencialmente"
      } else out += ` ${l.text}`;
    }
    prev = l;
  }
  return out.trim();
}

/** Escapa caracteres que o Markdown/KaTeX do site interpretaria (texto de prova é texto puro). */
export function mdEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/(^|\n)([#>+-]) /g, '$1\\$2 ')
    .replace(/(^|\n)(\d+)\. /g, '$1$2\\. ')
    .replace(/`/g, '\\`')
    .replace(/­/g, '');
}

export function unionBox(boxes: Box[]): Box {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

import type { Box, PdfImage, PdfLine, PdfPage } from './layout.js';
import { mergeRows } from './layout.js';
import type { Slice } from './question.js';

/**
 * Ordem de leitura de provas em duas colunas: linhas que cruzam o meio da página (largura total)
 * dividem a página em "faixas"; dentro de cada faixa lê-se a coluna esquerda e depois a direita.
 */
export interface FlowLine {
  line: PdfLine;
  /** 0 = esquerda, 1 = direita, 2 = largura total */
  col: 0 | 1 | 2;
  band: number;
  /** ordem global de leitura */
  seq: number;
}

export interface FlowOptions {
  topMargin: number;
  bottomMargin: number;
  /** descarta cabeçalhos, rodapés, números de página e marcadores invisíveis */
  isJunk?: (l: PdfLine, page: PdfPage) => boolean;
  /** elementos que iniciam linha nova (marcadores de alternativa em grade) */
  splitBefore?: RegExp;
  /** marcador de alternativa (padrão "(A)"), para detectar tabelas de alternativas */
  altMarker?: RegExp;
  /** UFRGS: alternativas em tabela (células separadas por "–") cruzando as duas colunas */
  detectTables?: boolean;
}

/**
 * Onde começa o TEXTO da coluna da direita: a posição `left` mais comum na metade direita da
 * página (números de questão podem ficar ~20pt à esquerda, "pendurados"). Colunas justificadas e
 * coladas não deixam uma "calha" vazia para detectar.
 */
export function rightTextStart(els: PdfLine[], width: number): number | null {
  const counts = new Map<number, number>();
  for (const l of els) {
    if (l.left < width * 0.5 || l.left > width * 0.7 || l.width > width * 0.6) continue;
    const k = Math.round(l.left);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    const total = n + (counts.get(k + 1) ?? 0) + (counts.get(k - 1) ?? 0);
    if (total > bestN) {
      best = k;
      bestN = total;
    }
  }
  return bestN >= 8 ? best : null;
}

/** Limites horizontais das colunas de uma página (coluna da esquerda / direita). */
export function colBounds(p: PdfPage): { col0Hi: number; col1Lo: number } {
  return { col0Hi: p.col0Hi ?? p.width / 2, col1Lo: p.col1Lo ?? p.width / 2 };
}

export function flowLines(pages: PdfPage[], opts: FlowOptions): FlowLine[] {
  const out: FlowLine[] = [];
  let seq = 0;
  const kept = (page: PdfPage) =>
    page.lines.filter(
      (l) =>
        l.color.toLowerCase() !== '#ffffff' &&
        l.top >= opts.topMargin &&
        l.top + l.height <= page.height - opts.bottomMargin &&
        !opts.isJunk?.(l, page),
    );
  // largura "normal" das páginas (a capa pode ter outro tamanho)
  const widths = pages.map((p) => Math.round(p.width)).sort((a, b) => a - b);
  const normal = widths[Math.floor(widths.length / 2)] ?? 595;
  const isNormal = (p: PdfPage) => Math.abs(p.width - normal) <= 3;
  const rts = rightTextStart(
    pages.filter(isNormal).flatMap((p) => kept(p)),
    normal,
  );
  const altMarker = opts.altMarker ?? /^\(([A-E])\)/;
  for (const page of pages) {
    const els = kept(page);
    const twoCols = rts !== null && isNormal(page);
    const half = page.width * 0.5;
    const rightEls = els.filter((l) => l.left >= half && l.width < page.width * 0.6);
    page.col1Lo = twoCols
      ? Math.min(half + 10, ...rightEls.map((l) => l.left), rts!) - 2
      : undefined;
    page.col0Hi = twoCols ? rts! - 4 : undefined;
    const isRight = (l: PdfLine) => l.left >= half;
    // linhas "cruzadas": largura total, ou tabela de alternativas (3+ células cruzando as colunas)
    const rowOf = (l: PdfLine) => els.filter((o) => Math.abs(o.top - l.top) <= 3);
    const crossing = new Set<PdfLine>();
    if (twoCols) {
      for (const l of els) {
        if (l.left < half - 10 && l.left + l.width > rts! + 4) {
          rowOf(l).forEach((o) => crossing.add(o));
          continue;
        }
        // só elementos largos contam (sobrescritos/fragmentos de fórmula criam falsos "vãos")
        const row = rowOf(l)
          .filter((o) => o.width >= 30)
          .sort((a, b) => a.left - b.left);
        if (!opts.detectTables || row[0] !== l || !altMarker.test(l.text)) continue;
        let gaps = 0;
        for (let i = 1; i < row.length; i++) {
          if (row[i]!.left - (row[i - 1]!.left + row[i - 1]!.width) >= 8) gaps++;
        }
        const leftEnd = Math.max(...row.filter((o) => !isRight(o)).map((o) => o.left + o.width));
        const rightStart = Math.min(...row.filter(isRight).map((o) => o.left));
        // células coladas (vão de poucos pt) cruzando as colunas = tabela; senão são duas colunas
        if (gaps >= 2 && rightStart - leftEnd <= 24 && rightStart >= leftEnd - 2) {
          rowOf(l).forEach((o) => crossing.add(o));
        }
      }
      // linhas de alternativa vizinhas de uma linha cruzada também são tabela
      let changed = !!opts.detectTables;
      while (changed) {
        changed = false;
        for (const l of els) {
          if (crossing.has(l) || !altMarker.test(l.text) || isRight(l)) continue;
          const near = els.some(
            (o) => crossing.has(o) && o.left < half - 10 && Math.abs(o.top - l.top) <= 16,
          );
          if (near && els.some((o) => isRight(o) && Math.abs(o.top - l.top) <= 3)) {
            rowOf(l).forEach((o) => crossing.add(o));
            changed = true;
          }
        }
      }
    }
    const colOf = (l: PdfLine): 0 | 1 | 2 => (crossing.has(l) ? 2 : isRight(l) && twoCols ? 1 : 0);
    const groups: [0 | 1 | 2, PdfLine[]][] = [
      [0, els.filter((l) => colOf(l) === 0)],
      [1, els.filter((l) => colOf(l) === 1)],
      [2, els.filter((l) => colOf(l) === 2)],
    ];
    const merged: { l: PdfLine; col: 0 | 1 | 2 }[] = [];
    for (const [col, g] of groups) {
      for (const l of mergeRows(g, 3, opts.splitBefore)) merged.push({ l, col });
    }
    const fulls = merged.filter((m) => m.col === 2).sort((a, b) => a.l.top - b.l.top);
    const bandOf = (m: { l: PdfLine; col: 0 | 1 | 2 }): number => {
      if (m.col === 2) return fulls.indexOf(m) * 2 + 1;
      return fulls.filter((f) => f.l.top + f.l.height <= m.l.top + 2).length * 2;
    };
    const rows = merged.map((m) => ({ ...m, band: bandOf(m) }));
    rows.sort((a, b) => a.band - b.band || a.col - b.col || a.l.top - b.l.top);
    for (const r of rows) out.push({ line: r.l, col: r.col, band: r.band, seq: seq++ });
  }
  return out;
}

export interface MarkerHit {
  number: number;
  /** texto que sobra na linha depois do marcador (ex.: início do enunciado) */
  rest: string;
}

export interface FlowSpec {
  /** detecta o início de uma questão */
  questionStart(f: FlowLine): MarkerHit | null;
  /** detecta o início de um texto-base compartilhado e devolve os números das questões que o usam */
  preambleStart?(f: FlowLine): number[] | null;
  /** aceita o número `n` dado o último número visto (padrão: n > last && n <= last + 3) */
  accept?(n: number, last: number): boolean;
}

export interface Block {
  kind: 'q' | 'ctx';
  /** linha do marcador (fica fora do texto, mas entra no recorte) */
  marker?: FlowLine;
  number?: number;
  from?: number;
  to?: number;
  lines: FlowLine[];
}

export interface RawQuestion {
  number: number;
  /** página do marcador da questão */
  page: number;
  /** linhas do texto-base compartilhado (se houver) */
  context: FlowLine[];
  lines: FlowLine[];
  slices: Slice[];
}

function sliceOf(
  flows: FlowLine[],
  pages: Map<number, PdfPage>,
  images: PdfImage[],
  marker?: FlowLine,
): Slice[] {
  const keys = new Map<string, FlowLine[]>();
  for (const f of marker ? [marker, ...flows] : flows) {
    const k = `${f.line.page}|${f.band}|${f.col}`;
    keys.set(k, [...(keys.get(k) ?? []), f]);
  }
  const slices: Slice[] = [];
  for (const [k, fs] of keys) {
    const [pageNo, , colS] = k.split('|').map(Number) as [number, number, number];
    const page = pages.get(pageNo)!;
    const cb = colBounds(page);
    const lo = colS === 1 ? cb.col1Lo : 0;
    const hi = colS === 0 ? cb.col0Hi : page.width;
    const own = images.filter((i) => i.page === pageNo);
    const x0 = Math.max(lo, Math.min(...fs.map((f) => f.line.left)) - 6);
    const x1 = Math.min(hi, Math.max(...fs.map((f) => f.line.left + f.line.width)) + 6);
    let box: Box = {
      x0,
      x1,
      y0: Math.min(...fs.map((f) => f.line.top)) - 3,
      y1: Math.max(...fs.map((f) => f.line.top + f.line.height)) + 3,
    };
    const mine = own.filter((i) => {
      const cx = i.left + i.width / 2;
      return cx >= lo && cx <= hi;
    });
    for (const i of mine) {
      box = {
        x0: Math.min(box.x0, Math.max(lo, i.left - 2)),
        x1: Math.max(box.x1, Math.min(hi, i.left + i.width + 2)),
        y0: Math.min(box.y0, i.top - 2),
        y1: Math.max(box.y1, i.top + i.height + 2),
      };
    }
    slices.push({
      page: pageNo,
      box,
      lines: fs.filter((f) => f !== marker).map((f) => f.line),
      images: mine,
    });
  }
  return slices.sort((a, b) => a.page - b.page || a.box.y0 - b.box.y0);
}

/** Atribui cada imagem ao bloco da linha de texto mais próxima acima dela na mesma coluna. */
function ownerOfImages(
  pages: PdfPage[],
  flows: FlowLine[],
  blockOf: Map<FlowLine, Block>,
): Map<Block, PdfImage[]> {
  const res = new Map<Block, PdfImage[]>();
  for (const page of pages) {
    const cb = colBounds(page);
    const here = flows.filter((f) => f.line.page === page.number && blockOf.has(f));
    for (const img of page.images) {
      if (img.width * img.height < 900) continue;
      const cx = img.left + img.width / 2;
      const spans =
        page.col1Lo !== undefined &&
        img.left < page.width * 0.5 - 10 &&
        img.left + img.width > cb.col0Hi + 8;
      const same = here.filter(
        (f) => spans || f.col === 2 || f.col === (cx < page.width * 0.5 ? 0 : 1),
      );
      const cy = img.top + img.height / 2;
      const above = same
        .filter((f) => f.line.top + f.line.height <= cy + 2)
        .sort((a, b) => b.line.top - a.line.top)[0];
      const below = same.filter((f) => f.line.top > cy).sort((a, b) => a.line.top - b.line.top)[0];
      const pick = above ?? below;
      const block = pick ? blockOf.get(pick) : undefined;
      if (block) res.set(block, [...(res.get(block) ?? []), img]);
    }
  }
  return res;
}

export function assembleQuestions(
  pages: PdfPage[],
  flows: FlowLine[],
  spec: FlowSpec,
): RawQuestion[] {
  const accept = spec.accept ?? ((n: number, last: number) => n > last && n <= last + 3);
  const blocks: Block[] = [];
  const blockOf = new Map<FlowLine, Block>();
  let cur: Block | undefined;
  let last = 0;
  for (const f of flows) {
    const hit = spec.questionStart(f);
    if (hit && accept(hit.number, last)) {
      last = hit.number;
      cur = { kind: 'q', number: hit.number, marker: f, lines: [] };
      blocks.push(cur);
      if (hit.rest) {
        const l = { ...f.line, text: hit.rest };
        const nf = { ...f, line: l };
        cur.lines.push(nf);
        blockOf.set(nf, cur);
      }
      // o marcador em si fica de fora do texto, mas ancora a posição
      continue;
    }
    const pre = spec.preambleStart?.(f);
    if (pre && pre.length) {
      cur = { kind: 'ctx', from: Math.min(...pre), to: Math.max(...pre), lines: [] };
      blocks.push(cur);
    }
    if (!cur) continue;
    cur.lines.push(f);
    blockOf.set(f, cur);
  }

  const images = ownerOfImages(pages, flows, blockOf);
  const pageMap = new Map(pages.map((p) => [p.number, p]));
  const ctxBlocks = blocks.filter((b) => b.kind === 'ctx');
  const out: RawQuestion[] = [];
  for (const b of blocks) {
    if (b.kind !== 'q' || b.number === undefined) continue;
    const ctxs = ctxBlocks.filter((c) => c.from! <= b.number! && b.number! <= c.to!);
    const ctxLines = ctxs.flatMap((c) => c.lines);
    const slices = [
      ...ctxs.flatMap((c) => sliceOf(c.lines, pageMap, images.get(c) ?? [])),
      ...sliceOf(b.lines, pageMap, images.get(b) ?? [], b.marker),
    ];
    out.push({
      number: b.number,
      page: b.marker?.line.page ?? 0,
      context: ctxLines,
      lines: b.lines,
      slices,
    });
  }
  return out;
}

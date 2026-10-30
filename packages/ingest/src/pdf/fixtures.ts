/**
 * Geradores de XML no formato do `pdftohtml -xml` para os testes dos parsers de vestibular
 * (trechos pequenos, sem PDFs reais). Coordenadas em pt, página A4 (595 x 842).
 */
export interface T {
  top: number;
  left: number;
  width?: number;
  text: string;
  bold?: boolean;
  /** 0 normal, 1 negrito grande, 2 branco (marcador invisível) */
  font?: 0 | 1 | 2;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function pageXml(
  number: number,
  texts: T[],
  images: [number, number, number, number][] = [],
) {
  const fonts =
    number === 1
      ? `<fontspec id="0" size="10" family="X+Calibri" color="#000000"/>
<fontspec id="1" size="13" family="X+Arial-Black" color="#000000"/>
<fontspec id="2" size="8" family="X+Arial" color="#ffffff"/>`
      : '';
  const body = texts
    .map((t) => {
      const font = t.font ?? (t.bold ? 1 : 0);
      const inner = t.bold ? `<b>${esc(t.text)}</b>` : esc(t.text);
      return `<text top="${t.top}" left="${t.left}" width="${t.width ?? Math.max(4, t.text.length * 5)}" height="10" font="${font}">${inner}</text>`;
    })
    .join('\n');
  const imgs = images
    .map(
      ([top, left, w, h]) =>
        `<image top="${top}" left="${left}" width="${w}" height="${h}" src="x.png"/>`,
    )
    .join('\n');
  return `<page number="${number}" position="absolute" top="0" left="0" height="842" width="595">\n${fonts}\n${imgs}\n${body}\n</page>`;
}

export const pdfXml = (pages: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<pdf2xml producer="poppler" version="26">\n${pages.join('\n')}\n</pdf2xml>`;

/** Linhas de texto consecutivas numa coluna (`left` 34 = esquerda, 312 = direita). */
export function col(left: number, top: number, texts: string[], step = 12, width = 250): T[] {
  return texts.map((text, i) => ({ top: top + i * step, left, width, text }));
}

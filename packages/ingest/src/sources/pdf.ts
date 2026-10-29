import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../db.js';
import type { ExtractedQuestion, Letter } from '../index.js';

/** Baixa um PDF para o cache (ou usa um arquivo local) e devolve o caminho. */
export async function fetchPdf(urlOrPath: string, name: string): Promise<string> {
  if (!/^https?:\/\//.test(urlOrPath)) {
    if (!existsSync(urlOrPath)) throw new Error(`Arquivo não encontrado: ${urlOrPath}`);
    return urlOrPath;
  }
  const dest = path.join(CACHE_DIR, 'pdf', name);
  if (existsSync(dest)) return dest;
  const res = await fetch(urlOrPath, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Falha ao baixar ${urlOrPath}: HTTP ${res.status}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Texto do PDF com `pdftotext -layout` (poppler-utils). */
export function pdfToText(file: string): string {
  return execFileSync('pdftotext', ['-layout', file, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Parser "melhor esforço": separa o texto por marcadores de questão e extrai as alternativas
 * `(A) ... (E)`. Provas com duas colunas ou figuras exigem revisão humana, por isso tudo que
 * sai daqui é importado como rascunho.
 */
export function parseQuestions(
  text: string,
  marker: RegExp = /^\s*(?:QUEST[ÃA]O\s+)?0?(\d{1,2})\s*[.)\-–]?\s*$|^\s*QUEST[ÃA]O\s+0?(\d{1,2})\b/gim,
): ExtractedQuestion[] {
  const found: { number: number; start: number; end: number }[] = [];
  for (const m of text.matchAll(marker)) {
    const n = Number(m[1] ?? m[2]);
    if (n >= 1 && n <= 120) found.push({ number: n, start: m.index, end: m.index + m[0].length });
  }
  const out: ExtractedQuestion[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < found.length; i++) {
    const cur = found[i]!;
    if (seen.has(cur.number)) continue;
    const body = text.slice(cur.end, found[i + 1]?.start ?? text.length);
    const altRe = /^\s*\(([A-E])\)\s*([\s\S]*?)(?=^\s*\([A-E]\)|\s*$(?![\s\S]))/gm;
    const alts: { letter: Letter; text: string }[] = [];
    let firstAlt = body.length;
    for (const a of body.matchAll(altRe)) {
      firstAlt = Math.min(firstAlt, a.index);
      alts.push({ letter: a[1] as Letter, text: a[2]!.replace(/\s+/g, ' ').trim() });
    }
    if (alts.length < 2) continue;
    seen.add(cur.number);
    out.push({
      number: cur.number,
      statement: body
        .slice(0, firstAlt)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
      alternatives: alts,
    });
  }
  return out;
}

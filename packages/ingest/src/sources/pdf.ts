import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from '../paths.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) freenem-ingest (+https://github.com/freenem)';

/** Baixa um arquivo para `.cache/pdf` (ou usa um arquivo local) e devolve o caminho. */
export async function fetchPdf(urlOrPath: string, name: string): Promise<string> {
  if (!/^https?:\/\//.test(urlOrPath)) {
    if (!existsSync(urlOrPath)) throw new Error(`Arquivo não encontrado: ${urlOrPath}`);
    return urlOrPath;
  }
  const dest = path.join(CACHE_DIR, 'pdf', name);
  if (existsSync(dest)) return dest;
  const res = await fetch(urlOrPath, { redirect: 'follow', headers: { 'user-agent': UA } });
  if (!res.ok) {
    throw new Error(
      `Falha ao baixar ${urlOrPath}: HTTP ${res.status}. Baixe o arquivo manualmente e use --pdf <arquivo> (veja HUMAN_TODO.md).`,
    );
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Baixa uma página HTML (gabaritos do UFRGS) ou lê um arquivo local. */
export async function fetchText(urlOrPath: string): Promise<string> {
  if (!/^https?:\/\//.test(urlOrPath)) return readFile(urlOrPath, 'utf8');
  const res = await fetch(urlOrPath, { redirect: 'follow', headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Falha ao baixar ${urlOrPath}: HTTP ${res.status}`);
  return res.text();
}

/** Texto do PDF com `pdftotext -layout` (poppler-utils): usado nas tabelas de gabarito. */
export function pdfToText(file: string): string {
  return execFileSync('pdftotext', ['-layout', file, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

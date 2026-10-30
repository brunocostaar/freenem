/**
 * Checagens de qualidade de uma questão importada. Função pura (sem banco), usada pelo importador
 * (problemas viram `draft`) e pelo relatório `quality:report` (que também rebaixa publicadas).
 */

export interface QualityInput {
  statement: string;
  imageUrls: string[];
  alternatives: { letter: string; text: string; imageUrl: string | null; isCorrect: boolean }[];
}

export type IssueCode =
  | 'statement_short'
  | 'statement_empty'
  | 'alternatives_count'
  | 'alternative_empty'
  | 'alternatives_duplicated'
  | 'no_correct'
  | 'multiple_correct'
  | 'broken_image'
  | 'unbalanced_latex'
  | 'markdown_artifact';

export interface Issue {
  code: IssueCode;
  detail: string;
}

/** Enunciado (sem imagens) menor que isto, sem imagem na questão, é suspeito de truncado. */
export const MIN_STATEMENT_CHARS = 60;

/**
 * O dataset só usa `$` para moeda (R$, US$). Sem escapar, o remark-math casaria pares de `$` no
 * texto ("R$ 1,50 ... R$ 1,48") e renderizaria o trecho como fórmula. Fórmulas reais vêm dos
 * arquivos `.latex` e são adicionadas depois, já delimitadas.
 */
export const escapeDollars = (s: string) => s.replace(/(?<!\\)\$/g, '\\$');

const IMAGE_MD = /!\[[^\]]*\]\([^)]*\)/g;

/** Texto "de verdade": sem imagens Markdown nem espaços repetidos. */
function plain(md: string): string {
  return md.replace(IMAGE_MD, '').replace(/\s+/g, ' ').trim();
}

/** `$` não escapados, ignorando `$$` (par de bloco). Ímpar = fórmula aberta e não fechada. */
export function hasUnbalancedLatex(md: string): boolean {
  const noEscaped = md.replace(/\\\$/g, '').replace(/\$\$/g, '');
  const count = (noEscaped.match(/\$/g) ?? []).length;
  if (count % 2 !== 0) return true;
  return (md.match(/\$\$/g) ?? []).length % 2 !== 0;
}

const ARTIFACTS: [RegExp, string][] = [
  [/broken-image/i, 'referência a broken-image'],
  [/\bundefined\b|\[object Object\]|\bNaN\b/, 'valor "undefined/NaN/[object Object]"'],
  [/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#\d+;/, 'entidade HTML'],
  [/<\/?(?:img|table|p|center|font)\b[^>]*>/i, 'tag HTML'],
  [/\\n|\\t/, 'sequência \\n literal'],
  [/!\[[^\]]*\]\((?!storage:\/\/|https?:\/\/|data:)[^)]*\)/, 'imagem com URL inválida'],
  [/!\[[^\]]*\]\(\s*\)/, 'imagem sem URL'],
  [/\]\(\s*\)|\[\]\(/, 'link Markdown vazio'],
];

/** Número ímpar de `**` (negrito aberto e não fechado), fora de blocos de fórmula. */
function oddBold(md: string): boolean {
  const noMath = md.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$\n]*\$/g, '');
  return (noMath.match(/\*\*/g) ?? []).length % 2 !== 0;
}

export function checkQuality(
  q: QualityInput,
  opts: { imageMissing?: (ref: string) => boolean } = {},
): Issue[] {
  const issues: Issue[] = [];
  const add = (code: IssueCode, detail: string) => issues.push({ code, detail });

  const body = plain(q.statement);
  const hasImage =
    q.imageUrls.length > 0 ||
    IMAGE_MD.test(q.statement) ||
    q.alternatives.some((a) => Boolean(a.imageUrl));

  if (!q.statement.trim()) add('statement_empty', 'enunciado vazio');
  else if (body.length < MIN_STATEMENT_CHARS && !hasImage) {
    add('statement_short', `enunciado com ${body.length} caracteres e sem imagem`);
  }

  if (q.alternatives.length !== 5)
    add('alternatives_count', `${q.alternatives.length} alternativas`);
  const empty = q.alternatives.filter((a) => !a.text.trim() && !a.imageUrl).map((a) => a.letter);
  if (empty.length) add('alternative_empty', `alternativas vazias: ${empty.join(',')}`);

  const seen = new Map<string, string>();
  const dup: string[] = [];
  for (const a of q.alternatives) {
    const norm = a.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!norm) continue;
    const prev = seen.get(norm);
    if (prev) dup.push(`${prev}=${a.letter}`);
    else seen.set(norm, a.letter);
  }
  if (dup.length) add('alternatives_duplicated', `alternativas iguais: ${dup.join(', ')}`);

  const correct = q.alternatives.filter((a) => a.isCorrect).length;
  if (correct === 0) add('no_correct', 'sem alternativa correta');
  else if (correct > 1) add('multiple_correct', `${correct} alternativas corretas`);

  const refs = [...q.imageUrls, ...q.alternatives.flatMap((a) => (a.imageUrl ? [a.imageUrl] : []))];
  for (const m of q.statement.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) refs.push(m[1] ?? '');
  const broken = refs.filter((r) => /broken-image/i.test(r) || opts.imageMissing?.(r));
  if (broken.length) add('broken_image', `${broken.length} imagem(ns) quebrada(s)/ausente(s)`);

  const texts = [
    ['enunciado', q.statement] as const,
    ...q.alternatives.map((a) => [`alternativa ${a.letter}`, a.text] as const),
  ];
  const latex = texts.filter(([, t]) => hasUnbalancedLatex(t)).map(([w]) => w);
  if (latex.length) add('unbalanced_latex', `$ desbalanceado em: ${latex.join(', ')}`);

  const arts = new Set<string>();
  for (const [where, t] of texts) {
    for (const [re, label] of ARTIFACTS) if (re.test(t)) arts.add(`${label} (${where})`);
    if (oddBold(t)) arts.add(`negrito "**" não fechado (${where})`);
  }
  if (arts.size) add('markdown_artifact', [...arts].join('; '));

  return issues;
}

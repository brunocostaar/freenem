/**
 * Benchmark do corretor de redação contra notas humanas (dataset Essay-BR, CSV fora do git).
 *
 * Uso: pnpm --filter @freenem/api essay:bench -- --csv <testing.csv> --prompts <prompts.csv> \
 *        [--n 120] [--seed 42] [--temp 0.2] [--out resultado.json] [--label nome]
 * Env equivalentes: ESSAY_BENCH_CSV, ESSAY_BENCH_PROMPTS, ESSAY_BENCH_OUT. Requer DEEPSEEK_API_KEY.
 *
 * Usa o MESMO pipeline de produção (sanitização, heurística de injeção, prompt, validação Zod).
 * O dataset é de uso interno: nunca o copie para o repositório nem para o prompt.
 * O Essay-BR não traz o enunciado do tema, só os textos motivadores: o tema é inferido uma vez
 * por prompt pelo próprio modelo e guardado em cache ao lado do arquivo de saída.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { COMPETENCY_KEYS } from '@freenem/shared';
import { DeepSeekCorrector } from '../src/modules/essays/deepseek.js';
import { runCorrectionPipeline } from '../src/modules/essays/pipeline.js';

const CONCURRENCY = 4;
const LEVELS = [0, 40, 80, 120, 160, 200];

/* ---------- CSV (RFC 4180 simples) ---------- */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function readTable(path: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(readFileSync(path, 'utf8'));
  if (!header) throw new Error(`CSV vazio: ${path}`);
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/** Listas Python do dataset: ['a', "b"] -> string[] (aspas simples ou duplas). */
function parsePyStrings(s: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/gs;
  for (const m of s.matchAll(re)) {
    out.push((m[1] ?? m[2] ?? '').replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n'));
  }
  return out;
}

/* ---------- RNG com seed fixa ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- métricas ---------- */
export function qwk(a: number[], b: number[], classes: number[]): number {
  const k = classes.length;
  const idx = new Map(classes.map((c, i) => [c, i]));
  const O = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const n = a.length;
  a.forEach((x, i) => {
    O[idx.get(x)!]![idx.get(b[i]!)!]! += 1;
  });
  const ha = new Array<number>(k).fill(0);
  const hb = new Array<number>(k).fill(0);
  for (let i = 0; i < k; i++)
    for (let j = 0; j < k; j++) {
      ha[i]! += O[i]![j]!;
      hb[j]! += O[i]![j]!;
    }
  let num = 0;
  let den = 0;
  for (let i = 0; i < k; i++)
    for (let j = 0; j < k; j++) {
      const w = ((i - j) / (k - 1)) ** 2;
      num += w * O[i]![j]!;
      den += (w * ha[i]! * hb[j]!) / n;
    }
  return den === 0 ? 0 : 1 - num / den;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

function stats(human: number[], model: number[], classes: number[]) {
  const diff = model.map((m, i) => m - human[i]!);
  return {
    qwk: qwk(human, model, classes),
    mae: mean(diff.map(Math.abs)),
    bias: mean(diff),
  };
}

const TOTAL_BINS = [0, 200, 400, 520, 640, 760, 880, 1001];
const binOf = (v: number) => TOTAL_BINS.findIndex((lo, i) => v >= lo && v < TOTAL_BINS[i + 1]!);
const binLabel = (i: number) => `${TOTAL_BINS[i]}-${Math.min(TOTAL_BINS[i + 1]! - 1, 1000)}`;

/* ---------- DeepSeek auxiliar (tema inferido) ---------- */
async function inferTheme(
  apiKey: string,
  model: string,
  motivators: string[],
): Promise<{ theme: string; tokens: [number, number] }> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 100,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `Os textos motivadores abaixo pertencem a uma proposta de redação no estilo ENEM. Escreva, em UMA frase (até 20 palavras), o tema/problema a ser discutido, no formato de título de proposta (ex.: "Desafios para ... no Brasil"). Responda só com a frase.\n\n${motivators.join('\n\n').slice(0, 6000)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const theme = (body.choices?.[0]?.message?.content ?? '').trim().replace(/^["“]|["”]$/g, '');
  return {
    theme: theme || 'Tema não identificado',
    tokens: [body.usage?.prompt_tokens ?? 0, body.usage?.completion_tokens ?? 0],
  };
}

/** `description` pode ser lista Python de parágrafos ou texto corrido. */
function motivatorsOf(desc: string): string[] {
  const list = desc.trimStart().startsWith('[') ? parsePyStrings(desc) : [];
  return list.length ? list : [desc];
}

async function pool<T>(items: T[], limit: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i]!, i);
      }
    }),
  );
}

/* ---------- main ---------- */
interface Sample {
  id: number;
  prompt: string;
  human: number[]; // c1..c5
  humanTotal: number;
  text: string;
}

interface Result {
  id: number;
  prompt: string;
  theme: string;
  human: number[];
  humanTotal: number;
  model: number[] | null;
  modelTotal: number | null;
  status: 'ok' | 'flagged' | 'heuristic' | 'invalid' | 'error';
  zeroReason?: string | null;
}

async function main() {
  const { values } = parseArgs({
    options: {
      csv: { type: 'string' },
      prompts: { type: 'string' },
      n: { type: 'string', default: '120' },
      seed: { type: 'string', default: '42' },
      temp: { type: 'string', default: '0.2' },
      out: { type: 'string' },
      label: { type: 'string', default: 'run' },
    },
  });
  const csvPath = values.csv ?? process.env.ESSAY_BENCH_CSV;
  const promptsPath = values.prompts ?? process.env.ESSAY_BENCH_PROMPTS;
  const outPath = values.out ?? process.env.ESSAY_BENCH_OUT ?? `essay-bench-${values.label}.json`;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  if (!csvPath || !promptsPath) throw new Error('Informe --csv e --prompts (ou as envs).');
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY ausente.');
  const n = Number(values.n);
  const temp = Number(values.temp);

  // Amostra estratificada (mesma por seed): iguala o nº por faixa de nota, sorteando dentro dela.
  const rows = readTable(csvPath);
  const all: Sample[] = rows.flatMap((r, id) => {
    const human = (r.competence ?? '').match(/\d+/g)?.map(Number) ?? [];
    const text = parsePyStrings(r.essay ?? '').join('\n\n');
    if (human.length !== 5 || !text) return [];
    return [
      { id, prompt: r.prompt ?? '', human, humanTotal: human.reduce((a, b) => a + b, 0), text },
    ];
  });
  const rand = mulberry32(Number(values.seed));
  const bins = new Map<number, Sample[]>();
  for (const s of all) bins.set(binOf(s.humanTotal), [...(bins.get(binOf(s.humanTotal)) ?? []), s]);
  for (const list of bins.values())
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
  const lists = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  const sample: Sample[] = [];
  for (let round = 0; sample.length < n && lists.some((l) => l.length > round); round++)
    for (const l of lists) if (sample.length < n && l[round]) sample.push(l[round]!);
  sample.sort((a, b) => a.id - b.id);
  console.log(`[bench] ${label()}: ${sample.length} redações, temp=${temp}, modelo=${model}`);
  function label() {
    return values.label;
  }

  // Temas inferidos (cache em arquivo; determinístico entre variações)
  const themeCachePath = `${outPath.replace(/[^/]*$/, '')}themes-cache.json`;
  const themes: Record<string, string> = existsSync(themeCachePath)
    ? (JSON.parse(readFileSync(themeCachePath, 'utf8')) as Record<string, string>)
    : {};
  const promptTable = readTable(promptsPath);
  const promptMap = new Map(promptTable.map((r) => [r.id, r.description ?? '']));
  let tokIn = 0;
  let tokOut = 0;
  const needed = [...new Set(sample.map((s) => s.prompt))].filter((p) => !themes[p]);
  await pool(needed, CONCURRENCY, async (p) => {
    const t = await inferTheme(apiKey, model, motivatorsOf(promptMap.get(p) ?? ''));
    themes[p] = t.theme;
    tokIn += t.tokens[0];
    tokOut += t.tokens[1];
  });
  if (needed.length) writeFileSync(themeCachePath, JSON.stringify(themes, null, 1));

  const corrector = new DeepSeekCorrector(apiKey, model, undefined, temp);
  const results: Result[] = new Array<Result>(sample.length);
  let done = 0;
  await pool(sample, CONCURRENCY, async (s, i) => {
    const base = {
      id: s.id,
      prompt: s.prompt,
      theme: themes[s.prompt] ?? '',
      human: s.human,
      humanTotal: s.humanTotal,
    };
    try {
      const r = await runCorrectionPipeline(corrector, { theme: base.theme, text: s.text });
      tokIn += r.inputTokens ?? 0;
      tokOut += r.outputTokens ?? 0;
      const c = r.correction;
      results[i] = {
        ...base,
        model: COMPETENCY_KEYS.map((k) => c[k].score),
        modelTotal: r.totalScore,
        status: r.status === 'flagged' ? 'flagged' : 'ok',
        zeroReason: c.zeroReason,
      };
    } catch (e) {
      const name = e instanceof Error ? e.name : 'error';
      results[i] = {
        ...base,
        model: null,
        modelTotal: null,
        status:
          name === 'HeuristicFlaggedError'
            ? 'heuristic'
            : name.includes('Invalid')
              ? 'invalid'
              : 'error',
      };
    }
    if (++done % 20 === 0) console.log(`[bench] ${done}/${sample.length}`);
  });

  // Métricas só sobre redações avaliadas (status ok).
  const ok = results.filter((r) => r.status === 'ok' && r.model);
  const hT = ok.map((r) => r.humanTotal);
  const mT = ok.map((r) => r.modelTotal!);
  const totalClasses = Array.from({ length: 26 }, (_, i) => i * 40);
  const total = stats(hT, mT, totalClasses);
  const perComp = COMPETENCY_KEYS.map((k, ci) => ({
    key: k,
    ...stats(
      ok.map((r) => r.human[ci]!),
      ok.map((r) => r.model![ci]!),
      LEVELS,
    ),
  }));
  const within = (d: number) =>
    ok.filter((r) => Math.abs(r.modelTotal! - r.humanTotal) <= d).length / (ok.length || 1);
  const confusion = TOTAL_BINS.slice(0, -1).map((_, hb) =>
    TOTAL_BINS.slice(0, -1).map(
      (__, mb) =>
        ok.filter((r) => binOf(r.humanTotal) === hb && binOf(r.modelTotal!) === mb).length,
    ),
  );
  const cost = (tokIn * 0.28 + tokOut * 0.42) / 1e6; // US$, tabela deepseek-chat (aprox.)
  const summary = {
    label: values.label,
    n: sample.length,
    evaluated: ok.length,
    skipped: results.length - ok.length,
    temperature: temp,
    total: { ...total, within80: within(80), within40: within(40) },
    perCompetency: perComp,
    meanCompetencyQwk: mean(perComp.map((c) => c.qwk)),
    meanCompetencyMae: mean(perComp.map((c) => c.mae)),
    confusionBins: TOTAL_BINS.slice(0, -1).map((_, i) => binLabel(i)),
    confusion,
    tokens: { input: tokIn, output: tokOut },
    approxCostUsd: cost,
  };
  writeFileSync(outPath, JSON.stringify({ summary, results }, null, 1));

  const f = (x: number) => x.toFixed(3);
  console.log(`\n== ${values.label} (n=${ok.length}/${sample.length}) ==`);
  console.log(
    `TOTAL  QWK ${f(total.qwk)}  EAM ${total.mae.toFixed(1)}  viés ${total.bias.toFixed(1)}  ±80 ${(within(80) * 100).toFixed(1)}%  ±40 ${(within(40) * 100).toFixed(1)}%`,
  );
  for (const c of perComp)
    console.log(`${c.key}     QWK ${f(c.qwk)}  EAM ${c.mae.toFixed(1)}  viés ${c.bias.toFixed(1)}`);
  console.log(`QWK médio por competência ${f(summary.meanCompetencyQwk)}`);
  console.log('Confusão (linhas = humano, colunas = modelo):');
  console.log(['       ', ...summary.confusionBins.map((b) => b.padStart(8))].join(''));
  confusion.forEach((row, i) =>
    console.log([binLabel(i).padEnd(7), ...row.map((v) => String(v).padStart(8))].join('')),
  );
  console.log(
    `tokens in/out ${tokIn}/${tokOut}  custo aprox. US$ ${cost.toFixed(3)}  -> ${outPath}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

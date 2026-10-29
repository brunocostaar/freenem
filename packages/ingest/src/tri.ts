import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { CACHE_DIR, db, schema } from './db.js';
import { listRemoteZip, readRemoteEntry } from './remote-zip.js';
import { areaOf, ensureDataset, loadYear, type Area } from './sources/enem-api.js';

/**
 * Fonte B: parâmetros TRI (a, b, c) do arquivo ITENS_PROVA_<ano>.csv dos microdados do INEP.
 * Usa HTTP Range para baixar só esse CSV de dentro do ZIP de centenas de MB.
 *
 * Mapeamento: caderno AZUL, posição (CO_POSICAO = nº da questão na prova, 1–180) + área
 * (SG_AREA) + língua (TP_LINGUA, para as questões de língua estrangeira). Cada candidato é
 * validado pelo gabarito: só gravamos quando TX_GABARITO == letra correta da nossa questão.
 */

const AREA_CODE: Record<string, Area> = {
  LC: 'linguagens',
  CH: 'humanas',
  CN: 'natureza',
  MT: 'matematica',
};

export interface ItemRow {
  position: number;
  area: Area;
  item: string;
  answer: string;
  a: number | null;
  b: number | null;
  c: number | null;
  color: string;
  prova: string;
  /** 0 = inglês, 1 = espanhol, null = não se aplica */
  lang: number | null;
}

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function parseItens(csv: string): ItemRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = lines[0] ?? '';
  const sep = header.includes(';') ? ';' : ',';
  const cols = header.split(sep).map((c) => c.replace(/"/g, '').trim());
  const idx = (name: string) => cols.indexOf(name);
  const iPos = idx('CO_POSICAO');
  const iArea = idx('SG_AREA');
  const iItem = idx('CO_ITEM');
  const iGab = idx('TX_GABARITO');
  const iA = idx('NU_PARAM_A');
  const iB = idx('NU_PARAM_B');
  const iC = idx('NU_PARAM_C');
  const iCor = idx('TX_COR');
  const iProva = idx('CO_PROVA');
  const iLang = idx('TP_LINGUA');
  if ([iPos, iArea, iItem, iGab, iB].some((i) => i < 0)) {
    throw new Error(`Colunas inesperadas em ITENS_PROVA: ${header}`);
  }
  const out: ItemRow[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(sep).map((c) => c.replace(/"/g, '').trim());
    const area = AREA_CODE[f[iArea] ?? ''];
    const position = Number(f[iPos]);
    if (!area || !Number.isFinite(position)) continue;
    const lang = iLang >= 0 && f[iLang] !== undefined && f[iLang] !== '' ? Number(f[iLang]) : null;
    out.push({
      position,
      area,
      item: f[iItem] ?? '',
      answer: (f[iGab] ?? '').toUpperCase(),
      a: num(f[iA]),
      b: num(f[iB]),
      c: num(f[iC]),
      color: (f[iCor] ?? '').toUpperCase(),
      prova: f[iProva] ?? '',
      lang,
    });
  }
  return out;
}

async function fetchItens(year: number): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, 'tri', `ITENS_PROVA_${year}.csv`);
  if (existsSync(cacheFile)) return readFile(cacheFile, 'latin1');
  const url = `https://download.inep.gov.br/microdados/microdados_enem_${year}.zip`;
  const entries = await listRemoteZip(url);
  const entry = entries.find((e) => /ITENS_PROVA.*\.csv$/i.test(e.name));
  if (!entry) throw new Error(`ITENS_PROVA não encontrado no ZIP de ${year}`);
  const buf = await readRemoteEntry(url, entry);
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, buf);
  return buf.toString('latin1');
}

export interface TriYearResult {
  year: number;
  questions: number;
  matched: number;
  mismatched: number;
  noParams: number;
  error?: string;
}

interface OurQuestion {
  externalId: string;
  index: number;
  area: Area;
  language: 'ingles' | 'espanhol' | null;
  correct: string;
}

/** Posição da questão dentro da sua área (1–45). */
const local = (q: OurQuestion) => ((q.index - 1) % 45) + 1;
const INEP_AREA_ORDER: Record<Area, number> = {
  linguagens: 0,
  humanas: 1,
  natureza: 2,
  matematica: 3,
};

/**
 * Formas de numerar a questão: o CSV do INEP muda entre anos.
 * - absoluta: igual ao nosso índice (2009–2015, 2018+);
 * - 2016: absoluta, mas na ordem LC, CH, CN, MT;
 * - 2017: posição dentro da área; em LC as línguas ocupam 1–5 (inglês) e 6–10 (espanhol) e as demais vêm depois.
 */
const POSITION_MODES: { name: string; pos: (q: OurQuestion) => number }[] = [
  { name: 'posição absoluta (1–180)', pos: (q) => q.index },
  {
    name: 'posição absoluta em ordem LC/CH/CN/MT',
    pos: (q) => 45 * INEP_AREA_ORDER[q.area] + local(q),
  },
  {
    name: 'posição na área, línguas primeiro',
    pos: (q) => {
      if (q.area !== 'linguagens') return local(q);
      if (q.language === 'ingles') return local(q);
      if (q.language === 'espanhol') return 5 + local(q);
      return local(q) + 5;
    },
  },
];

function sameLang(q: OurQuestion, r: ItemRow): boolean {
  if (!q.language) return r.lang === null;
  return r.lang === (q.language === 'ingles' ? 0 : 1);
}

/**
 * Para um modo de numeração, escolhe por área o caderno (CO_PROVA) com mais acertos de
 * gabarito e devolve a atribuição questão -> item. Itens só são atribuídos se TX_GABARITO
 * coincide com a nossa letra correta.
 */
function evaluate(rows: ItemRow[], ours: OurQuestion[], pos: (q: OurQuestion) => number) {
  const byProva = new Map<string, ItemRow[]>();
  for (const r of rows) byProva.set(r.prova, [...(byProva.get(r.prova) ?? []), r]);

  const find = (provaRows: ItemRow[], q: OurQuestion): ItemRow | undefined =>
    provaRows.find(
      (r) => r.area === q.area && r.position === pos(q) && sameLang(q, r) && r.answer === q.correct,
    );

  const assign = new Map<string, ItemRow>();
  for (const area of new Set(ours.map((q) => q.area))) {
    const qs = ours.filter((q) => q.area === area);
    let best: { n: number; found: Map<string, ItemRow> } | null = null;
    for (const provaRows of byProva.values()) {
      const found = new Map<string, ItemRow>();
      for (const q of qs) {
        const r = find(provaRows, q);
        if (r) found.set(q.externalId, r);
      }
      if (!best || found.size > best.n) best = { n: found.size, found };
    }
    for (const [k, v] of best?.found ?? []) assign.set(k, v);
  }
  return assign;
}

export async function importTri(opts: { years: number[] }): Promise<TriYearResult[]> {
  ensureDataset();
  const results: TriYearResult[] = [];
  for (const year of opts.years) {
    const res: TriYearResult = { year, questions: 0, matched: 0, mismatched: 0, noParams: 0 };
    results.push(res);
    try {
      const loaded = await loadYear(year);
      const ours: OurQuestion[] = loaded
        .filter((l) => l.data.correctAlternative)
        .map((l) => ({
          externalId: `enem-${year}-${l.dir}`,
          index: l.data.index,
          area: areaOf(year, l.data.index),
          language: l.data.language,
          correct: l.data.correctAlternative!,
        }));
      res.questions = ours.length;

      const rows = parseItens(await fetchItens(year)).filter((r) => r.color === 'AZUL');
      if (rows.length === 0) throw new Error('sem itens do caderno azul');

      let best: { name: string; assign: Map<string, ItemRow> } | null = null;
      for (const mode of POSITION_MODES) {
        const assign = evaluate(rows, ours, mode.pos);
        if (!best || assign.size > best.assign.size) best = { name: mode.name, assign };
      }
      const assign = best!.assign;
      console.log(`  ${year}: ${best!.name}; gabarito confere em ${assign.size}/${ours.length}`);

      for (const q of ours) {
        const row = assign.get(q.externalId);
        if (!row) {
          res.mismatched++;
          continue;
        }
        if (row.b === null) {
          res.noParams++;
          continue;
        }
        await db
          .update(schema.questions)
          .set({ irtA: row.a, irtB: row.b, irtC: row.c })
          .where(eq(schema.questions.externalId, q.externalId));
        res.matched++;
      }
    } catch (e) {
      res.error = e instanceof Error ? e.message : String(e);
      console.warn(`  ${year}: falhou — ${res.error}`);
    }
  }
  console.log('\nResumo TRI:');
  console.table(
    results.map((r) => ({
      ano: r.year,
      questões: r.questions,
      'com a,b,c': r.matched,
      cobertura: r.questions ? `${Math.round((r.matched / r.questions) * 100)}%` : '-',
      'gabarito divergente/ausente': r.mismatched,
      'sem parâmetros': r.noParams,
      erro: r.error ?? '',
    })),
  );
  return results;
}

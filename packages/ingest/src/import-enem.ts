import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { contentTypeFor, type Storage } from '../../../apps/api/src/lib/storage-core.js';
import { classify } from './classify.js';
import { db, getStorage, schema } from './db.js';
import { checkQuality, escapeDollars } from './quality.js';
import {
  areaOf,
  dayOf,
  DATASET_PUBLIC,
  ENEM_YEARS,
  ensureDataset,
  loadYear,
  type LoadedQuestion,
} from './sources/enem-api.js';

const COVERED_ABOVE = new Set([
  'statement_empty',
  'alternatives_count',
  'alternative_empty',
  'no_correct',
  'broken_image',
]);

const INEP_URL =
  'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos';
const DATASET_URL = 'https://github.com/yunger7/enem-api';

interface Flags {
  brokenImages: number;
  missingImages: number;
}

/** Sobe uma imagem do dataset para o storage e devolve a referência `storage://...`. */
async function uploadImage(
  url: string,
  storage: Storage,
  flags: Flags,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(url)) {
    const hit = cache.get(url) ?? null;
    if (hit === null) flags[url.includes('broken-image') ? 'brokenImages' : 'missingImages']++;
    return hit;
  }
  let ref: string | null = null;
  if (url.includes('broken-image')) {
    flags.brokenImages++;
  } else if (url.startsWith('https://enem.dev/')) {
    const rel = url.slice('https://enem.dev/'.length);
    const local = path.join(DATASET_PUBLIC, rel);
    if (existsSync(local)) {
      const key = `enem/${rel}`;
      await storage.put(key, await readFile(local), contentTypeFor(local));
      ref = storage.ref(key);
    } else {
      flags.missingImages++;
    }
  } else {
    ref = url; // imagem externa: mantém
  }
  cache.set(url, ref);
  return ref;
}

type LatexFile = { kind: 'tex'; tex: string } | { kind: 'image'; ref: string } | null;

/**
 * Os arquivos `.latex` do dataset são, na maioria, fórmulas em texto; alguns (ex.: ENEM 2018 q136)
 * são imagens GIF/PNG com a extensão errada. Nesse caso sobem como imagem.
 */
async function readLatex(url: string, storage: Storage): Promise<LatexFile> {
  if (!url.startsWith('https://enem.dev/')) return null;
  const rel = url.slice('https://enem.dev/'.length);
  const local = path.join(DATASET_PUBLIC, rel);
  if (!existsSync(local)) return null;
  const buf = await readFile(local);
  const head = buf.subarray(0, 8).toString('latin1');
  const binary = buf.includes(0) || head.startsWith('GIF8') || head.startsWith('\x89PNG');
  if (!binary) return { kind: 'tex', tex: buf.toString('utf8').trim() };
  const ext = head.startsWith('GIF8') ? 'gif' : head.startsWith('\x89PNG') ? 'png' : 'jpg';
  const key = `enem/${rel.replace(/\.latex$/i, `.${ext}`)}`;
  await storage.put(key, buf, contentTypeFor(`x.${ext}`));
  return { kind: 'image', ref: storage.ref(key) };
}

/** Reescreve imagens do Markdown: sobe arquivos, converte `.latex` em fórmula, remove quebradas. */
async function rewriteMarkdown(
  md: string,
  storage: Storage,
  flags: Flags,
  cache: Map<string, string | null>,
): Promise<string> {
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
  const parts: string[] = [];
  let last = 0;
  for (const m of md.matchAll(re)) {
    parts.push(escapeDollars(md.slice(last, m.index)));
    last = m.index + m[0].length;
    const alt = m[1] ?? '';
    const url = m[2] ?? '';
    if (url.toLowerCase().endsWith('.latex')) {
      const f = await readLatex(url, storage);
      if (f?.kind === 'image') parts.push(`![${alt || 'Imagem da questão'}](${f.ref})`);
      else {
        const tex = f?.kind === 'tex' ? f.tex : alt;
        parts.push(tex ? `$${tex.replace(/\$/g, '')}$` : '');
      }
      continue;
    }
    const ref = await uploadImage(url, storage, flags, cache);
    parts.push(ref ? `![${alt || 'Imagem da questão'}](${ref})` : '');
  }
  parts.push(escapeDollars(md.slice(last)));
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ImportOptions {
  years: number[];
  /** não sobe imagens (mais rápido; só para testes) */
  skipImages?: boolean;
}

export interface ImportStats {
  total: number;
  byYear: Record<number, { total: number; published: number; draft: number }>;
  bySubject: Record<string, number>;
  byStatus: Record<string, number>;
  flaggedImages: number;
  skippedReviewed: number;
}

export async function importEnem(opts: ImportOptions): Promise<ImportStats> {
  ensureDataset();
  const storage = getStorage();

  const [inst] = await db
    .select()
    .from(schema.institutions)
    .where(eq(schema.institutions.slug, 'enem'))
    .limit(1);
  if (!inst) throw new Error('Instituição ENEM não encontrada. Rode `pnpm db:seed` primeiro.');

  const subjectRows = await db.select().from(schema.subjects);
  const subjectId = new Map(subjectRows.map((s) => [s.name, s.id]));
  const topicRows = await db.select().from(schema.topics);
  const topicId = new Map(topicRows.map((t) => [`${t.subjectId}/${t.slug}`, t.id]));
  if (subjectId.size === 0) throw new Error('Taxonomia vazia. Rode `pnpm db:seed` primeiro.');

  const stats: ImportStats = {
    total: 0,
    byYear: {},
    bySubject: {},
    byStatus: {},
    flaggedImages: 0,
    skippedReviewed: 0,
  };
  const imageCache = new Map<string, string | null>();

  for (const year of opts.years) {
    const items = await loadYear(year);
    const ys = (stats.byYear[year] = { total: 0, published: 0, draft: 0 });
    const examIds = new Map<1 | 2, string>();

    async function examFor(day: 1 | 2): Promise<string> {
      const cached = examIds.get(day);
      if (cached) return cached;
      const label = `ENEM ${year} · Dia ${day}`;
      const [row] = await db
        .insert(schema.exams)
        .values({
          institutionId: inst!.id,
          year,
          phase: `Dia ${day}`,
          color: 'azul',
          label,
          sourceUrl: INEP_URL,
        })
        .onConflictDoUpdate({
          target: [schema.exams.institutionId, schema.exams.year, schema.exams.label],
          set: { phase: `Dia ${day}`, color: 'azul', sourceUrl: INEP_URL },
        })
        .returning();
      examIds.set(day, row!.id);
      return row!.id;
    }

    for (const item of items) {
      await importOne(item);
    }

    async function importOne({ dir, data }: LoadedQuestion) {
      const externalId = `enem-${year}-${dir}`;
      const [existing] = await db
        .select({ id: schema.questions.id, reviewedBy: schema.questions.reviewedBy })
        .from(schema.questions)
        .where(eq(schema.questions.externalId, externalId))
        .limit(1);
      // Não sobrescreve o trabalho de revisores.
      if (existing?.reviewedBy) {
        stats.skippedReviewed++;
        return;
      }

      const flags: Flags = { brokenImages: 0, missingImages: 0 };
      const area = areaOf(year, data.index);

      let statement: string;
      const imageUrls: string[] = [];
      const altRows: {
        letter: string;
        text: string;
        imageUrl: string | null;
        isCorrect: boolean;
      }[] = [];
      if (opts.skipImages) {
        statement = [data.context, data.alternativesIntroduction].filter(Boolean).join('\n\n');
      } else {
        const ctx = data.context
          ? await rewriteMarkdown(data.context, storage, flags, imageCache)
          : '';
        const intro = escapeDollars(data.alternativesIntroduction?.trim() ?? '');
        statement = [ctx, intro].filter(Boolean).join('\n\n');
        for (const f of data.files) {
          if (f.toLowerCase().endsWith('.latex')) continue;
          const ref = await uploadImage(f, storage, flags, imageCache);
          if (ref) imageUrls.push(ref);
        }
      }

      for (const alt of data.alternatives) {
        let text = alt.text ?? '';
        let imageUrl: string | null = null;
        if (!opts.skipImages) {
          if (text) text = await rewriteMarkdown(text, storage, flags, imageCache);
          if (alt.file) {
            if (alt.file.toLowerCase().endsWith('.latex')) {
              const f = await readLatex(alt.file, storage);
              if (f?.kind === 'tex' && f.tex) text = `$${f.tex.replace(/\$/g, '')}$`;
              else if (f?.kind === 'image') imageUrl = f.ref;
            } else {
              imageUrl = await uploadImage(alt.file, storage, flags, imageCache);
            }
          }
        }
        altRows.push({
          letter: alt.letter,
          text,
          imageUrl,
          isCorrect: alt.letter === data.correctAlternative,
        });
      }

      // ---- classificação ----
      const altText = altRows.map((a) => a.text).join('\n');
      const c = classify({
        text: `${statement}\n${altText}`,
        area,
        language: data.language,
      });
      const subjectIdValue = subjectId.get(c.subject);

      // ---- validações → status ----
      const problems: string[] = [];
      if (!statement.trim()) problems.push('enunciado vazio');
      if (flags.brokenImages) problems.push('imagem quebrada');
      if (flags.missingImages) problems.push('imagem ausente');
      if (altRows.length !== 5) problems.push('alternativas incompletas');
      if (!data.correctAlternative || !altRows.some((a) => a.isCorrect))
        problems.push('sem gabarito');
      if (altRows.some((a) => !a.text.trim() && !a.imageUrl)) problems.push('alternativa vazia');
      // checagens de qualidade (enunciado curto/truncado, alternativas repetidas, LaTeX, etc.)
      for (const issue of checkQuality({ statement, imageUrls, alternatives: altRows })) {
        if (!COVERED_ABOVE.has(issue.code)) problems.push(`${issue.code}: ${issue.detail}`);
      }
      stats.flaggedImages += flags.brokenImages + flags.missingImages;
      // Confiança baixa de classificação NÃO rebaixa: a matéria atribuída fica e os assuntos podem
      // ficar vazios (e reimportar não desfaz o `auto-review`).
      const status = problems.length === 0 ? 'published' : 'draft';

      const examId = await examFor(dayOf(year, area));
      const values = {
        examId,
        subjectId: subjectIdValue ?? null,
        number: data.index,
        statement,
        imageUrls,
        status: status as 'draft' | 'published',
        sourceName: `ENEM ${year} · INEP — dados via enem-api (GPL-2.0)`,
        sourceUrl: DATASET_URL,
        sourceLicense: 'GPL-2.0',
        externalId,
        updatedAt: new Date(),
      };

      await db.transaction(async (tx) => {
        const [q] = await tx
          .insert(schema.questions)
          .values(values)
          .onConflictDoUpdate({ target: schema.questions.externalId, set: values })
          .returning({ id: schema.questions.id });
        const qid = q!.id;
        await tx.delete(schema.alternatives).where(eq(schema.alternatives.questionId, qid));
        if (altRows.length) {
          await tx.insert(schema.alternatives).values(
            altRows.map((a) => ({
              questionId: qid,
              letter: a.letter as 'A',
              text: a.text,
              imageUrl: a.imageUrl,
              isCorrect: a.isCorrect,
            })),
          );
        }
        await tx.delete(schema.questionTopics).where(eq(schema.questionTopics.questionId, qid));
        const ids = new Set<string>();
        for (const t of c.topics) {
          const sid = subjectId.get(t.subject);
          const tid = sid ? topicId.get(`${sid}/${t.slug}`) : undefined;
          if (tid) ids.add(tid);
        }
        if (ids.size) {
          await tx
            .insert(schema.questionTopics)
            .values([...ids].map((topicIdValue) => ({ questionId: qid, topicId: topicIdValue })));
        }
      });

      stats.total++;
      ys.total++;
      ys[status]++;
      stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
      stats.bySubject[c.subject] = (stats.bySubject[c.subject] ?? 0) + 1;
    }
    console.log(
      `  ${year}: ${ys.total} questões (${ys.published} publicadas, ${ys.draft} em rascunho)`,
    );
  }
  return stats;
}

export { ENEM_YEARS };

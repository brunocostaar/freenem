import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { CACHE_DIR, db, schema } from './db.js';
import { checkQuality, expectedAlternativesOf, type Issue } from './quality.js';

function csvCell(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Resolve `storage://chave` no disco quando o driver é local; outros drivers: não checa. */
function localImageMissing(): ((ref: string) => boolean) | undefined {
  if (process.env.STORAGE_DRIVER === 'r2') return undefined;
  const dir = path.resolve(
    process.env.STORAGE_DIR ?? path.resolve(CACHE_DIR, '../../../apps/api/storage'),
  );
  if (!existsSync(dir)) {
    console.warn(`(aviso) STORAGE_DIR ${dir} não existe: pulando checagem de arquivos.`);
    return undefined;
  }
  return (ref) => ref.startsWith('storage://') && !existsSync(path.join(dir, ref.slice(10)));
}

export interface QualityOptions {
  /** só relata (não rebaixa questões publicadas para rascunho) */
  dryRun?: boolean;
}

/**
 * Varre todas as questões, relata as suspeitas em CSV (`.cache/quality-report.csv`) e move as
 * PUBLICADAS e ainda NÃO revisadas por humanos (`reviewed_by` vazio) para `draft`.
 * Não há coluna de motivo em `questions`: o motivo fica só no CSV/log.
 */
export async function qualityReport(opts: QualityOptions = {}): Promise<void> {
  const imageMissing = localImageMissing();
  const qs = await db
    .select({
      id: schema.questions.id,
      examId: schema.questions.examId,
      externalId: schema.questions.externalId,
      number: schema.questions.number,
      status: schema.questions.status,
      reviewedBy: schema.questions.reviewedBy,
      statement: schema.questions.statement,
      imageUrls: schema.questions.imageUrls,
    })
    .from(schema.questions)
    .orderBy(asc(schema.questions.externalId));
  const examInst = new Map(
    (
      await db
        .select({ id: schema.exams.id, slug: schema.institutions.slug })
        .from(schema.exams)
        .innerJoin(schema.institutions, eq(schema.institutions.id, schema.exams.institutionId))
    ).map((e) => [e.id, e.slug]),
  );
  const alts = await db
    .select({
      questionId: schema.alternatives.questionId,
      letter: schema.alternatives.letter,
      text: schema.alternatives.text,
      imageUrl: schema.alternatives.imageUrl,
      isCorrect: schema.alternatives.isCorrect,
    })
    .from(schema.alternatives)
    .orderBy(asc(schema.alternatives.letter));
  const byQ = new Map<string, typeof alts>();
  for (const a of alts) {
    const list = byQ.get(a.questionId) ?? [];
    list.push(a);
    byQ.set(a.questionId, list);
  }

  const flagged: { q: (typeof qs)[number]; issues: Issue[] }[] = [];
  for (const q of qs) {
    const issues = checkQuality(
      { statement: q.statement, imageUrls: q.imageUrls, alternatives: byQ.get(q.id) ?? [] },
      {
        imageMissing,
        expectedAlternatives: expectedAlternativesOf(q.examId ? examInst.get(q.examId) : undefined),
      },
    );
    if (issues.length) flagged.push({ q, issues });
  }

  const byCode: Record<string, number> = {};
  for (const f of flagged) for (const i of f.issues) byCode[i.code] = (byCode[i.code] ?? 0) + 1;
  const toDemote = flagged.filter((f) => f.q.status === 'published' && !f.q.reviewedBy);
  const reviewedFlagged = flagged.filter((f) => f.q.status === 'published' && f.q.reviewedBy);

  const header = 'external_id,status,action,codes,details';
  const lines = flagged.map(({ q, issues }) => {
    const action =
      q.status !== 'published'
        ? 'ja_rascunho'
        : q.reviewedBy
          ? 'revisada_mantida'
          : opts.dryRun
            ? 'seria_rebaixada'
            : 'rebaixada_para_draft';
    return [
      q.externalId,
      q.status,
      action,
      issues.map((i) => i.code).join('|'),
      issues.map((i) => i.detail).join(' ; '),
    ]
      .map(csvCell)
      .join(',');
  });
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, 'quality-report.csv');
  await writeFile(file, [header, ...lines].join('\n') + '\n', 'utf8');

  if (!opts.dryRun && toDemote.length) {
    const ids = toDemote.map((f) => f.q.id);
    for (let i = 0; i < ids.length; i += 500) {
      await db
        .update(schema.questions)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(
          and(
            inArray(schema.questions.id, ids.slice(i, i + 500)),
            eq(schema.questions.status, 'published'),
          ),
        );
    }
  }

  console.log(`\nQuestões verificadas: ${qs.length}`);
  console.log(`Com algum problema: ${flagged.length}`);
  console.table(byCode);
  console.log(
    `Publicadas ${opts.dryRun ? 'que seriam rebaixadas' : 'rebaixadas para draft'}: ${toDemote.length}`,
  );
  console.log(
    `Publicadas já revisadas por humano (mantidas, só relatadas): ${reviewedFlagged.length}`,
  );
  console.log(`Relatório: ${file}`);
}

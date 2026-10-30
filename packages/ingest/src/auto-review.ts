import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { CACHE_DIR, db, schema } from './db.js';
import {
  checkQuality,
  expectedAlternativesOf,
  type IssueCode,
  type QualityInput,
} from './quality.js';
import { localImageMissing } from './quality-report.js';

export interface ReviewInput extends QualityInput {
  subjectId: string | null;
  institution: string | null;
}

export interface ReviewDecision {
  publish: boolean;
  reasons: string[];
}

/** Problemas de qualidade que bloqueiam a publicação (todos, como nos importadores). */
const BLOCKING_ALL: ReadonlySet<IssueCode> = new Set<IssueCode>([
  'statement_short',
  'statement_empty',
  'alternatives_count',
  'alternative_empty',
  'alternatives_duplicated',
  'no_correct',
  'multiple_correct',
  'broken_image',
  'unbalanced_latex',
  'markdown_artifact',
]);

/**
 * Decisão determinística (sem LLM) para publicar um rascunho: só publica se enunciado, matéria,
 * alternativas (nº esperado da instituição, uma correta, nenhuma vazia) e imagens estão íntegros
 * e `checkQuality` não aponta nada. Pura, sem banco.
 */
export function decideReview(
  q: ReviewInput,
  opts: { imageMissing?: (ref: string) => boolean } = {},
): ReviewDecision {
  const reasons: string[] = [];
  if (!q.statement.trim()) reasons.push('statement_empty');
  if (!q.subjectId) reasons.push('no_subject');
  for (const issue of checkQuality(q, {
    imageMissing: opts.imageMissing,
    expectedAlternatives: expectedAlternativesOf(q.institution),
  })) {
    if (BLOCKING_ALL.has(issue.code) && !reasons.includes(issue.code)) reasons.push(issue.code);
  }
  return { publish: reasons.length === 0, reasons };
}

export interface AutoReviewOptions {
  dryRun?: boolean;
  institution?: string;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Publica rascunhos sem revisão humana (`reviewed_by` nulo) que passam em `decideReview`.
 * Não preenche `reviewed_by`: continua distinguível de revisão humana e reimportar segue valendo.
 */
export async function autoReview(opts: AutoReviewOptions = {}): Promise<void> {
  const imageMissing = localImageMissing();
  const rows = await db
    .select({
      id: schema.questions.id,
      externalId: schema.questions.externalId,
      statement: schema.questions.statement,
      imageUrls: schema.questions.imageUrls,
      subjectId: schema.questions.subjectId,
      institution: schema.institutions.slug,
    })
    .from(schema.questions)
    .innerJoin(schema.exams, eq(schema.exams.id, schema.questions.examId))
    .innerJoin(schema.institutions, eq(schema.institutions.id, schema.exams.institutionId))
    .where(
      and(
        eq(schema.questions.status, 'draft'),
        isNull(schema.questions.reviewedBy),
        opts.institution ? eq(schema.institutions.slug, opts.institution) : undefined,
      ),
    )
    .orderBy(asc(schema.questions.externalId));

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

  const stats = new Map<string, { published: number; kept: number }>();
  const reasonCount = new Map<string, number>();
  const toPublish: string[] = [];
  const lines: string[] = [];
  for (const r of rows) {
    const inst = r.institution;
    const d = decideReview(
      {
        statement: r.statement,
        imageUrls: r.imageUrls,
        alternatives: byQ.get(r.id) ?? [],
        subjectId: r.subjectId,
        institution: inst,
      },
      { imageMissing },
    );
    const s = stats.get(inst) ?? { published: 0, kept: 0 };
    stats.set(inst, s);
    if (d.publish) {
      s.published++;
      toPublish.push(r.id);
    } else {
      s.kept++;
      const key = `${inst}:${d.reasons.join('+')}`;
      reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
    }
    lines.push(
      [
        r.externalId ?? r.id,
        inst,
        d.publish ? (opts.dryRun ? 'would_publish' : 'published') : 'kept_draft',
        d.reasons.join('|'),
      ]
        .map(csvCell)
        .join(','),
    );
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, 'auto-review-report.csv');
  await writeFile(file, ['external_id,institution,action,reasons', ...lines].join('\n') + '\n');

  if (!opts.dryRun) {
    for (let i = 0; i < toPublish.length; i += 500) {
      await db
        .update(schema.questions)
        .set({ status: 'published', updatedAt: new Date() })
        .where(
          and(
            inArray(schema.questions.id, toPublish.slice(i, i + 500)),
            eq(schema.questions.status, 'draft'),
            isNull(schema.questions.reviewedBy),
          ),
        );
    }
  }

  console.log(`\nRascunhos analisados: ${rows.length}${opts.dryRun ? ' (dry-run)' : ''}`);
  console.table(
    Object.fromEntries(
      [...stats].map(([k, v]) => [
        k,
        { [opts.dryRun ? 'would_publish' : 'published']: v.published, kept_draft: v.kept },
      ]),
    ),
  );
  console.log('Principais motivos (mantidos em draft):');
  for (const [k, n] of [...reasonCount].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(5)}  ${k}`);
  }
  console.log(`Relatório: ${file}`);
}

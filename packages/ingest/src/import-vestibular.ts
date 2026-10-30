import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { classify } from './classify.js';
import { classifyVestibular } from './classify-vestibular.js';
import { CACHE_DIR, db, getStorage, schema } from './db.js';
import type { ExamRef, ExtractedQuestion, Source } from './index.js';
import { checkQuality } from './quality.js';

/** Aviso de direitos: provas são das instituições; entram só como rascunho, com fonte e remoção a pedido. */
export const VESTIBULAR_LICENSE =
  'Prova © instituição organizadora — uso educacional com atribuição; remoção a pedido';

export interface VestibularStats {
  exam: string;
  extracted: number;
  expected: number | undefined;
  imported: number;
  annulled: number;
  skippedReviewed: number;
  withGabarito: number;
  published: number;
  withImages: number;
  withSubject: number;
  /** questões com algum problema de qualidade/parser (todas ficam em draft de qualquer forma) */
  flagged: number;
}

export interface ImportOptions {
  /** só extrai e relata (não grava no banco nem no storage) */
  dryRun?: boolean;
}

function csvCell(v: string | number | null): string {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const REPORT_HEADER =
  'external_id,instituicao,ano,numero,materia,classificacao,gabarito,imagens,status,motivos';

/**
 * Importa uma `Source` de vestibular. Regras:
 *  - TUDO entra como `draft` (decisão de direitos autorais pendente); reimportar não mexe no status
 *    nem em questões já revisadas por humanos (`reviewed_by`);
 *  - atribuição completa (`source_name`, `source_url`, `source_license`);
 *  - problemas de qualidade (checkQuality com o nº de alternativas da instituição) e avisos do
 *    parser vão para `.cache/vestibulares-report.csv`;
 *  - questões anuladas pelo gabarito oficial não são importadas.
 */
export async function importVestibular(
  source: Source,
  opts: ImportOptions = {},
): Promise<{ stats: VestibularStats[]; csv: string[] }> {
  const storage = opts.dryRun ? undefined : getStorage();
  const subjectRows = await db.select().from(schema.subjects);
  const subjectId = new Map(subjectRows.map((s) => [s.name, s.id]));
  const topicRows = await db.select().from(schema.topics);
  const topicId = new Map(topicRows.map((t) => [`${t.subjectId}/${t.slug}`, t.id]));
  if (subjectId.size === 0) throw new Error('Taxonomia vazia. Rode `pnpm db:seed` primeiro.');

  const allStats: VestibularStats[] = [];
  const csv: string[] = [];
  for (const exam of await source.listExams()) {
    const [inst] = await db
      .select()
      .from(schema.institutions)
      .where(eq(schema.institutions.slug, exam.institution))
      .limit(1);
    if (!inst) throw new Error(`Instituição "${exam.institution}" não existe. Rode o seed.`);

    const questions = await source.extract(exam);
    const expected = (await source.expectedCount?.(exam)) ?? exam.expectedQuestions;
    const stats: VestibularStats = {
      exam: exam.label,
      extracted: questions.length,
      expected,
      imported: 0,
      annulled: 0,
      skippedReviewed: 0,
      withGabarito: 0,
      published: 0,
      withImages: 0,
      withSubject: 0,
      flagged: 0,
    };

    let examId = '';
    if (!opts.dryRun) {
      const [row] = await db
        .insert(schema.exams)
        .values({
          institutionId: inst.id,
          year: exam.year,
          phase: exam.phase ?? null,
          color: exam.color ?? null,
          label: exam.label,
          sourceUrl: exam.sourceUrl ?? null,
        })
        .onConflictDoUpdate({
          target: [schema.exams.institutionId, schema.exams.year, schema.exams.label],
          set: {
            phase: exam.phase ?? null,
            color: exam.color ?? null,
            sourceUrl: exam.sourceUrl ?? null,
          },
        })
        .returning();
      examId = row!.id;
    }

    for (const q of questions) {
      if (q.annulled) {
        stats.annulled++;
        continue;
      }
      await importOne(exam, q);
    }

    async function importOne(ex: ExamRef, q: ExtractedQuestion) {
      const externalId = q.externalId
        ? `${ex.externalPrefix ?? `${ex.institution}-${ex.year}`}-${q.externalId}`
        : `${ex.externalPrefix ?? `${ex.institution}-${ex.year}`}-${q.number}`;

      const imageUrls: string[] = [];
      for (const png of q.images ?? []) {
        const hash = createHash('sha1').update(png).digest('hex').slice(0, 16);
        const key = `vestibulares/${ex.institution}/${ex.year}/${hash}.png`;
        if (storage) {
          await storage.put(key, png, 'image/png');
          imageUrls.push(storage.ref(key));
        } else {
          imageUrls.push(`storage://${key}`);
        }
      }

      const altRows = q.alternatives.map((a) => ({
        letter: a.letter,
        text: a.text,
        imageUrl: null as string | null,
        isCorrect: q.correctLetter === a.letter,
      }));
      const fullText = `${q.statement}\n${q.alternatives.map((a) => a.text).join('\n')}`;
      const c =
        ex.publishable && q.area
          ? (() => {
              const r = classify({ text: fullText, area: q.area, language: q.language });
              return {
                subject: r.subject,
                topics: r.topics,
                confidence: r.confidence,
                how: 'enem',
              };
            })()
          : classifyVestibular({ text: fullText, subject: q.subject, language: q.language });

      const reasons: string[] = [...(q.warnings ?? [])];
      for (const issue of checkQuality(
        { statement: q.statement, imageUrls, alternatives: altRows },
        { expectedAlternatives: ex.expectedAlternatives ?? 5 },
      )) {
        reasons.push(`${issue.code}: ${issue.detail}`);
      }
      if (!c.subject) reasons.push('matéria não identificada');
      if (c.how === 'palavras-chave' && c.confidence < 0.5) reasons.push('classificação incerta');
      // ENEM PPL: avisos de figura não impedem a publicação (a figura vai anexada)
      const blocking = reasons.filter((r) => !/^(possível figura|figura vetorial)/.test(r));
      const status: 'draft' | 'published' =
        ex.publishable && blocking.length === 0 && q.correctLetter ? 'published' : 'draft';
      const flagged = reasons.length > 0;
      if (flagged) stats.flagged++;
      if (q.correctLetter) stats.withGabarito++;
      if (imageUrls.length) stats.withImages++;
      if (c.subject) stats.withSubject++;
      csv.push(
        [
          externalId,
          ex.institution,
          ex.year,
          q.number,
          c.subject,
          c.how,
          q.correctLetter ?? '',
          imageUrls.length,
          status,
          reasons.join(' ; '),
        ]
          .map(csvCell)
          .join(','),
      );
      if (status === 'published') stats.published++;
      if (opts.dryRun) return;

      const [existing] = await db
        .select({ reviewedBy: schema.questions.reviewedBy })
        .from(schema.questions)
        .where(eq(schema.questions.externalId, externalId))
        .limit(1);
      if (existing?.reviewedBy) {
        stats.skippedReviewed++;
        return;
      }

      const sid = c.subject ? (subjectId.get(c.subject) ?? null) : null;
      const base = {
        examId,
        subjectId: sid,
        number: q.number,
        statement: q.statement,
        imageUrls,
        sourceName: ex.attribution ?? `${ex.label} — prova oficial`,
        sourceUrl: ex.sourceUrl ?? null,
        sourceLicense: ex.license ?? VESTIBULAR_LICENSE,
        externalId,
        updatedAt: new Date(),
      };
      await db.transaction(async (tx) => {
        // vestibulares: `status` só entra no INSERT (draft): reimportar nunca rebaixa/promove nada.
        // ENEM PPL (`publishable`): o status acompanha a validação, exceto questões revisadas (puladas acima).
        const [row] = await tx
          .insert(schema.questions)
          .values({ ...base, status })
          .onConflictDoUpdate({
            target: schema.questions.externalId,
            set: ex.publishable ? { ...base, status } : base,
          })
          .returning({ id: schema.questions.id });
        const qid = row!.id;
        await tx.delete(schema.alternatives).where(eq(schema.alternatives.questionId, qid));
        if (altRows.length) {
          await tx.insert(schema.alternatives).values(
            altRows.map((a) => ({
              questionId: qid,
              letter: a.letter,
              text: a.text,
              imageUrl: a.imageUrl,
              isCorrect: a.isCorrect,
            })),
          );
        }
        await tx.delete(schema.questionTopics).where(eq(schema.questionTopics.questionId, qid));
        const ids = new Set<string>();
        for (const t of c.topics) {
          const sId = subjectId.get(t.subject);
          const tid = sId ? topicId.get(`${sId}/${t.slug}`) : undefined;
          if (tid) ids.add(tid);
        }
        if (ids.size) {
          await tx
            .insert(schema.questionTopics)
            .values([...ids].map((topicIdValue) => ({ questionId: qid, topicId: topicIdValue })));
        }
      });
      stats.imported++;
    }

    allStats.push(stats);
    console.log(
      `  ${stats.exam}: ${stats.extracted}/${stats.expected ?? '?'} extraídas, ` +
        `${stats.imported} gravadas (${stats.published} publicadas), ${stats.annulled} anuladas, ` +
        `${stats.withGabarito} com gabarito, ${stats.withImages} com figura, ` +
        `${stats.withSubject} com matéria, ${stats.flagged} com avisos`,
    );
  }
  return { stats: allStats, csv };
}

/** Grava o relatório CSV (um por execução) em `.cache/vestibulares-report.csv`. */
export async function writeReport(lines: string[]): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, 'vestibulares-report.csv');
  await writeFile(file, [REPORT_HEADER, ...lines].join('\n') + '\n', 'utf8');
  return file;
}

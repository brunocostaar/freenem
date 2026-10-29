import { eq } from 'drizzle-orm';
import { db, schema } from './db.js';
import type { Source } from './index.js';

/**
 * Importa as questões de uma `Source` genérica (PDFs de vestibulares) como RASCUNHO.
 * Sem matéria/assunto/gabarito: a fila de revisão (/admin/revisao) completa esses campos.
 */
export async function importDrafts(source: Source): Promise<void> {
  let total = 0;
  for (const exam of await source.listExams()) {
    const [inst] = await db
      .select()
      .from(schema.institutions)
      .where(eq(schema.institutions.slug, exam.institution))
      .limit(1);
    if (!inst) throw new Error(`Instituição "${exam.institution}" não existe. Rode o seed.`);

    const [examRow] = await db
      .insert(schema.exams)
      .values({
        institutionId: inst.id,
        year: exam.year,
        phase: exam.phase ?? null,
        label: exam.label,
        sourceUrl: exam.sourceUrl ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.exams.institutionId, schema.exams.year, schema.exams.label],
        set: { sourceUrl: exam.sourceUrl ?? null },
      })
      .returning();

    const questions = await source.extract(exam);
    console.log(`  ${exam.label}: ${questions.length} questões extraídas`);
    for (const q of questions) {
      const externalId = `${exam.institution}-${exam.year}-${q.number}`;
      const [existing] = await db
        .select({ reviewedBy: schema.questions.reviewedBy })
        .from(schema.questions)
        .where(eq(schema.questions.externalId, externalId))
        .limit(1);
      if (existing?.reviewedBy) continue;

      const values = {
        examId: examRow!.id,
        number: q.number,
        statement: q.statement,
        status: 'draft' as const,
        sourceName: `${exam.label} · ${inst.name}`,
        sourceUrl: exam.sourceUrl ?? null,
        externalId,
        updatedAt: new Date(),
      };
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(schema.questions)
          .values(values)
          .onConflictDoUpdate({ target: schema.questions.externalId, set: values })
          .returning({ id: schema.questions.id });
        await tx.delete(schema.alternatives).where(eq(schema.alternatives.questionId, row!.id));
        await tx.insert(schema.alternatives).values(
          q.alternatives.map((a) => ({
            questionId: row!.id,
            letter: a.letter,
            text: a.text,
            isCorrect: q.correctLetter === a.letter,
          })),
        );
      });
      total++;
    }
  }
  console.log(`Importadas ${total} questões como rascunho.`);
}

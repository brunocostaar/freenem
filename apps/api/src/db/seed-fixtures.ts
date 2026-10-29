/**
 * Questões sintéticas para CI/e2e (o dataset importado do ENEM não existe lá).
 * Pré-requisito: `pnpm db:seed` (instituições, matérias e assuntos). Idempotente
 * (upsert por external_id). NÃO use em produção.
 */
import { and, eq } from 'drizzle-orm';
import { isProd } from '../env.js';
import { db, schema, sql } from './index.js';

if (isProd) throw new Error('seed-fixtures não deve rodar em produção.');

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

interface ExamSpec {
  year: number;
  phase: 'Dia 1' | 'Dia 2';
  /** matéria -> nº de questões */
  subjects: Record<string, number>;
}

const EXAMS: ExamSpec[] = [
  {
    year: 2023,
    phase: 'Dia 1',
    subjects: { portugues: 4, ingles: 3, espanhol: 3, historia: 2, geografia: 2 },
  },
  { year: 2023, phase: 'Dia 2', subjects: { fisica: 3, quimica: 3, biologia: 2, matematica: 8 } },
  { year: 2022, phase: 'Dia 1', subjects: { portugues: 3, historia: 3 } },
  { year: 2022, phase: 'Dia 2', subjects: { fisica: 2, biologia: 2, matematica: 6 } },
];
/** rascunhos para a fila de revisão: [matéria, quantidade] */
const DRAFTS: [string, number][] = [
  ['matematica', 2],
  ['historia', 1],
];

const THEMES: Record<string, string> = {
  fisica: 'A energia elétrica consumida por um chuveiro depende da potência e do tempo de uso.',
  quimica: 'A reação de neutralização entre um ácido e uma base forma sal e água.',
  biologia: 'O efeito estufa intensificado altera o equilíbrio de ecossistemas.',
  matematica: 'Uma função do primeiro grau modela o custo de uma corrida de táxi.',
  portugues: 'No texto, o autor recorre à ironia para criticar o consumo excessivo.',
  ingles: 'Read the text and choose the alternative that best summarizes the main idea.',
  espanhol: 'Lea el texto y elija la alternativa que mejor resume la idea principal.',
  historia: 'A industrialização do século XIX transformou as relações de trabalho.',
  geografia: 'A urbanização acelerada gerou impactos ambientais nas metrópoles brasileiras.',
};

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

async function main() {
  const [enem] = await db
    .select()
    .from(schema.institutions)
    .where(eq(schema.institutions.slug, 'enem'));
  if (!enem) throw new Error('Rode `pnpm db:seed` antes (instituição ENEM ausente).');
  const subjects = await db.select().from(schema.subjects);
  const topics = await db.select().from(schema.topics);
  const subj = (slug: string) => {
    const s = subjects.find((x) => x.slug === slug);
    if (!s) throw new Error(`Matéria ausente: ${slug}`);
    return s;
  };

  let created = 0;
  const rand = lcg(42);

  async function upsertQuestion(opts: {
    externalId: string;
    examId: string | null;
    slug: string;
    number: number | null;
    status: 'published' | 'draft';
    withTopic: boolean;
    withParams: boolean;
    n: number;
  }) {
    const subject = subj(opts.slug);
    const correct = LETTERS[opts.n % 5]!;
    const [q] = await db
      .insert(schema.questions)
      .values({
        examId: opts.examId,
        subjectId: subject.id,
        number: opts.number,
        statement: `${THEMES[opts.slug] ?? 'Questão de teste.'} (fixture ${opts.externalId})`,
        status: opts.status,
        externalId: opts.externalId,
        sourceName: 'Fixture sintética',
        ...(opts.withParams ? { irtA: 0.8 + rand() * 1.4, irtB: -2 + rand() * 4, irtC: 0.15 } : {}),
      })
      .onConflictDoNothing()
      .returning({ id: schema.questions.id });
    if (!q) return;
    created++;
    await db.insert(schema.alternatives).values(
      LETTERS.map((letter) => ({
        questionId: q.id,
        letter,
        text: `Alternativa ${letter} da questão ${opts.externalId}`,
        isCorrect: letter === correct,
      })),
    );
    if (opts.withTopic) {
      const t = topics.find((x) => x.subjectId === subject.id && x.parentId === null);
      if (t) await db.insert(schema.questionTopics).values({ questionId: q.id, topicId: t.id });
    }
  }

  for (const spec of EXAMS) {
    const label = `ENEM ${spec.year} · ${spec.phase}`;
    const found = await db
      .select()
      .from(schema.exams)
      .where(
        and(
          eq(schema.exams.institutionId, enem.id),
          eq(schema.exams.year, spec.year),
          eq(schema.exams.label, label),
        ),
      );
    const exam =
      found[0] ??
      (
        await db
          .insert(schema.exams)
          .values({
            institutionId: enem.id,
            year: spec.year,
            phase: spec.phase,
            color: 'azul',
            label,
          })
          .returning()
      )[0]!;
    let number = 1;
    for (const [slug, count] of Object.entries(spec.subjects)) {
      // Inglês e Espanhol repetem a numeração 1..N, como no ENEM real
      const isLang = slug === 'ingles' || slug === 'espanhol';
      if (isLang) number = 1;
      for (let i = 0; i < count; i++) {
        await upsertQuestion({
          externalId: `fixture-${spec.year}-${spec.phase.replace(' ', '')}-${slug}-${i + 1}`,
          examId: exam.id,
          slug,
          number: number++,
          status: 'published',
          withTopic: true,
          withParams: true,
          n: i,
        });
      }
      if (slug === 'ingles') number = 6; // espanhol recomeça em 1; seguintes continuam após as 5 de línguas
    }
  }

  for (const [slug, count] of DRAFTS) {
    for (let i = 0; i < count; i++) {
      await upsertQuestion({
        externalId: `fixture-draft-${slug}-${i + 1}`,
        examId: null,
        slug,
        number: null,
        status: 'draft',
        withTopic: false,
        withParams: false,
        n: i,
      });
    }
  }
  console.log(`seed-fixtures: ${created} questões novas.`);
}

await main();
await sql.end();

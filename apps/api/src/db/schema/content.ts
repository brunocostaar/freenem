import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const questionStatusEnum = pgEnum('question_status', ['draft', 'reviewed', 'published']);
export const enemAreaEnum = pgEnum('enem_area', [
  'linguagens',
  'humanas',
  'natureza',
  'matematica',
]);
export const alternativeLetterEnum = pgEnum('alternative_letter', ['A', 'B', 'C', 'D', 'E']);

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const institutions = pgTable('institutions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  fullName: text('full_name'),
  websiteUrl: text('website_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const exams = pgTable(
  'exams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'restrict' }),
    year: integer('year').notNull(),
    /** ex.: "1º dia", "2ª fase", "Prova única" */
    phase: text('phase'),
    /** cor/caderno da prova (ENEM: azul, amarelo...) */
    color: text('color'),
    label: text('label').notNull(),
    sourceUrl: text('source_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('exams_unique_idx').on(t.institutionId, t.year, t.label),
    index('exams_institution_year_idx').on(t.institutionId, t.year),
  ],
);

export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  area: enemAreaEnum('area').notNull(),
  position: integer('position').notNull().default(0),
});

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => topics.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    uniqueIndex('topics_subject_slug_idx').on(t.subjectId, t.slug),
    index('topics_parent_idx').on(t.parentId),
  ],
);

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    number: integer('number'),
    /** Markdown + LaTeX (KaTeX) */
    statement: text('statement').notNull(),
    imageUrls: text('image_urls')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** resolução comentada (Markdown + LaTeX) */
    resolution: text('resolution'),
    status: questionStatusEnum('status').notNull().default('draft'),
    // Parâmetros TRI (só ENEM, vindos dos microdados do INEP)
    irtA: doublePrecision('irt_a'),
    irtB: doublePrecision('irt_b'),
    irtC: doublePrecision('irt_c'),
    // Atribuição da fonte
    sourceName: text('source_name'),
    sourceUrl: text('source_url'),
    sourceLicense: text('source_license'),
    /** chave natural p/ importação idempotente (ex.: "enem-2023-azul-91") */
    externalId: text('external_id').unique(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('portuguese', coalesce(statement, ''))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('questions_search_idx').using('gin', t.search),
    index('questions_exam_idx').on(t.examId),
    index('questions_subject_idx').on(t.subjectId),
    index('questions_status_idx').on(t.status),
    uniqueIndex('questions_exam_number_idx').on(t.examId, t.number),
  ],
);

export const alternatives = pgTable(
  'alternatives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    letter: alternativeLetterEnum('letter').notNull(),
    text: text('text').notNull(),
    imageUrl: text('image_url'),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (t) => [uniqueIndex('alternatives_question_letter_idx').on(t.questionId, t.letter)],
);

export const questionTopics = pgTable(
  'question_topics',
  {
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.topicId] }),
    index('question_topics_topic_idx').on(t.topicId),
  ],
);

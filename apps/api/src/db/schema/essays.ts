import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';

export const essayStatusEnum = pgEnum('essay_status', [
  'pending',
  'corrected',
  'flagged',
  'failed',
]);

export const essayThemes = pgTable('essay_themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull().unique(),
  year: integer('year'),
  description: text('description'),
  /** textos motivadores (Markdown) */
  supportingTexts: text('supporting_texts'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const essays = pgTable(
  'essays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => essayThemes.id, { onDelete: 'restrict' }),
    text: text('text').notNull(),
    status: essayStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('essays_user_idx').on(t.userId, t.createdAt)],
);

export const essayCorrections = pgTable(
  'essay_corrections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    essayId: uuid('essay_id')
      .notNull()
      .unique()
      .references(() => essays.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** data (America/Sao_Paulo) usada para limitar 1 correção por dia */
    correctionDate: date('correction_date').notNull(),
    c1: integer('c1'),
    c2: integer('c2'),
    c3: integer('c3'),
    c4: integer('c4'),
    c5: integer('c5'),
    totalScore: integer('total_score'),
    /** feedback por competência + geral (JSON validado pelo schema compartilhado) */
    feedback: jsonb('feedback'),
    injectionSuspected: boolean('injection_suspected').notNull().default(false),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('essay_corrections_user_date_idx').on(t.userId, t.correctionDate)],
);

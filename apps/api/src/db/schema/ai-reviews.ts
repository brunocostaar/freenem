import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { questions } from './content.js';

/** Revisão por IA (temporária): uma linha por execução; vale a mais recente de cada questão. */
export const questionAiReviews = pgTable(
  'question_ai_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    /** 'ok' | 'problem' | 'unsure' */
    verdict: text('verdict').notNull(),
    /** letra respondida pelo modelo */
    modelAnswer: text('model_answer'),
    answerMatches: boolean('answer_matches'),
    issues: jsonb('issues')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    summary: text('summary').notNull().default(''),
    costUsd: real('cost_usd'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('question_ai_reviews_question_idx').on(t.questionId, t.createdAt)],
);

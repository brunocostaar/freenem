import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { questions } from './content.js';

export const resolutionStatusEnum = pgEnum('resolution_status', [
  'pending',
  'approved',
  'rejected',
]);

/** Resoluções escritas pela comunidade (moderadas e votadas). */
export const questionResolutions = pgTable(
  'question_resolutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: resolutionStatusEnum('status').notNull().default('pending'),
    rejectReason: text('reject_reason'),
    /** soma dos votos (cache, recalculado a cada voto) */
    score: integer('score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    moderatedBy: text('moderated_by').references(() => user.id, { onDelete: 'set null' }),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
  },
  (t) => [
    // uma resolução por autor e questão
    unique('question_resolutions_author_question_unique').on(t.authorId, t.questionId),
    check('question_resolutions_body_len', sql`char_length(${t.body}) <= 8000`),
    index('question_resolutions_question_idx').on(t.questionId, t.status, t.score),
    index('question_resolutions_status_idx').on(t.status, t.createdAt),
  ],
);

export const resolutionVotes = pgTable(
  'resolution_votes',
  {
    resolutionId: uuid('resolution_id')
      .notNull()
      .references(() => questionResolutions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.resolutionId, t.userId] }),
    check('resolution_votes_value', sql`${t.value} in (-1, 1)`),
  ],
);

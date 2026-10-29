import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { alternativeLetterEnum, exams, questions } from './content.js';

export const simuladoModeEnum = pgEnum('simulado_mode', ['custom', 'official']);
export const attemptStatusEnum = pgEnum('attempt_status', ['in_progress', 'finished', 'abandoned']);

export const simulados = pgTable(
  'simulados',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    mode: simuladoModeEnum('mode').notNull(),
    examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }),
    filters: jsonb('filters'),
    questionCount: integer('question_count').notNull(),
    timeLimitMinutes: integer('time_limit_minutes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('simulados_user_idx').on(t.userId)],
);

export const simuladoQuestions = pgTable(
  'simulado_questions',
  {
    simuladoId: uuid('simulado_id')
      .notNull()
      .references(() => simulados.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.simuladoId, t.questionId] }),
    uniqueIndex('simulado_questions_position_idx').on(t.simuladoId, t.position),
  ],
);

export const simuladoAttempts = pgTable(
  'simulado_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    simuladoId: uuid('simulado_id')
      .notNull()
      .references(() => simulados.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: attemptStatusEnum('status').notNull().default('in_progress'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    rawScore: integer('raw_score'),
    triScore: doublePrecision('tri_score'),
  },
  (t) => [
    index('simulado_attempts_user_idx').on(t.userId),
    index('simulado_attempts_simulado_idx').on(t.simuladoId),
  ],
);

export const answers = pgTable(
  'answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    /** null = deixada em branco (em simulado) */
    chosenLetter: alternativeLetterEnum('chosen_letter'),
    isCorrect: boolean('is_correct').notNull(),
    timeSpentMs: integer('time_spent_ms'),
    simuladoAttemptId: uuid('simulado_attempt_id').references(() => simuladoAttempts.id, {
      onDelete: 'cascade',
    }),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('answers_user_answered_idx').on(t.userId, t.answeredAt),
    index('answers_user_question_idx').on(t.userId, t.questionId),
    index('answers_attempt_idx').on(t.simuladoAttemptId),
  ],
);

export const savedQuestions = pgTable(
  'saved_questions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] })],
);

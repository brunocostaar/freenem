import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { questions } from './content.js';

export const reportKindEnum = pgEnum('report_kind', [
  'gabarito_errado',
  'enunciado_incompleto',
  'imagem_quebrada',
  'classificacao_errada',
  'outro',
]);
export const reportStatusEnum = pgEnum('report_status', ['open', 'resolved', 'dismissed']);

/** Reportes de erro em questões (qualidade do banco, feitos pelos próprios alunos). */
export const questionReports = pgTable(
  'question_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: reportKindEnum('kind').notNull(),
    message: text('message').notNull().default(''),
    status: reportStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedBy: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    // um reporte aberto por aluno e questão
    uniqueIndex('question_reports_open_unique_idx')
      .on(t.userId, t.questionId)
      .where(sql`${t.status} = 'open'`),
    index('question_reports_question_idx').on(t.questionId),
    index('question_reports_status_idx').on(t.status, t.createdAt),
  ],
);

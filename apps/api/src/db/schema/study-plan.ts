import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { topics } from './content.js';

export const studyItemKindEnum = pgEnum('study_item_kind', ['theory', 'questions', 'review']);

export const studyPlans = pgTable(
  'study_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    examDate: date('exam_date').notNull(),
    hoursPerWeek: integer('hours_per_week').notNull(),
    /** 0 = domingo ... 6 = sábado */
    availableDays: integer('available_days').array().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('study_plans_user_idx').on(t.userId)],
);

export const studyPlanItems = pgTable(
  'study_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => studyPlans.id, { onDelete: 'cascade' }),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    week: integer('week').notNull(),
    kind: studyItemKindEnum('kind').notNull(),
    done: boolean('done').notNull().default(false),
    doneAt: timestamp('done_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => [index('study_plan_items_plan_week_idx').on(t.planId, t.week)],
);

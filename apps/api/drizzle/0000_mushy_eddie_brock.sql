CREATE TYPE "public"."user_role" AS ENUM('student', 'reviewer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."alternative_letter" AS ENUM('A', 'B', 'C', 'D', 'E');--> statement-breakpoint
CREATE TYPE "public"."enem_area" AS ENUM('linguagens', 'humanas', 'natureza', 'matematica');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'reviewed', 'published');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'finished', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."simulado_mode" AS ENUM('custom', 'official');--> statement-breakpoint
CREATE TYPE "public"."essay_status" AS ENUM('pending', 'corrected', 'flagged', 'failed');--> statement-breakpoint
CREATE TYPE "public"."study_item_kind" AS ENUM('theory', 'questions', 'review');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alternatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"letter" "alternative_letter" NOT NULL,
	"text" text NOT NULL,
	"image_url" text,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"phase" text,
	"color" text,
	"label" text NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "question_topics" (
	"question_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "question_topics_question_id_topic_id_pk" PRIMARY KEY("question_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid,
	"subject_id" uuid,
	"number" integer,
	"statement" text NOT NULL,
	"image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"resolution" text,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"irt_a" double precision,
	"irt_b" double precision,
	"irt_c" double precision,
	"source_name" text,
	"source_url" text,
	"source_license" text,
	"external_id" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(statement, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"area" "enem_area" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"question_id" uuid NOT NULL,
	"chosen_letter" "alternative_letter",
	"is_correct" boolean NOT NULL,
	"time_spent_ms" integer,
	"simulado_attempt_id" uuid,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_questions" (
	"user_id" text NOT NULL,
	"question_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_questions_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "simulado_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulado_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"raw_score" integer,
	"tri_score" double precision
);
--> statement-breakpoint
CREATE TABLE "simulado_questions" (
	"simulado_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "simulado_questions_simulado_id_question_id_pk" PRIMARY KEY("simulado_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "simulados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"mode" "simulado_mode" NOT NULL,
	"exam_id" uuid,
	"filters" jsonb,
	"question_count" integer NOT NULL,
	"time_limit_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essay_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"essay_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"correction_date" date NOT NULL,
	"c1" integer,
	"c2" integer,
	"c3" integer,
	"c4" integer,
	"c5" integer,
	"total_score" integer,
	"feedback" jsonb,
	"injection_suspected" boolean DEFAULT false NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "essay_corrections_essay_id_unique" UNIQUE("essay_id")
);
--> statement-breakpoint
CREATE TABLE "essay_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"description" text,
	"supporting_texts" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "essay_themes_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "essays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"theme_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" "essay_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"kind" "study_item_kind" NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"exam_date" date NOT NULL,
	"hours_per_week" integer NOT NULL,
	"available_days" integer[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alternatives" ADD CONSTRAINT "alternatives_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_topics" ADD CONSTRAINT "question_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_simulado_attempt_id_simulado_attempts_id_fk" FOREIGN KEY ("simulado_attempt_id") REFERENCES "public"."simulado_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "saved_questions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "saved_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulado_attempts" ADD CONSTRAINT "simulado_attempts_simulado_id_simulados_id_fk" FOREIGN KEY ("simulado_id") REFERENCES "public"."simulados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulado_attempts" ADD CONSTRAINT "simulado_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulado_questions" ADD CONSTRAINT "simulado_questions_simulado_id_simulados_id_fk" FOREIGN KEY ("simulado_id") REFERENCES "public"."simulados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulado_questions" ADD CONSTRAINT "simulado_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulados" ADD CONSTRAINT "simulados_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulados" ADD CONSTRAINT "simulados_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_corrections" ADD CONSTRAINT "essay_corrections_essay_id_essays_id_fk" FOREIGN KEY ("essay_id") REFERENCES "public"."essays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essay_corrections" ADD CONSTRAINT "essay_corrections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_theme_id_essay_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."essay_themes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_items" ADD CONSTRAINT "study_plan_items_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_items" ADD CONSTRAINT "study_plan_items_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "alternatives_question_letter_idx" ON "alternatives" USING btree ("question_id","letter");--> statement-breakpoint
CREATE UNIQUE INDEX "exams_unique_idx" ON "exams" USING btree ("institution_id","year","label");--> statement-breakpoint
CREATE INDEX "exams_institution_year_idx" ON "exams" USING btree ("institution_id","year");--> statement-breakpoint
CREATE INDEX "question_topics_topic_idx" ON "question_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "questions_search_idx" ON "questions" USING gin ("search");--> statement-breakpoint
CREATE INDEX "questions_exam_idx" ON "questions" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "questions_subject_idx" ON "questions" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "questions_status_idx" ON "questions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_exam_number_idx" ON "questions" USING btree ("exam_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_subject_slug_idx" ON "topics" USING btree ("subject_id","slug");--> statement-breakpoint
CREATE INDEX "topics_parent_idx" ON "topics" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "answers_user_answered_idx" ON "answers" USING btree ("user_id","answered_at");--> statement-breakpoint
CREATE INDEX "answers_user_question_idx" ON "answers" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "answers_attempt_idx" ON "answers" USING btree ("simulado_attempt_id");--> statement-breakpoint
CREATE INDEX "simulado_attempts_user_idx" ON "simulado_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "simulado_attempts_simulado_idx" ON "simulado_attempts" USING btree ("simulado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "simulado_questions_position_idx" ON "simulado_questions" USING btree ("simulado_id","position");--> statement-breakpoint
CREATE INDEX "simulados_user_idx" ON "simulados" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "essay_corrections_user_date_idx" ON "essay_corrections" USING btree ("user_id","correction_date");--> statement-breakpoint
CREATE INDEX "essays_user_idx" ON "essays" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "study_plan_items_plan_week_idx" ON "study_plan_items" USING btree ("plan_id","week");--> statement-breakpoint
CREATE INDEX "study_plans_user_idx" ON "study_plans" USING btree ("user_id");
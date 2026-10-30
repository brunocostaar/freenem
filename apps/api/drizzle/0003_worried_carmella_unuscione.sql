CREATE TYPE "public"."resolution_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "question_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"status" "resolution_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moderated_by" text,
	"moderated_at" timestamp with time zone,
	CONSTRAINT "question_resolutions_author_question_unique" UNIQUE("author_id","question_id"),
	CONSTRAINT "question_resolutions_body_len" CHECK (char_length("question_resolutions"."body") <= 8000)
);
--> statement-breakpoint
CREATE TABLE "resolution_votes" (
	"resolution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resolution_votes_resolution_id_user_id_pk" PRIMARY KEY("resolution_id","user_id"),
	CONSTRAINT "resolution_votes_value" CHECK ("resolution_votes"."value" in (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "question_resolutions" ADD CONSTRAINT "question_resolutions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_resolutions" ADD CONSTRAINT "question_resolutions_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_resolutions" ADD CONSTRAINT "question_resolutions_moderated_by_user_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_votes" ADD CONSTRAINT "resolution_votes_resolution_id_question_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."question_resolutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_votes" ADD CONSTRAINT "resolution_votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_resolutions_question_idx" ON "question_resolutions" USING btree ("question_id","status","score");--> statement-breakpoint
CREATE INDEX "question_resolutions_status_idx" ON "question_resolutions" USING btree ("status","created_at");
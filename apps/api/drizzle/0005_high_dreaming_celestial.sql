CREATE TABLE "question_ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"model" text NOT NULL,
	"verdict" text NOT NULL,
	"model_answer" text,
	"answer_matches" boolean,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"cost_usd" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_ai_reviews" ADD CONSTRAINT "question_ai_reviews_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_ai_reviews_question_idx" ON "question_ai_reviews" USING btree ("question_id","created_at");
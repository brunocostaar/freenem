DROP INDEX "questions_exam_number_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "questions_exam_number_idx" ON "questions" USING btree ("exam_id","number","subject_id");
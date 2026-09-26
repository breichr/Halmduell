ALTER TABLE "questions" ADD COLUMN "code" varchar(40);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_code_unique" UNIQUE("code");
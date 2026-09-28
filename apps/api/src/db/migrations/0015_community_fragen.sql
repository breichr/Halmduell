ALTER TABLE "questions" ADD COLUMN "eingereicht_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "rueckmeldung" text;--> statement-breakpoint
CREATE INDEX "questions_eingereicht_von_idx" ON "questions" USING btree ("eingereicht_von");
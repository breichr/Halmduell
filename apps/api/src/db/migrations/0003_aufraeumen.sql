ALTER TABLE "duels" DROP CONSTRAINT "duels_status_check";--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "zug_seit" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "aufgegeben_von" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wiederherstellungs_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_aufgegeben_von_users_id_fk" FOREIGN KEY ("aufgegeben_von") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "duel_questions_question_idx" ON "duel_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "duels_status_zug_idx" ON "duels" USING btree ("status","zug_seit");--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_status_check" CHECK ("duels"."status" in ('wartet_a', 'wartet_b', 'abgeschlossen', 'abgebrochen'));
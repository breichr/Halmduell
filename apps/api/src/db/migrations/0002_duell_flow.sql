ALTER TABLE "duel_answers" ALTER COLUMN "ist_richtig" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ALTER COLUMN "spieler_b_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "duel_answers" ADD COLUMN "gestellt_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "duel_answers" ADD COLUMN "beantwortet_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "einladungs_code" varchar(8);--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "rating_aenderung_a" smallint;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "rating_aenderung_b" smallint;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_einladungs_code_unique" UNIQUE("einladungs_code");--> statement-breakpoint
ALTER TABLE "duel_answers" ADD CONSTRAINT "duel_answers_beantwortet_check" CHECK (("duel_answers"."ist_richtig" is null) = ("duel_answers"."beantwortet_at" is null));
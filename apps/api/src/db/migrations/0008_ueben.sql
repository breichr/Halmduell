CREATE TABLE "uebungen" (
	"user_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"richtig_in_folge" smallint DEFAULT 0 NOT NULL,
	"geuebt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gemeistert_at" timestamp with time zone,
	CONSTRAINT "uebungen_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "uebungen" ADD CONSTRAINT "uebungen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uebungen" ADD CONSTRAINT "uebungen_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "platz_verlauf" (
	"user_id" integer NOT NULL,
	"kategorie" varchar(20) NOT NULL,
	"saison" integer NOT NULL,
	"tag" date NOT NULL,
	"platz" integer NOT NULL,
	CONSTRAINT "platz_verlauf_user_id_kategorie_saison_tag_pk" PRIMARY KEY("user_id","kategorie","saison","tag")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "zuletzt_aktiv_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platz_verlauf" ADD CONSTRAINT "platz_verlauf_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platz_verlauf_tag_idx" ON "platz_verlauf" USING btree ("tag");
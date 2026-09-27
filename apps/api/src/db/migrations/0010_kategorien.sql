ALTER TABLE "duels" DROP CONSTRAINT "duels_kategorie_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_kategorie_check";--> statement-breakpoint
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_kategorie_check";--> statement-breakpoint
-- Neue Kategorien: Landtechnik, Pflanzenbau, Viehzucht (+ Gemischt als Duellart).
-- Bisherige Fragen werden zugeordnet; Codes bleiben unverändert.
UPDATE "questions" SET "kategorie" = 'landtechnik' WHERE "code" IN ('wissen-007', 'wissen-024', 'wissen-027');--> statement-breakpoint
UPDATE "questions" SET "kategorie" = 'viehzucht' WHERE "code" = 'wissen-017';--> statement-breakpoint
UPDATE "questions" SET "kategorie" = 'pflanzenbau' WHERE "kategorie" IN ('kulturen', 'schaedlinge', 'krankheiten', 'wissen');--> statement-breakpoint
-- Gespielte Duelle: frühere Pflanzenthemen → Pflanzenbau, Allgemeinwissen → Gemischt
UPDATE "duels" SET "kategorie" = 'pflanzenbau' WHERE "kategorie" IN ('kulturen', 'schaedlinge', 'krankheiten');--> statement-breakpoint
UPDATE "duels" SET "kategorie" = 'gemischt' WHERE "kategorie" = 'wissen';--> statement-breakpoint
-- Kategorie-Ratings starten neu, Gesamt bleibt
DELETE FROM "ratings" WHERE "kategorie" <> 'gesamt';--> statement-breakpoint
DELETE FROM "platz_verlauf" WHERE "kategorie" <> 'gesamt';--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_kategorie_check" CHECK ("duels"."kategorie" in ('landtechnik', 'pflanzenbau', 'viehzucht', 'gemischt'));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_kategorie_check" CHECK ("questions"."kategorie" in ('landtechnik', 'pflanzenbau', 'viehzucht'));--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_kategorie_check" CHECK ("ratings"."kategorie" in ('gesamt', 'landtechnik', 'pflanzenbau', 'viehzucht'));
import { type SQL, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  DUELL_KATEGORIEN,
  DUELL_STATUS,
  FRAGE_STATUS,
  FRAGE_TYPEN,
  FRAGEN_KATEGORIEN,
  FREUNDSCHAFT_STATUS,
  RATING_KATEGORIEN,
  type DuellKategorie,
  type DuellStatus,
  type FragenKategorie,
  type FrageStatus,
  type FrageTyp,
  type FreundschaftStatus,
  type RatingKategorie,
} from '@halmduell/shared';

/** CHECK-Bedingung "spalte IN (...)" aus den Konstanten in @halmduell/shared */
function erlaubteWerte(spalte: AnyPgColumn, werte: readonly string[]): SQL {
  return sql`${spalte} in (${sql.raw(werte.map((w) => `'${w}'`).join(', '))})`;
}

const zeitstempel = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  createdAt: zeitstempel('created_at').notNull().defaultNow(),
});

export const questions = pgTable('questions', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  kategorie: varchar('kategorie', { length: 20 }).$type<FragenKategorie>().notNull(),
  typ: varchar('typ', { length: 10 }).$type<FrageTyp>().notNull(),
  frageText: text('frage_text').notNull(),
  bildUrl: text('bild_url'),
  bildQuelle: text('bild_quelle'), // Attribution, z. B. "Wikimedia Commons, CC-BY-SA, Autor XY"
  schwierigkeit: smallint('schwierigkeit').notNull().default(1),
  erklaerung: text('erklaerung'),
  status: varchar('status', { length: 20 }).$type<FrageStatus>().notNull().default('freigegeben'), // für Community-Einreichung
  eingereichtVon: integer('eingereicht_von').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  check('questions_kategorie_check', erlaubteWerte(t.kategorie, FRAGEN_KATEGORIEN)),
  check('questions_typ_check', erlaubteWerte(t.typ, FRAGE_TYPEN)),
  check('questions_status_check', erlaubteWerte(t.status, FRAGE_STATUS)),
  check('questions_schwierigkeit_check', sql`${t.schwierigkeit} between 1 and 5`),
  check('questions_bild_check', sql`${t.typ} <> 'bild' or ${t.bildUrl} is not null`),
  // Fragenauswahl fürs Duell: freigegebene Fragen je Kategorie
  index('questions_kategorie_status_idx').on(t.kategorie, t.status),
]);

export const answerOptions = pgTable('answer_options', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  text: varchar('text', { length: 100 }).notNull(),
  istRichtig: boolean('ist_richtig').notNull(),
}, (t) => [
  index('answer_options_question_idx').on(t.questionId),
  // höchstens eine richtige Antwort pro Frage
  uniqueIndex('answer_options_eine_richtige_idx').on(t.questionId).where(sql`${t.istRichtig}`),
]);

export const duels = pgTable('duels', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  spielerAId: integer('spieler_a_id').notNull().references(() => users.id),
  spielerBId: integer('spieler_b_id').notNull().references(() => users.id),
  kategorie: varchar('kategorie', { length: 20 }).$type<DuellKategorie>().notNull(),
  status: varchar('status', { length: 20 }).$type<DuellStatus>().notNull().default('wartet_a'),
  erstelltAt: zeitstempel('erstellt_at').notNull().defaultNow(),
  abgeschlossenAt: zeitstempel('abgeschlossen_at'),
  // gesetzt, sobald das ELO-Update gelaufen ist – verhindert doppelte Wertung
  gewertetAt: zeitstempel('gewertet_at'),
}, (t) => [
  check('duels_kategorie_check', erlaubteWerte(t.kategorie, DUELL_KATEGORIEN)),
  check('duels_status_check', erlaubteWerte(t.status, DUELL_STATUS)),
  check('duels_verschiedene_spieler_check', sql`${t.spielerAId} <> ${t.spielerBId}`),
  // Dashboard: laufende Duelle eines Spielers (als A oder B)
  index('duels_spieler_a_idx').on(t.spielerAId, t.status),
  index('duels_spieler_b_idx').on(t.spielerBId, t.status),
]);

export const duelQuestions = pgTable('duel_questions', {
  duelId: integer('duel_id').notNull().references(() => duels.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id),
  reihenfolge: smallint('reihenfolge').notNull(),
}, (t) => [
  primaryKey({ columns: [t.duelId, t.reihenfolge] }),
  check('duel_questions_reihenfolge_check', sql`${t.reihenfolge} between 1 and 6`),
  // dieselbe Frage nicht zweimal im selben Duell
  uniqueIndex('duel_questions_frage_idx').on(t.duelId, t.questionId),
]);

export const duelAnswers = pgTable('duel_answers', {
  duelId: integer('duel_id').notNull().references(() => duels.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  // NULL = Zeit abgelaufen, keine Antwort gewählt
  answerOptionId: integer('answer_option_id').references(() => answerOptions.id),
  antwortzeitMs: integer('antwortzeit_ms'),
  istRichtig: boolean('ist_richtig').notNull(),
}, (t) => [
  primaryKey({ columns: [t.duelId, t.userId, t.questionId] }),
  // Statistik-Screen: Trefferquote je Spieler
  index('duel_answers_user_idx').on(t.userId),
]);

export const ratings = pgTable('ratings', {
  userId: integer('user_id').notNull().references(() => users.id),
  kategorie: varchar('kategorie', { length: 20 }).$type<RatingKategorie>().notNull(),
  saison: integer('saison').notNull(),
  rating: integer('rating').notNull().default(1000),
  duelleGespielt: integer('duelle_gespielt').notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.userId, t.kategorie, t.saison] }),
  check('ratings_kategorie_check', erlaubteWerte(t.kategorie, RATING_KATEGORIEN)),
  // Bestenliste je Kategorie und Saison
  index('ratings_bestenliste_idx').on(t.kategorie, t.saison, t.rating.desc()),
]);

export const friendships = pgTable('friendships', {
  userId: integer('user_id').notNull().references(() => users.id),
  friendId: integer('friend_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).$type<FreundschaftStatus>().notNull().default('angefragt'),
  erstelltAt: zeitstempel('erstellt_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.friendId] }),
  check('friendships_status_check', erlaubteWerte(t.status, FREUNDSCHAFT_STATUS)),
  check('friendships_nicht_selbst_check', sql`${t.userId} <> ${t.friendId}`),
  // Freundesliste/Anfragen aus Sicht des Empfängers
  index('friendships_friend_idx').on(t.friendId),
]);

export const achievements = pgTable('achievements', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  key: varchar('key', { length: 50 }).notNull().unique(),
  titel: varchar('titel', { length: 100 }).notNull(),
  beschreibung: text('beschreibung'),
  icon: varchar('icon', { length: 50 }),
});

export const userAchievements = pgTable('user_achievements', {
  userId: integer('user_id').notNull().references(() => users.id),
  achievementId: integer('achievement_id').notNull().references(() => achievements.id),
  erreichtAt: zeitstempel('erreicht_at').notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.achievementId] }),
]);

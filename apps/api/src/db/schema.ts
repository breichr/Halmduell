import { type SQL, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
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
  MELDUNG_GRUENDE,
  MELDUNG_STATUS,
  RATING_KATEGORIEN,
  type DuellKategorie,
  type DuellStatus,
  type FragenKategorie,
  type FrageStatus,
  type FrageTyp,
  type FreundschaftStatus,
  type MeldungGrund,
  type MeldungStatus,
  type RatingKategorie,
} from '@halmduell/shared';

/** CHECK-Bedingung "spalte IN (...)" aus den Konstanten in @halmduell/shared */
function erlaubteWerte(spalte: AnyPgColumn, werte: readonly string[]): SQL {
  return sql`${spalte} in (${sql.raw(werte.map((w) => `'${w}'`).join(', '))})`;
}

const zeitstempel = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  username: varchar('username', { length: 50 }).notNull(),
  passwortHash: text('passwort_hash').notNull(), // argon2id (Bun.password)
  // Hash des Wiederherstellungscodes für "Passwort vergessen"; NULL = kein Code hinterlegt
  wiederherstellungsHash: text('wiederherstellungs_hash'),
  // steckt in jedem Token; Erhöhen macht alle bestehenden Sessions ungültig
  sessionVersion: integer('session_version').notNull().default(0),
  createdAt: zeitstempel('created_at').notNull().defaultNow(),
  // zuletzt in der App aktiv (höchstens alle paar Minuten aktualisiert) – nur für Freunde sichtbar
  zuletztAktivAt: zeitstempel('zuletzt_aktiv_at'),
}, (t) => [
  // "Anna" und "anna" sind derselbe Name
  uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
]);

export const questions = pgTable('questions', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  // stabiler Schlüssel aus fragen/fragen.csv (NULL bei später eingereichten Community-Fragen)
  code: varchar('code', { length: 40 }).unique(),
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
  // NULL, solange ein per Einladungscode erstelltes Duell noch keinen Gegner hat
  spielerBId: integer('spieler_b_id').references(() => users.id),
  einladungsCode: varchar('einladungs_code', { length: 8 }).unique(),
  kategorie: varchar('kategorie', { length: 20 }).$type<DuellKategorie>().notNull(),
  status: varchar('status', { length: 20 }).$type<DuellStatus>().notNull().default('wartet_a'),
  erstelltAt: zeitstempel('erstellt_at').notNull().defaultNow(),
  abgeschlossenAt: zeitstempel('abgeschlossen_at'),
  // gesetzt, sobald das ELO-Update gelaufen ist – verhindert doppelte Wertung
  gewertetAt: zeitstempel('gewertet_at'),
  // Änderung des Gesamt-Ratings durch dieses Duell (für den Ergebnis-Screen)
  ratingAenderungA: smallint('rating_aenderung_a'),
  ratingAenderungB: smallint('rating_aenderung_b'),
  // Beginn des aktuellen Zugs – nach Ablauf der Frist verliert, wer am Zug ist
  zugSeit: zeitstempel('zug_seit').notNull().defaultNow(),
  // gesetzt bei Aufgabe oder Fristablauf; dieser Spieler verliert unabhängig von den Punkten
  aufgegebenVon: integer('aufgegeben_von').references(() => users.id),
  // Push: Erinnerung vor Fristablauf für den aktuellen Zug verschickt (gilt, solange >= zug_seit)
  erinnertAt: zeitstempel('erinnert_at'),
  // Push: zuletzt angestupst (Sperre gegen Dauer-Anstupsen)
  angestupstAt: zeitstempel('angestupst_at'),
}, (t) => [
  check('duels_kategorie_check', erlaubteWerte(t.kategorie, DUELL_KATEGORIEN)),
  check('duels_status_check', erlaubteWerte(t.status, DUELL_STATUS)),
  check('duels_verschiedene_spieler_check', sql`${t.spielerAId} <> ${t.spielerBId}`),
  // Dashboard: laufende Duelle eines Spielers (als A oder B)
  index('duels_spieler_a_idx').on(t.spielerAId, t.status),
  index('duels_spieler_b_idx').on(t.spielerBId, t.status),
  // Fristen-Job: laufende Duelle nach Zugbeginn
  index('duels_status_zug_idx').on(t.status, t.zugSeit),
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
  // Fragenauswahl: schon gesehene Fragen erkennen
  index('duel_questions_question_idx').on(t.questionId),
]);

export const duelAnswers = pgTable('duel_answers', {
  duelId: integer('duel_id').notNull().references(() => duels.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  // Zeitpunkt, zu dem die Frage ausgeliefert wurde – Basis für den serverseitigen Timer
  gestelltAt: zeitstempel('gestellt_at').notNull().defaultNow(),
  beantwortetAt: zeitstempel('beantwortet_at'),
  // NULL = Zeit abgelaufen, keine Antwort gewählt
  answerOptionId: integer('answer_option_id').references(() => answerOptions.id),
  antwortzeitMs: integer('antwortzeit_ms'),
  // NULL, solange die Frage gestellt, aber noch nicht beantwortet ist
  istRichtig: boolean('ist_richtig'),
}, (t) => [
  primaryKey({ columns: [t.duelId, t.userId, t.questionId] }),
  check('duel_answers_beantwortet_check', sql`(${t.istRichtig} is null) = (${t.beantwortetAt} is null)`),
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
  // je Paar nur eine Zeile, egal wer angefragt hat
  uniqueIndex('friendships_paar_idx').on(sql`least(${t.userId}, ${t.friendId})`, sql`greatest(${t.userId}, ${t.friendId})`),
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
  // Duell, durch das es erreicht wurde (für „Neues Abzeichen!“ im Ergebnis); sonst NULL
  duelId: integer('duel_id').references(() => duels.id, { onDelete: 'set null' }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.achievementId] }),
]);

// Web-Push-Abos: eins je Gerät/Browser
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  erstelltAt: zeitstempel('erstellt_at').notNull().defaultNow(),
}, (t) => [
  index('push_subscriptions_user_idx').on(t.userId),
]);

// Fehler üben: Stand je Spieler und Frage (die Frage selbst kommt aus falschen Duell-Antworten)
export const uebungen = pgTable('uebungen', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id),
  // richtige Antworten in Folge seit dem letzten Fehler
  richtigInFolge: smallint('richtig_in_folge').notNull().default(0),
  geuebtAt: zeitstempel('geuebt_at').notNull().defaultNow(),
  // gesetzt, sobald oft genug in Folge richtig; ein späterer Fehler im Duell holt die Frage zurück
  gemeistertAt: zeitstempel('gemeistert_at'),
}, (t) => [
  primaryKey({ columns: [t.userId, t.questionId] }),
]);

// Täglicher Schnappschuss der Plätze (laufende Saison) – für „↑ 2 Plätze seit gestern“
export const platzVerlauf = pgTable('platz_verlauf', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kategorie: varchar('kategorie', { length: 20 }).$type<RatingKategorie>().notNull(),
  saison: integer('saison').notNull(),
  // Kalendertag (deutsche Zeit), an dessen Beginn der Schnappschuss entstand
  tag: date('tag').notNull(),
  platz: integer('platz').notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.kategorie, t.saison, t.tag] }),
  index('platz_verlauf_tag_idx').on(t.tag),
]);

// Spieler melden Fragen (z. B. „die richtige Antwort stimmt nicht“); Admins arbeiten sie im Portal ab
export const frageMeldungen = pgTable('frage_meldungen', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  grund: varchar('grund', { length: 20 }).$type<MeldungGrund>().notNull(),
  kommentar: text('kommentar'),
  status: varchar('status', { length: 20 }).$type<MeldungStatus>().notNull().default('offen'),
  erstelltAt: zeitstempel('erstellt_at').notNull().defaultNow(),
  abgeschlossenAt: zeitstempel('abgeschlossen_at'),
  abgeschlossenVon: integer('abgeschlossen_von').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  check('frage_meldungen_grund_check', erlaubteWerte(t.grund, MELDUNG_GRUENDE)),
  check('frage_meldungen_status_check', erlaubteWerte(t.status, MELDUNG_STATUS)),
  // je Spieler und Frage höchstens eine offene Meldung (erneutes Melden aktualisiert sie)
  uniqueIndex('frage_meldungen_offen_idx').on(t.questionId, t.userId).where(sql`${t.status} = 'offen'`),
  // Tageslimit je Spieler
  index('frage_meldungen_user_idx').on(t.userId, t.erstelltAt),
]);

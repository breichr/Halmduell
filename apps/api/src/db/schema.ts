import { pgTable, serial, integer, varchar, text, boolean, timestamp, smallint, primaryKey } from 'drizzle-orm/pg-core';

export type FragenKategorie = 'kulturen' | 'schaedlinge' | 'krankheiten' | 'wissen';
export type DuellKategorie = FragenKategorie | 'gemischt';
/** 'gemischt'-Duelle zählen nur für 'gesamt', es gibt kein eigenes Rating dafür */
export type RatingKategorie = 'gesamt' | FragenKategorie;
export type DuellStatus = 'wartet_a' | 'wartet_b' | 'abgeschlossen';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  kategorie: varchar('kategorie', { length: 20 }).$type<FragenKategorie>().notNull(),
  typ: varchar('typ', { length: 10 }).notNull(),               // 'bild' | 'text'
  frageText: text('frage_text').notNull(),
  bildUrl: varchar('bild_url', { length: 255 }),
  bildQuelle: varchar('bild_quelle', { length: 255 }),
  schwierigkeit: smallint('schwierigkeit').default(1),
  erklaerung: text('erklaerung'),
  status: varchar('status', { length: 20 }).default('freigegeben'), // für Community-Einreichung
  eingereichtVon: integer('eingereicht_von').references(() => users.id, { onDelete: 'set null' }),
});

export const answerOptions = pgTable('answer_options', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  text: varchar('text', { length: 100 }).notNull(),
  istRichtig: boolean('ist_richtig').notNull(),
});

export const duels = pgTable('duels', {
  id: serial('id').primaryKey(),
  spielerAId: integer('spieler_a_id').notNull().references(() => users.id),
  spielerBId: integer('spieler_b_id').notNull().references(() => users.id),
  kategorie: varchar('kategorie', { length: 20 }).$type<DuellKategorie>().notNull(),
  status: varchar('status', { length: 20 }).$type<DuellStatus>().notNull().default('wartet_a'),
  erstelltAt: timestamp('erstellt_at').defaultNow(),
  abgeschlossenAt: timestamp('abgeschlossen_at'),
  // gesetzt, sobald das ELO-Update gelaufen ist – verhindert doppelte Wertung
  gewertetAt: timestamp('gewertet_at'),
});

export const duelQuestions = pgTable('duel_questions', {
  duelId: integer('duel_id').notNull().references(() => duels.id, { onDelete: 'cascade' }),
  questionId: integer('question_id').notNull().references(() => questions.id),
  reihenfolge: smallint('reihenfolge').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.duelId, t.reihenfolge] }),
}));

export const duelAnswers = pgTable('duel_answers', {
  duelId: integer('duel_id').notNull().references(() => duels.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  questionId: integer('question_id').notNull().references(() => questions.id),
  answerOptionId: integer('answer_option_id').notNull().references(() => answerOptions.id),
  antwortzeitMs: integer('antwortzeit_ms'),
  istRichtig: boolean('ist_richtig').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.duelId, t.userId, t.questionId] }),
}));

export const ratings = pgTable('ratings', {
  userId: integer('user_id').notNull().references(() => users.id),
  kategorie: varchar('kategorie', { length: 20 }).$type<RatingKategorie>().notNull(),
  saison: integer('saison').notNull(),
  rating: integer('rating').notNull().default(1000),
  duelleGespielt: integer('duelle_gespielt').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.kategorie, t.saison] }),
}));

export const friendships = pgTable('friendships', {
  userId: integer('user_id').notNull().references(() => users.id),
  friendId: integer('friend_id').notNull().references(() => users.id),
  status: varchar('status', { length: 20 }).default('angefragt'), // 'angefragt' | 'bestaetigt'
  erstelltAt: timestamp('erstellt_at').defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.friendId] }),
}));

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 50 }).notNull().unique(),
  titel: varchar('titel', { length: 100 }).notNull(),
  beschreibung: text('beschreibung'),
  icon: varchar('icon', { length: 50 }),
});

export const userAchievements = pgTable('user_achievements', {
  userId: integer('user_id').notNull().references(() => users.id),
  achievementId: integer('achievement_id').notNull().references(() => achievements.id),
  erreichtAt: timestamp('erreicht_at').defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.achievementId] }),
}));

import { and, eq, isNotNull, lt, max, or, sql } from 'drizzle-orm';
import {
  ABZEICHEN,
  BLITZ_MS,
  EXPERTEN_ZIEL,
  FRAGEN_KATEGORIEN,
  FRAGEN_PRO_DUELL,
  KATEGORIE_ABZEICHEN,
  aktuelleSaison,
  liga,
  type FragenKategorie,
  type NeuesAbzeichen,
} from '@halmduell/shared';
import type { db } from '../db/client';
import { achievements, duelAnswers, friendships, questions, ratings, uebungen, userAchievements } from '../db/schema';
import type { Tx } from '../db/types';
import { duellAusgaenge, laengsteSiegesserie } from './ergebnisse';

type Q = Tx | typeof db;

/** Alles, woraus sich Abzeichen und ihr Fortschritt ergeben */
export interface AbzeichenWerte {
  duelle: number;
  siege: number;
  laengsteSerie: number;
  richtigJe: Record<FragenKategorie, number>;
  perfektesDuell: boolean;
  blitz: boolean;
  freunde: number;
  /** Fragen, die durch Üben gemeistert wurden */
  gemeistert: number;
  /** höchstes Gesamt-Rating in irgendeiner Saison */
  bestesGesamt: number | null;
  /** bester Gesamt-Platz am Ende einer abgeschlossenen Saison */
  besterSaisonPlatz: number | null;
}

export async function ermittleWerte(q: Q, ich: number): Promise<AbzeichenWerte> {
  const [ausgaenge, richtige, [perfekt], [blitz], [freunde], [gemeistert], [bestes], [saisonPlatz]] = await Promise.all([
    duellAusgaenge(q, ich),
    q.select({ kategorie: questions.kategorie, anzahl: sql<number>`count(*)::int` }).from(duelAnswers)
      .innerJoin(questions, eq(questions.id, duelAnswers.questionId))
      .where(and(eq(duelAnswers.userId, ich), eq(duelAnswers.istRichtig, true)))
      .groupBy(questions.kategorie),
    q.select({ duelId: duelAnswers.duelId }).from(duelAnswers)
      .where(and(eq(duelAnswers.userId, ich), eq(duelAnswers.istRichtig, true)))
      .groupBy(duelAnswers.duelId)
      .having(sql`count(*) >= ${FRAGEN_PRO_DUELL}`)
      .limit(1),
    q.select({ duelId: duelAnswers.duelId }).from(duelAnswers)
      .where(and(eq(duelAnswers.userId, ich), eq(duelAnswers.istRichtig, true), lt(duelAnswers.antwortzeitMs, BLITZ_MS)))
      .limit(1),
    q.select({ anzahl: sql<number>`count(*)::int` }).from(friendships)
      .where(and(eq(friendships.status, 'bestaetigt'), or(eq(friendships.userId, ich), eq(friendships.friendId, ich)))),
    q.select({ anzahl: sql<number>`count(*)::int` }).from(uebungen)
      .where(and(eq(uebungen.userId, ich), isNotNull(uebungen.gemeistertAt))),
    q.select({ rating: max(ratings.rating) }).from(ratings)
      .where(and(eq(ratings.userId, ich), eq(ratings.kategorie, 'gesamt'))),
    // Platz je abgeschlossener Saison (gleiches Rating = gleicher Platz, wie in der Rangliste)
    q.execute<{ platz: number | null }>(sql`
      select min(platz)::int as platz from (
        select ${ratings.userId} as user_id, rank() over (partition by ${ratings.saison} order by ${ratings.rating} desc) as platz
        from ${ratings}
        where ${ratings.kategorie} = 'gesamt' and ${ratings.saison} < ${aktuelleSaison()}
      ) p where user_id = ${ich}`),
  ]);

  const richtigJe = Object.fromEntries(FRAGEN_KATEGORIEN.map((k) => [k, 0])) as Record<FragenKategorie, number>;
  for (const r of richtige) richtigJe[r.kategorie] = r.anzahl;

  return {
    duelle: ausgaenge.length,
    siege: ausgaenge.filter((a) => a === 'sieg').length,
    laengsteSerie: laengsteSiegesserie(ausgaenge),
    richtigJe,
    perfektesDuell: !!perfekt,
    blitz: !!blitz,
    freunde: freunde?.anzahl ?? 0,
    gemeistert: gemeistert?.anzahl ?? 0,
    bestesGesamt: bestes?.rating ?? null,
    besterSaisonPlatz: saisonPlatz?.platz ?? null,
  };
}

/** Aktueller Stand für zählbare Abzeichen (sonst null) */
export function stand(key: string, w: AbzeichenWerte): number | null {
  const kategorie = FRAGEN_KATEGORIEN.find((k) => KATEGORIE_ABZEICHEN[k] === key);
  if (kategorie) return w.richtigJe[kategorie];
  switch (key) {
    case 'erstes_duell':
    case 'zehn_duelle':
    case 'fuenfzig_duelle':
      return w.duelle;
    case 'erster_sieg':
      return w.siege;
    case 'siegesserie':
      return w.laengsteSerie;
    case 'gesellig':
      return w.freunde;
    case 'nachgelernt':
      return w.gemeistert;
    default:
      return null;
  }
}

export function erfuellt(key: string, w: AbzeichenWerte): boolean {
  switch (key) {
    case 'liga_gold':
      return w.bestesGesamt !== null && ['Gold', 'Platin', 'Meister'].includes(liga(w.bestesGesamt));
    case 'saison_top10':
      return w.besterSaisonPlatz !== null && w.besterSaisonPlatz <= 10;
    case 'saison_meister':
      return w.besterSaisonPlatz === 1;
    case 'volle_scheune':
      return w.perfektesDuell;
    case 'blitzmerker':
      return w.blitz;
  }
  const ziel = ABZEICHEN.find((a) => a.key === key)?.ziel ?? EXPERTEN_ZIEL;
  const s = stand(key, w);
  return s !== null && s >= ziel;
}

/** Schlüssel der Abzeichen, die ein Spieler schon hat */
export async function erreichteKeys(q: Q, ich: number): Promise<Map<string, Date>> {
  const zeilen = await q.select({ key: achievements.key, erreichtAt: userAchievements.erreichtAt }).from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .where(eq(userAchievements.userId, ich));
  return new Map(zeilen.map((z) => [z.key, z.erreichtAt]));
}

/**
 * Prüft alle Abzeichen und vergibt neu erreichte. `duelId` merkt sich, welches
 * Duell sie ausgelöst hat (für den Ergebnis-Screen). Idempotent.
 */
export async function pruefeAbzeichen(q: Q, ich: number, duelId: number | null = null): Promise<NeuesAbzeichen[]> {
  const [werte, vorhanden] = await Promise.all([ermittleWerte(q, ich), erreichteKeys(q, ich)]);
  const neu = ABZEICHEN.filter((a) => !vorhanden.has(a.key) && erfuellt(a.key, werte));
  if (neu.length === 0) return [];

  // Katalog steht im Code; die Zeilen in `achievements` entstehen bzw. aktualisieren sich bei Bedarf
  const zeilen = await q.insert(achievements)
    .values(neu.map(({ key, titel, beschreibung, icon }) => ({ key, titel, beschreibung, icon })))
    .onConflictDoUpdate({
      target: achievements.key,
      set: { titel: sql`excluded.titel`, beschreibung: sql`excluded.beschreibung`, icon: sql`excluded.icon` },
    })
    .returning({ id: achievements.id, key: achievements.key });

  const vergeben = await q.insert(userAchievements)
    .values(zeilen.map((z) => ({ userId: ich, achievementId: z.id, duelId })))
    .onConflictDoNothing()
    .returning({ achievementId: userAchievements.achievementId });
  const vergebeneIds = new Set(vergeben.map((v) => v.achievementId));
  const vergebeneKeys = new Set(zeilen.filter((z) => vergebeneIds.has(z.id)).map((z) => z.key));
  return neu.filter((a) => vergebeneKeys.has(a.key)).map(({ key, titel, icon }) => ({ key, titel, icon }));
}

/** Abzeichen, die ein Spieler durch ein bestimmtes Duell erreicht hat */
export async function abzeichenAusDuell(q: Q, ich: number, duelId: number): Promise<NeuesAbzeichen[]> {
  const zeilen = await q.select({ key: achievements.key }).from(userAchievements)
    .innerJoin(achievements, eq(achievements.id, userAchievements.achievementId))
    .where(and(eq(userAchievements.userId, ich), eq(userAchievements.duelId, duelId), isNotNull(userAchievements.duelId)));
  const keys = new Set(zeilen.map((z) => z.key));
  return ABZEICHEN.filter((a) => keys.has(a.key)).map(({ key, titel, icon }) => ({ key, titel, icon }));
}

import { and, eq, sql } from 'drizzle-orm';
import { aktuelleSaison, type DuellWertung, type RatingKategorie } from '@halmduell/shared';
import { duels, duelAnswers, ratings } from '../db/schema';
import type { Tx } from '../db/types';
import { saisonalerSoftReset, START_RATING, updateElo } from './elo';

type Ergebnis = 0 | 0.5 | 1;
type Duell = typeof duels.$inferSelect;

/**
 * Liest das Rating der laufenden Saison (Zeile wird bis Transaktionsende gesperrt).
 * Gibt es noch keins, startet der Spieler mit dem Soft-Reset seines Vorsaison-Ratings.
 * `duelleInsgesamt` zählt über alle Saisons und steuert den K-Faktor.
 */
async function ladeRating(tx: Tx, userId: number, kategorie: RatingKategorie, saison: number) {
  const [aktuell] = await tx.select().from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.kategorie, kategorie), eq(ratings.saison, saison)))
    .for('update');
  const [summe] = await tx.select({ anzahl: sql<number>`coalesce(sum(${ratings.duelleGespielt}), 0)::int` }).from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.kategorie, kategorie)));
  const duelleInsgesamt = summe?.anzahl ?? 0;
  if (aktuell) return { rating: aktuell.rating, duelleInsgesamt };

  const [vorsaison] = await tx.select().from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.kategorie, kategorie), eq(ratings.saison, saison - 1)));
  return {
    rating: vorsaison ? saisonalerSoftReset(vorsaison.rating) : START_RATING,
    duelleInsgesamt,
  };
}

async function speichereRating(tx: Tx, userId: number, kategorie: RatingKategorie, saison: number, rating: number) {
  await tx.insert(ratings).values({
    userId,
    kategorie,
    saison,
    rating,
    duelleGespielt: 1,
  }).onConflictDoUpdate({
    target: [ratings.userId, ratings.kategorie, ratings.saison],
    set: { rating, duelleGespielt: sql`${ratings.duelleGespielt} + 1` },
  });
}

async function punkte(tx: Tx, duelId: number, userId: number): Promise<number> {
  const [zeile] = await tx.select({ anzahl: sql<number>`count(*)::int` }).from(duelAnswers)
    .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, userId), eq(duelAnswers.istRichtig, true)));
  return zeile?.anzahl ?? 0;
}

/**
 * ELO-Update für ein abgeschlossenes Duell. Der Aufrufer muss die Duell-Zeile in
 * derselben Transaktion gesperrt haben (SELECT … FOR UPDATE).
 */
export async function werteDuell(tx: Tx, duel: Duell): Promise<DuellWertung> {
  if (duel.status !== 'abgeschlossen' || duel.spielerBId === null) throw new Error(`Duell ${duel.id} ist nicht abgeschlossen`);
  if (duel.gewertetAt) throw new Error(`Duell ${duel.id} wurde bereits gewertet`);
  const spielerBId = duel.spielerBId;

  const punkteA = await punkte(tx, duel.id, duel.spielerAId);
  const punkteB = await punkte(tx, duel.id, spielerBId);
  // Aufgabe/Fristablauf entscheidet unabhängig vom Punktestand
  const ergebnisA: Ergebnis = duel.aufgegebenVon !== null
    ? (duel.aufgegebenVon === duel.spielerAId ? 0 : 1)
    : punkteA > punkteB ? 1 : punkteA < punkteB ? 0 : 0.5;
  const ergebnisB = (1 - ergebnisA) as Ergebnis;

  const saison = aktuelleSaison();
  // 'gesamt' wird immer gewertet, die Duell-Kategorie zusätzlich (außer bei 'gemischt')
  const kategorien: RatingKategorie[] = duel.kategorie === 'gemischt' ? ['gesamt'] : ['gesamt', duel.kategorie];
  // Zeilen immer in derselben Reihenfolge (nach User-ID) sperren, um Deadlocks zu vermeiden
  const aZuerst = duel.spielerAId < spielerBId;

  const neueRatings: DuellWertung['ratings'] = {};
  let aenderungA = 0;
  let aenderungB = 0;
  for (const kategorie of kategorien) {
    let altA, altB;
    if (aZuerst) {
      altA = await ladeRating(tx, duel.spielerAId, kategorie, saison);
      altB = await ladeRating(tx, spielerBId, kategorie, saison);
    } else {
      altB = await ladeRating(tx, spielerBId, kategorie, saison);
      altA = await ladeRating(tx, duel.spielerAId, kategorie, saison);
    }

    const neuA = updateElo(altA.rating, altB.rating, ergebnisA, altA.duelleInsgesamt);
    const neuB = updateElo(altB.rating, altA.rating, ergebnisB, altB.duelleInsgesamt);

    await speichereRating(tx, duel.spielerAId, kategorie, saison, neuA);
    await speichereRating(tx, spielerBId, kategorie, saison, neuB);
    neueRatings[kategorie] = { a: neuA, b: neuB };
    if (kategorie === 'gesamt') {
      aenderungA = neuA - altA.rating;
      aenderungB = neuB - altB.rating;
    }
  }

  await tx.update(duels)
    .set({ gewertetAt: new Date(), ratingAenderungA: aenderungA, ratingAenderungB: aenderungB })
    .where(eq(duels.id, duel.id));

  return { punkteA, punkteB, saison, ratings: neueRatings };
}

import { Hono } from 'hono';
import { db } from '../db/client';
import type { DuellWertung, RatingKategorie } from '@halmduell/shared';
import { duels, duelAnswers, ratings } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { updateElo, saisonalerSoftReset, START_RATING } from '../services/elo';
import { aktuelleSaison } from '../services/saison';
import { requireAuth, type AuthEnv } from '../middleware/auth';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ergebnis = 0 | 0.5 | 1;

export const duelsRoute = new Hono<AuthEnv>();

duelsRoute.use(requireAuth);

/**
 * Liest das Rating der laufenden Saison (Zeile wird bis Transaktionsende gesperrt).
 * Gibt es noch keins, startet der Spieler mit dem Soft-Reset seines Vorsaison-Ratings.
 */
async function ladeRating(tx: Tx, userId: number, kategorie: RatingKategorie, saison: number) {
  const [aktuell] = await tx.select().from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.kategorie, kategorie), eq(ratings.saison, saison)))
    .for('update');
  if (aktuell) return { rating: aktuell.rating, duelleGespielt: aktuell.duelleGespielt };

  const [vorsaison] = await tx.select().from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.kategorie, kategorie), eq(ratings.saison, saison - 1)));
  return {
    rating: vorsaison ? saisonalerSoftReset(vorsaison.rating) : START_RATING,
    duelleGespielt: 0,
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

duelsRoute.post('/:id/complete', async (c) => {
  const duelId = Number(c.req.param('id'));
  if (!Number.isInteger(duelId)) return c.json({ error: 'Ungültige Duell-ID' }, 400);

  return db.transaction(async (tx) => {
    // Duell sperren, damit parallele Aufrufe nicht doppelt werten
    const [duel] = await tx.select().from(duels).where(eq(duels.id, duelId)).for('update');
    if (!duel) return c.json({ error: 'Duell nicht gefunden' }, 404);
    if (c.var.userId !== duel.spielerAId && c.var.userId !== duel.spielerBId) {
      return c.json({ error: 'Kein Teilnehmer dieses Duells' }, 403);
    }
    if (duel.status !== 'abgeschlossen') {
      return c.json({ error: 'Duell noch nicht von beiden Seiten beantwortet' }, 400);
    }
    if (duel.gewertetAt) return c.json({ error: 'Duell wurde bereits gewertet' }, 409);

    const antwortenA = await tx.select().from(duelAnswers)
      .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, duel.spielerAId)));
    const antwortenB = await tx.select().from(duelAnswers)
      .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, duel.spielerBId)));

    const punkteA = antwortenA.filter((a) => a.istRichtig).length;
    const punkteB = antwortenB.filter((a) => a.istRichtig).length;

    const ergebnisA: Ergebnis = punkteA > punkteB ? 1 : punkteA < punkteB ? 0 : 0.5;
    const ergebnisB = (1 - ergebnisA) as Ergebnis;

    const saison = aktuelleSaison();
    // 'gesamt' wird immer gewertet, die Duell-Kategorie zusätzlich (außer bei 'gemischt')
    const kategorien: RatingKategorie[] = duel.kategorie === 'gemischt' ? ['gesamt'] : ['gesamt', duel.kategorie];
    // Zeilen immer in derselben Reihenfolge (nach User-ID) sperren, um Deadlocks zu vermeiden
    const aZuerst = duel.spielerAId < duel.spielerBId;

    const neueRatings: DuellWertung['ratings'] = {};
    for (const kategorie of kategorien) {
      let altA, altB;
      if (aZuerst) {
        altA = await ladeRating(tx, duel.spielerAId, kategorie, saison);
        altB = await ladeRating(tx, duel.spielerBId, kategorie, saison);
      } else {
        altB = await ladeRating(tx, duel.spielerBId, kategorie, saison);
        altA = await ladeRating(tx, duel.spielerAId, kategorie, saison);
      }

      const neuA = updateElo(altA.rating, altB.rating, ergebnisA, altA.duelleGespielt);
      const neuB = updateElo(altB.rating, altA.rating, ergebnisB, altB.duelleGespielt);

      await speichereRating(tx, duel.spielerAId, kategorie, saison, neuA);
      await speichereRating(tx, duel.spielerBId, kategorie, saison, neuB);
      neueRatings[kategorie] = { a: neuA, b: neuB };
    }

    await tx.update(duels).set({ gewertetAt: new Date() }).where(eq(duels.id, duelId));

    return c.json({ punkteA, punkteB, saison, ratings: neueRatings } satisfies DuellWertung);
  });
});

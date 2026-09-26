import { Hono } from 'hono';
import { db } from '../db/client';
import { duels, duelAnswers, ratings } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { updateElo } from '../services/elo';

export const duelsRoute = new Hono();

duelsRoute.post('/:id/complete', async (c) => {
  const duelId = Number(c.req.param('id'));

  const duel = await db.query.duels.findFirst({ where: eq(duels.id, duelId) });
  if (!duel) return c.json({ error: 'Duell nicht gefunden' }, 404);
  if (duel.status !== 'abgeschlossen') {
    return c.json({ error: 'Duell noch nicht von beiden Seiten beantwortet' }, 400);
  }

  const antwortenA = await db.select().from(duelAnswers)
    .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, duel.spielerAId)));
  const antwortenB = await db.select().from(duelAnswers)
    .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, duel.spielerBId)));

  const punkteA = antwortenA.filter((a) => a.istRichtig).length;
  const punkteB = antwortenB.filter((a) => a.istRichtig).length;

  const ergebnisA = punkteA > punkteB ? 1 : punkteA < punkteB ? 0 : 0.5;
  const ergebnisB = (1 - ergebnisA) as 0 | 0.5 | 1;

  const ratingA = await db.query.ratings.findFirst({
    where: and(eq(ratings.userId, duel.spielerAId), eq(ratings.kategorie, duel.kategorie)),
  });
  const ratingB = await db.query.ratings.findFirst({
    where: and(eq(ratings.userId, duel.spielerBId), eq(ratings.kategorie, duel.kategorie)),
  });

  const neuA = updateElo(ratingA?.rating ?? 1000, ratingB?.rating ?? 1000, ergebnisA as 0 | 0.5 | 1, ratingA?.duelleGespielt ?? 0);
  const neuB = updateElo(ratingB?.rating ?? 1000, ratingA?.rating ?? 1000, ergebnisB, ratingB?.duelleGespielt ?? 0);

  // Upsert beider Ratings (vereinfacht dargestellt — Saison-Wert ggf. dynamisch ermitteln)
  await db.insert(ratings).values({
    userId: duel.spielerAId,
    kategorie: duel.kategorie,
    saison: 1,
    rating: neuA,
    duelleGespielt: (ratingA?.duelleGespielt ?? 0) + 1,
  }).onConflictDoUpdate({
    target: [ratings.userId, ratings.kategorie, ratings.saison],
    set: { rating: neuA },
  });

  await db.insert(ratings).values({
    userId: duel.spielerBId,
    kategorie: duel.kategorie,
    saison: 1,
    rating: neuB,
    duelleGespielt: (ratingB?.duelleGespielt ?? 0) + 1,
  }).onConflictDoUpdate({
    target: [ratings.userId, ratings.kategorie, ratings.saison],
    set: { rating: neuB },
  });

  return c.json({ punkteA, punkteB, neuA, neuB });
});

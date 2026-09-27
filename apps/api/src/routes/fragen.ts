import { Hono } from 'hono';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { MELDUNGEN_PRO_TAG, feldFehler, meldenSchema, type ApiFehler } from '@halmduell/shared';
import { db } from '../db/client';
import { duelAnswers, frageMeldungen } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';

/** Fragen aus Spielersicht – bisher nur Melden */
export const fragenRoute = new Hono<AuthEnv>();

fragenRoute.use(requireAuth);

const fehler = (error: string): ApiFehler => ({ error });

/**
 * Frage melden (z. B. „die richtige Antwort stimmt nicht“). Nur wer die Frage im Duell
 * beantwortet hat; eine offene Meldung je Spieler und Frage – erneutes Melden ändert sie.
 */
fragenRoute.post('/:id/melden', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json(fehler('Frage nicht gefunden'), 404);
  const eingabe = meldenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json({ error: 'Bitte die markierten Felder prüfen', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  const ich = c.var.userId;

  const [gespielt] = await db.select({ n: sql<number>`1` }).from(duelAnswers)
    .where(and(eq(duelAnswers.userId, ich), eq(duelAnswers.questionId, id), isNotNull(duelAnswers.istRichtig))).limit(1);
  if (!gespielt) return c.json(fehler('Du kannst nur Fragen melden, die du selbst beantwortet hast'), 403);

  const [offen] = await db.select({ id: frageMeldungen.id }).from(frageMeldungen)
    .where(and(eq(frageMeldungen.questionId, id), eq(frageMeldungen.userId, ich), eq(frageMeldungen.status, 'offen')));
  if (!offen) {
    const [heute] = await db.select({ n: sql<number>`count(*)::int` }).from(frageMeldungen)
      .where(and(eq(frageMeldungen.userId, ich), gt(frageMeldungen.erstelltAt, sql`now() - interval '1 day'`)));
    if ((heute?.n ?? 0) >= MELDUNGEN_PRO_TAG) return c.json(fehler('Heute hast du schon genug gemeldet – danke! Morgen geht es weiter.'), 429);
  }

  const { grund, kommentar } = eingabe.data;
  await db.insert(frageMeldungen).values({ questionId: id, userId: ich, grund, kommentar })
    .onConflictDoUpdate({
      target: [frageMeldungen.questionId, frageMeldungen.userId],
      targetWhere: sql`${frageMeldungen.status} = 'offen'`,
      set: { grund, kommentar },
    });
  return c.body(null, 204);
});

import { Hono } from 'hono';
import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  EINGEREICHT_OFFEN_MAX,
  MELDUNGEN_PRO_TAG,
  feldFehler,
  frageEinreichenSchema,
  meldenSchema,
  type ApiFehler,
  type EigeneFrage,
} from '@halmduell/shared';
import { db } from '../db/client';
import { answerOptions, duelAnswers, frageMeldungen, questions } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';

/** Fragen aus Spielersicht: melden, eigene Fragen einreichen */
export const fragenRoute = new Hono<AuthEnv>();

fragenRoute.use(requireAuth);

const fehler = (error: string): ApiFehler => ({ error });
const ungueltig = (e: Parameters<typeof feldFehler>[0]): ApiFehler => ({ error: 'Bitte die markierten Felder prüfen', felder: feldFehler(e) });

// --- Community-Fragen ---

/** Frage einreichen: landet als „eingereicht“ im Admin-Portal, wird erst nach Freigabe gespielt */
fragenRoute.post('/', async (c) => {
  const eingabe = frageEinreichenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const e = eingabe.data;
  const ich = c.var.userId;

  const ergebnis = await db.transaction(async (tx) => {
    // je Spieler nacheinander, damit das Limit auch bei Doppelklicks hält
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`einreichen-${ich}`}))`);
    const [offen] = await tx.select({ n: sql<number>`count(*)::int` }).from(questions)
      .where(and(eq(questions.eingereichtVon, ich), eq(questions.status, 'eingereicht')));
    if ((offen?.n ?? 0) >= EINGEREICHT_OFFEN_MAX) return { status: 429 as const };
    const [doppelt] = await tx.select({ id: questions.id }).from(questions)
      .where(eq(sql`lower(${questions.frageText})`, e.frage.toLowerCase())).limit(1);
    if (doppelt) return { status: 409 as const };

    const [neu] = await tx.insert(questions).values({
      kategorie: e.kategorie,
      typ: 'text',
      frageText: e.frage,
      erklaerung: e.erklaerung,
      status: 'eingereicht',
      eingereichtVon: ich,
      eingereichtAt: new Date(),
    }).returning();
    await tx.insert(answerOptions).values([
      { questionId: neu!.id, text: e.richtig, istRichtig: true },
      ...e.falsch.map((text) => ({ questionId: neu!.id, text, istRichtig: false })),
    ]);
    return { status: 201 as const, frage: neu! };
  });

  if (ergebnis.status === 429) {
    return c.json(fehler(`Du hast schon ${EINGEREICHT_OFFEN_MAX} Fragen, die noch geprüft werden – warte bitte, bis sie dran waren.`), 429);
  }
  if (ergebnis.status === 409) return c.json({ error: 'Diese Frage gibt es schon', felder: { frage: ['gibt es schon'] } } satisfies ApiFehler, 409);
  const f = ergebnis.frage;
  return c.json({
    id: f.id, kategorie: f.kategorie, frage: f.frageText, richtig: e.richtig, falsch: e.falsch, erklaerung: f.erklaerung,
    status: f.status, rueckmeldung: null, eingereichtAt: f.eingereichtAt!.toISOString(),
  } satisfies EigeneFrage, 201);
});

/** Eigene eingereichte Fragen, neueste zuerst */
fragenRoute.get('/eigene', async (c) => {
  const zeilen = await db.select().from(questions)
    .where(eq(questions.eingereichtVon, c.var.userId))
    .orderBy(desc(questions.eingereichtAt), desc(questions.id));
  const optionen = zeilen.length === 0 ? [] : await db.select().from(answerOptions)
    .where(inArray(answerOptions.questionId, zeilen.map((f) => f.id))).orderBy(asc(answerOptions.id));
  return c.json(zeilen.map((f) => {
    const eigene = optionen.filter((o) => o.questionId === f.id);
    const falsch = eigene.filter((o) => !o.istRichtig).map((o) => o.text);
    return {
      id: f.id,
      kategorie: f.kategorie,
      frage: f.frageText,
      richtig: eigene.find((o) => o.istRichtig)?.text ?? '',
      falsch: [falsch[0] ?? '', falsch[1] ?? '', falsch[2] ?? ''],
      erklaerung: f.erklaerung,
      status: f.status,
      rueckmeldung: f.rueckmeldung,
      eingereichtAt: (f.eingereichtAt ?? new Date(0)).toISOString(),
    };
  }) satisfies EigeneFrage[]);
});

/** Eingereichte Frage zurückziehen – nur solange sie noch nicht geprüft ist */
fragenRoute.delete('/eigene/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) return c.json(fehler('Frage nicht gefunden'), 404);
  const [frage] = await db.select({ status: questions.status }).from(questions)
    .where(and(eq(questions.id, id), eq(questions.eingereichtVon, c.var.userId)));
  if (!frage) return c.json(fehler('Frage nicht gefunden'), 404);
  if (frage.status !== 'eingereicht') return c.json(fehler('Nur Fragen, die noch geprüft werden, lassen sich zurückziehen'), 409);
  // Antwortoptionen und Meldungen hängen per ON DELETE CASCADE daran; gespielt wurde sie noch nie
  await db.delete(questions).where(eq(questions.id, id));
  return c.body(null, 204);
});

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

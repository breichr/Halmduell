import { Hono } from 'hono';
import { and, eq, isNotNull } from 'drizzle-orm';
import {
  FRAGEN_KATEGORIEN,
  UEBEN_ZIEL,
  feldFehler,
  uebenAntwortSchema,
  uebenFrageSchema,
  type ApiFehler,
  type UebenUebersicht,
  type UebungsErgebnis,
  type UebungsRunde,
} from '@halmduell/shared';
import { db } from '../db/client';
import { answerOptions, questions, uebungen } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { pruefeAbzeichen } from '../services/abzeichen';
import { mischen, offeneFragen, waehleNaechste } from '../services/ueben';

export const uebenRoute = new Hono<AuthEnv>();

uebenRoute.use(requireAuth);

const fehler = (error: string): ApiFehler => ({ error });

/** Übersicht: offene Fragen je Kategorie, bisher gemeistert */
uebenRoute.get('/', async (c) => {
  const ich = c.var.userId;
  const [offen, gemeisterte] = await Promise.all([
    offeneFragen(db, ich),
    db.select({ id: uebungen.questionId }).from(uebungen).where(and(eq(uebungen.userId, ich), isNotNull(uebungen.gemeistertAt))),
  ]);
  const offenIds = new Set(offen.map((f) => f.id));
  return c.json({
    offen: offen.length,
    jeKategorie: FRAGEN_KATEGORIEN.map((kategorie) => ({ kategorie, offen: offen.filter((f) => f.kategorie === kategorie).length })),
    // gemeistert, aber durch einen neuen Fehler im Duell wieder offen → zählt nicht
    gemeistert: gemeisterte.filter((g) => !offenIds.has(g.id)).length,
  } satisfies UebenUebersicht);
});

/** Nächste Frage zum Üben (ohne Timer, ohne Lösung) */
uebenRoute.get('/frage', async (c) => {
  const eingabe = uebenFrageSchema.safeParse(c.req.query());
  if (!eingabe.success) return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  const { kategorie, ohne } = eingabe.data;
  const offen = await offeneFragen(db, c.var.userId, { kategorie });
  const naechste = waehleNaechste(offen, ohne);
  if (!naechste) return c.json({ frage: null, offen: 0 } satisfies UebungsRunde);

  const [frage] = await db.select().from(questions).where(eq(questions.id, naechste.id));
  const optionen = await db.select({ id: answerOptions.id, text: answerOptions.text }).from(answerOptions)
    .where(eq(answerOptions.questionId, naechste.id));
  return c.json({
    frage: {
      frageId: frage!.id,
      kategorie: frage!.kategorie,
      typ: frage!.typ,
      frageText: frage!.frageText,
      bildUrl: frage!.bildUrl,
      bildQuelle: frage!.bildQuelle,
      antworten: mischen(optionen),
      richtigInFolge: naechste.richtigInFolge,
    },
    offen: offen.length,
  } satisfies UebungsRunde);
});

/**
 * Antwort beim Üben. Nur für Fragen, die gerade zum Üben offen sind – sonst
 * ließe sich hier die Lösung einer laufenden Duell-Frage nachschlagen.
 */
uebenRoute.post('/antwort', async (c) => {
  const eingabe = uebenAntwortSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  const { frageId, antwortId, kategorie } = eingabe.data;
  const ich = c.var.userId;

  const [imPool] = await offeneFragen(db, ich, { frageId });
  if (!imPool) return c.json(fehler('Diese Frage ist gerade nicht zum Üben offen'), 409);

  const optionen = await db.select().from(answerOptions).where(eq(answerOptions.questionId, frageId));
  const richtige = optionen.find((o) => o.istRichtig);
  if (!richtige) throw new Error(`Frage ${frageId} hat keine richtige Antwort`);
  if (!optionen.some((o) => o.id === antwortId)) return c.json(fehler('Antwort gehört nicht zu dieser Frage'), 400);

  const richtig = antwortId === richtige.id;
  const richtigInFolge = richtig ? imPool.richtigInFolge + 1 : 0;
  const gemeistert = richtigInFolge >= UEBEN_ZIEL;
  const jetzt = new Date();
  const stand = { richtigInFolge: gemeistert ? 0 : richtigInFolge, geuebtAt: jetzt, gemeistertAt: gemeistert ? jetzt : null };
  await db.insert(uebungen).values({ userId: ich, questionId: frageId, ...stand })
    .onConflictDoUpdate({ target: [uebungen.userId, uebungen.questionId], set: stand });

  const [neueAbzeichen, danach, [frage]] = await Promise.all([
    gemeistert ? pruefeAbzeichen(db, ich) : Promise.resolve([]),
    offeneFragen(db, ich, { kategorie }),
    db.select({ erklaerung: questions.erklaerung }).from(questions).where(eq(questions.id, frageId)),
  ]);
  return c.json({
    richtig,
    richtigeAntwortId: richtige.id,
    erklaerung: frage?.erklaerung ?? null,
    richtigInFolge,
    gemeistert,
    offen: danach.length,
    neueAbzeichen,
  } satisfies UebungsErgebnis);
});

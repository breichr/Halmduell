import { Hono } from 'hono';
import { and, asc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import {
  FRAGEN_KATEGORIEN,
  adminFragenFilterSchema,
  feldFehler,
  frageBearbeitenSchema,
  statusSetzenSchema,
  type AdminFrage,
  type AdminFragenListe,
  type AdminKategorieStand,
  type ApiFehler,
  type FrageBearbeiten,
  type FragenKategorie,
} from '@halmduell/shared';
import { db } from '../db/client';
import { answerOptions, duelAnswers, questions } from '../db/schema';
import type { Tx } from '../db/types';
import { schreibeFragenCsv, type FragenZeile } from '../fragen/csv';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { requireAdmin } from '../services/admin';

/** Admin-Portal: Fragen prüfen, bearbeiten, freigeben. Die Datenbank ist maßgeblich. */
export const adminRoute = new Hono<AuthEnv>();

adminRoute.use(requireAuth, requireAdmin);

const fehler = (error: string): ApiFehler => ({ error });
const ungueltig = (e: Parameters<typeof feldFehler>[0]): ApiFehler => ({ error: 'Bitte die markierten Felder prüfen', felder: feldFehler(e) });

function parseId(roh: string): number | null {
  const id = Number(roh);
  return Number.isInteger(id) && id > 0 ? id : null;
}

type Frage = typeof questions.$inferSelect;
type Option = typeof answerOptions.$inferSelect;

/** Fragen samt Antworten (richtige zuerst, falsche in fester Reihenfolge) und Duell-Statistik */
async function ladeFragen(q: Tx | typeof db, bedingung?: SQL): Promise<AdminFrage[]> {
  const zeilen = await q.select().from(questions).where(bedingung).orderBy(asc(questions.kategorie), asc(questions.code), asc(questions.id));
  if (zeilen.length === 0) return [];
  const ids = zeilen.map((f) => f.id);
  const [optionen, statistik] = await Promise.all([
    q.select().from(answerOptions).where(inArray(answerOptions.questionId, ids)).orderBy(asc(answerOptions.id)),
    q.select({
      id: duelAnswers.questionId,
      beantwortet: sql<number>`count(*)::int`,
      richtig: sql<number>`count(*) filter (where ${duelAnswers.istRichtig})::int`,
    }).from(duelAnswers).where(and(inArray(duelAnswers.questionId, ids), isNotNull(duelAnswers.istRichtig))).groupBy(duelAnswers.questionId),
  ]);
  const optionenVon = new Map<number, Option[]>();
  for (const o of optionen) optionenVon.set(o.questionId, [...(optionenVon.get(o.questionId) ?? []), o]);
  const statistikVon = new Map(statistik.map((s) => [s.id, s]));
  return zeilen.map((f) => alsAdminFrage(f, optionenVon.get(f.id) ?? [], statistikVon.get(f.id)));
}

function alsAdminFrage(f: Frage, optionen: Option[], statistik?: { beantwortet: number; richtig: number }): AdminFrage {
  const falsch = optionen.filter((o) => !o.istRichtig).map((o) => o.text);
  return {
    id: f.id,
    code: f.code,
    kategorie: f.kategorie,
    typ: f.typ,
    frage: f.frageText,
    richtig: optionen.find((o) => o.istRichtig)?.text ?? '',
    falsch: [falsch[0] ?? '', falsch[1] ?? '', falsch[2] ?? ''],
    erklaerung: f.erklaerung,
    schwierigkeit: f.schwierigkeit,
    bildUrl: f.bildUrl,
    bildQuelle: f.bildQuelle,
    status: f.status,
    statistik: { beantwortet: statistik?.beantwortet ?? 0, richtig: statistik?.richtig ?? 0 },
  };
}

const felderAus = (e: FrageBearbeiten) => ({
  kategorie: e.kategorie,
  typ: e.typ,
  frageText: e.frage,
  erklaerung: e.erklaerung,
  schwierigkeit: e.schwierigkeit,
  bildUrl: e.bildUrl,
  bildQuelle: e.bildQuelle,
  status: e.status,
});

/** Nächster freier Code je Kategorie, z. B. „wissen-028“ (wie in fragen.csv) */
async function naechsterCode(tx: Tx, kategorie: FragenKategorie): Promise<string> {
  const [zeile] = await tx.execute<{ max: number | null }>(sql`
    select max(substring(code from ${`^${kategorie}-(\\d+)$`})::int) as max from questions where code like ${`${kategorie}-%`}`);
  return `${kategorie}-${String((zeile?.max ?? 0) + 1).padStart(3, '0')}`;
}

async function uebersicht(): Promise<AdminKategorieStand[]> {
  const zeilen = await db.select({ kategorie: questions.kategorie, status: questions.status, anzahl: sql<number>`count(*)::int` })
    .from(questions).groupBy(questions.kategorie, questions.status);
  return FRAGEN_KATEGORIEN.map((kategorie) => {
    const von = (status: string) => zeilen.find((z) => z.kategorie === kategorie && z.status === status)?.anzahl ?? 0;
    return { kategorie, freigegeben: von('freigegeben'), entwurf: von('entwurf'), eingereicht: von('eingereicht'), abgelehnt: von('abgelehnt') };
  });
}

// Liste mit Filtern (Status, Kategorie, Suche in Code/Frage/Antworten) + Übersicht je Kategorie
adminRoute.get('/fragen', async (c) => {
  const eingabe = adminFragenFilterSchema.safeParse(c.req.query());
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const { status, kategorie, suche } = eingabe.data;
  const bedingungen: SQL[] = [];
  if (status) bedingungen.push(eq(questions.status, status));
  if (kategorie) bedingungen.push(eq(questions.kategorie, kategorie));
  if (suche) {
    const muster = `%${suche.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    bedingungen.push(or(
      ilike(questions.frageText, muster),
      ilike(questions.code, muster),
      sql`exists (select 1 from ${answerOptions} where ${answerOptions.questionId} = ${questions.id} and ${answerOptions.text} ilike ${muster})`,
    )!);
  }
  const [fragen, stand] = await Promise.all([ladeFragen(db, bedingungen.length ? and(...bedingungen) : undefined), uebersicht()]);
  return c.json({ fragen, uebersicht: stand } satisfies AdminFragenListe);
});

// Alle Fragen als CSV im Format von fragen/fragen.csv (Sicherung, Excel, Git)
adminRoute.get('/fragen.csv', async (c) => {
  const fragen = await ladeFragen(db);
  const zeilen: FragenZeile[] = fragen.map((f) => ({
    // Fragen ohne Code (z. B. später aus Community-Einreichungen) bekommen beim Export einen stabilen Ersatz
    code: f.code ?? `frage-${f.id}`,
    kategorie: f.kategorie,
    typ: f.typ,
    frage: f.frage,
    richtig: f.richtig,
    falsch1: f.falsch[0],
    falsch2: f.falsch[1],
    falsch3: f.falsch[2],
    erklaerung: f.erklaerung ?? undefined,
    schwierigkeit: f.schwierigkeit,
    bild_url: f.bildUrl ?? undefined,
    bild_quelle: f.bildQuelle ?? undefined,
    status: f.status,
  }));
  const datum = new Date().toISOString().slice(0, 10);
  return c.body(schreibeFragenCsv(zeilen), 200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="fragen-${datum}.csv"`,
  });
});

adminRoute.get('/fragen/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Frage nicht gefunden'), 404);
  const [frage] = await ladeFragen(db, eq(questions.id, id));
  if (!frage) return c.json(fehler('Frage nicht gefunden'), 404);
  return c.json(frage satisfies AdminFrage);
});

// Neue Frage (Code wird vergeben)
adminRoute.post('/fragen', async (c) => {
  const eingabe = frageBearbeitenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const e = eingabe.data;
  const frage = await db.transaction(async (tx) => {
    // Codes je Kategorie nacheinander vergeben
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`fragen-code-${e.kategorie}`}))`);
    const code = await naechsterCode(tx, e.kategorie);
    const [neu] = await tx.insert(questions).values({ code, ...felderAus(e) }).returning({ id: questions.id });
    await tx.insert(answerOptions).values([
      { questionId: neu!.id, text: e.richtig, istRichtig: true },
      ...e.falsch.map((text) => ({ questionId: neu!.id, text, istRichtig: false })),
    ]);
    const [geladen] = await ladeFragen(tx, eq(questions.id, neu!.id));
    return geladen!;
  });
  return c.json(frage satisfies AdminFrage, 201);
});

/**
 * Frage bearbeiten. Antwortoptionen werden an Ort und Stelle geändert – ihre IDs
 * stecken in gespielten Duellen. Die richtige Antwort bleibt dieselbe Option.
 */
adminRoute.put('/fragen/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Frage nicht gefunden'), 404);
  const eingabe = frageBearbeitenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const e = eingabe.data;

  const frage = await db.transaction(async (tx) => {
    const [vorhanden] = await tx.select({ id: questions.id }).from(questions).where(eq(questions.id, id)).for('update');
    if (!vorhanden) return null;
    await tx.update(questions).set(felderAus(e)).where(eq(questions.id, id));
    const optionen = await tx.select().from(answerOptions).where(eq(answerOptions.questionId, id)).orderBy(asc(answerOptions.id));
    const richtige = optionen.find((o) => o.istRichtig)!;
    await tx.update(answerOptions).set({ text: e.richtig }).where(eq(answerOptions.id, richtige.id));
    for (const [i, option] of optionen.filter((o) => !o.istRichtig).entries()) {
      await tx.update(answerOptions).set({ text: e.falsch[i]! }).where(eq(answerOptions.id, option.id));
    }
    const [geladen] = await ladeFragen(tx, eq(questions.id, id));
    return geladen!;
  });
  if (!frage) return c.json(fehler('Frage nicht gefunden'), 404);
  return c.json(frage satisfies AdminFrage);
});

// Schnell freigeben / ablehnen / zurück auf Entwurf
adminRoute.post('/fragen/:id/status', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Frage nicht gefunden'), 404);
  const eingabe = statusSetzenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const geaendert = await db.update(questions).set({ status: eingabe.data.status }).where(eq(questions.id, id)).returning({ id: questions.id });
  if (!geaendert.length) return c.json(fehler('Frage nicht gefunden'), 404);
  const [frage] = await ladeFragen(db, eq(questions.id, id));
  return c.json(frage! satisfies AdminFrage);
});

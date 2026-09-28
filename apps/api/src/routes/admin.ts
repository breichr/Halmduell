import { Hono } from 'hono';
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import {
  FRAGEN_KATEGORIEN,
  adminFragenFilterSchema,
  commonsSchema,
  feldFehler,
  frageBearbeitenSchema,
  meldungenAbschliessenSchema,
  statusSetzenSchema,
  type AdminFrage,
  type AdminFragenListe,
  type AdminKategorieStand,
  type AdminMeldung,
  type CommonsBild,
  type ApiFehler,
  type FrageBearbeiten,
  type FragenKategorie,
  type MeldungenAbgeschlossen,
} from '@halmduell/shared';
import { db } from '../db/client';
import { answerOptions, duelAnswers, frageMeldungen, questions, users } from '../db/schema';
import type { Tx } from '../db/types';
import { schreibeFragenCsv, type FragenZeile } from '../fragen/csv';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { requireAdmin } from '../services/admin';
import { nachricht } from '../services/benachrichtigungen';
import { hatPushAbo, pushAktiv, spaeterSenden } from '../services/push';
import { CommonsFehler, commonsBild } from '../services/commons';

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
  const [optionen, statistik, meldungen] = await Promise.all([
    q.select().from(answerOptions).where(inArray(answerOptions.questionId, ids)).orderBy(asc(answerOptions.id)),
    q.select({
      id: duelAnswers.questionId,
      beantwortet: sql<number>`count(*)::int`,
      richtig: sql<number>`count(*) filter (where ${duelAnswers.istRichtig})::int`,
    }).from(duelAnswers).where(and(inArray(duelAnswers.questionId, ids), isNotNull(duelAnswers.istRichtig))).groupBy(duelAnswers.questionId),
    q.select({ id: frageMeldungen.questionId, anzahl: sql<number>`count(*)::int` })
      .from(frageMeldungen).where(and(inArray(frageMeldungen.questionId, ids), eq(frageMeldungen.status, 'offen'))).groupBy(frageMeldungen.questionId),
  ]);
  const optionenVon = new Map<number, Option[]>();
  for (const o of optionen) optionenVon.set(o.questionId, [...(optionenVon.get(o.questionId) ?? []), o]);
  const statistikVon = new Map(statistik.map((s) => [s.id, s]));
  const meldungenVon = new Map(meldungen.map((m) => [m.id, m.anzahl]));
  return zeilen.map((f) => alsAdminFrage(f, optionenVon.get(f.id) ?? [], statistikVon.get(f.id), meldungenVon.get(f.id)));
}

function alsAdminFrage(f: Frage, optionen: Option[], statistik?: { beantwortet: number; richtig: number }, meldungen = 0): AdminFrage {
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
    meldungen,
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

/** Nächster freier Code je Kategorie, z. B. „pflanzenbau-012“ (wie in fragen.csv) */
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

async function anzahlGemeldet(): Promise<number> {
  const [zeile] = await db.select({ n: sql<number>`count(distinct ${frageMeldungen.questionId})::int` })
    .from(frageMeldungen).where(eq(frageMeldungen.status, 'offen'));
  return zeile?.n ?? 0;
}

// Liste mit Filtern (Status, Kategorie, gemeldet, Suche in Code/Frage/Antworten) + Übersicht je Kategorie
adminRoute.get('/fragen', async (c) => {
  const eingabe = adminFragenFilterSchema.safeParse(c.req.query());
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const { status, kategorie, suche, gemeldet } = eingabe.data;
  const bedingungen: SQL[] = [];
  if (status) bedingungen.push(eq(questions.status, status));
  if (kategorie) bedingungen.push(eq(questions.kategorie, kategorie));
  if (gemeldet) {
    bedingungen.push(sql`exists (select 1 from ${frageMeldungen} where ${frageMeldungen.questionId} = ${questions.id} and ${frageMeldungen.status} = 'offen')`);
  }
  if (suche) {
    const muster = `%${suche.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    bedingungen.push(or(
      ilike(questions.frageText, muster),
      ilike(questions.code, muster),
      sql`exists (select 1 from ${answerOptions} where ${answerOptions.questionId} = ${questions.id} and ${answerOptions.text} ilike ${muster})`,
    )!);
  }
  const [fragen, stand, anzahl] = await Promise.all([ladeFragen(db, bedingungen.length ? and(...bedingungen) : undefined), uebersicht(), anzahlGemeldet()]);
  return c.json({ fragen, uebersicht: stand, gemeldet: anzahl } satisfies AdminFragenListe);
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

// Offene Meldungen einer Frage, mit der Antwort, die der Spieler zuletzt gegeben hat
adminRoute.get('/fragen/:id/meldungen', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Frage nicht gefunden'), 404);
  const zeilen = await db.select({
    id: frageMeldungen.id,
    username: users.username,
    grund: frageMeldungen.grund,
    kommentar: frageMeldungen.kommentar,
    erstelltAt: frageMeldungen.erstelltAt,
    seineAntwort: sql<string | null>`(
      select ao.text from ${duelAnswers} da left join ${answerOptions} ao on ao.id = da.answer_option_id
      where da.user_id = ${frageMeldungen.userId} and da.question_id = ${frageMeldungen.questionId} and da.ist_richtig is not null
      order by da.beantwortet_at desc limit 1)`,
  }).from(frageMeldungen)
    .innerJoin(users, eq(users.id, frageMeldungen.userId))
    .where(and(eq(frageMeldungen.questionId, id), eq(frageMeldungen.status, 'offen')))
    .orderBy(desc(frageMeldungen.erstelltAt), desc(frageMeldungen.id));
  return c.json(zeilen.map((m) => ({ ...m, erstelltAt: m.erstelltAt.toISOString() })) satisfies AdminMeldung[]);
});

/**
 * Alle offenen Meldungen einer Frage abschließen: erledigt (Frage korrigiert) oder verworfen.
 * Jeder Melder bekommt eine Push-Nachricht; Antippen öffnet sein letztes Duell mit der Frage.
 */
adminRoute.post('/fragen/:id/meldungen', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json(fehler('Frage nicht gefunden'), 404);
  const eingabe = meldungenAbschliessenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const { status, antwort } = eingabe.data;

  const [frage] = await db.select({ text: questions.frageText }).from(questions).where(eq(questions.id, id));
  if (!frage) return c.json(fehler('Frage nicht gefunden'), 404);
  const geschlossen = await db.update(frageMeldungen)
    .set({ status, antwort, abgeschlossenAt: new Date(), abgeschlossenVon: c.var.userId })
    .where(and(eq(frageMeldungen.questionId, id), eq(frageMeldungen.status, 'offen')))
    .returning({ userId: frageMeldungen.userId });

  const melder = [...new Set(geschlossen.map((m) => m.userId))];
  const letzteDuelle = melder.length === 0 ? [] : await db.execute<{ user_id: number; duel_id: number }>(sql`
    select distinct on (user_id) user_id, duel_id from ${duelAnswers}
    where question_id = ${id} and user_id in (${sql.join(melder.map((u) => sql`${u}`), sql`, `)})
    order by user_id, gestellt_at desc`);
  const duellVon = new Map([...letzteDuelle].map((z) => [z.user_id, z.duel_id]));
  const text = status === 'erledigt' ? nachricht.meldungErledigt : nachricht.meldungVerworfen;
  spaeterSenden(melder.map((an) => ({ an, nachricht: text(frage.text, antwort, duellVon.get(an) ?? null) })));

  const mitAbo = pushAktiv() ? await Promise.all(melder.map(hatPushAbo)) : [];
  return c.json({ abgeschlossen: geschlossen.length, benachrichtigt: mitAbo.filter(Boolean).length } satisfies MeldungenAbgeschlossen);
});

// Commons-Link → Bild-URL, Urheber und Lizenz (für Bildfragen)
adminRoute.post('/commons', async (c) => {
  const eingabe = commonsSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  try {
    return c.json((await commonsBild(eingabe.data.link)) satisfies CommonsBild);
  } catch (e) {
    if (e instanceof CommonsFehler) return c.json(fehler(e.message), e.status);
    throw e;
  }
});

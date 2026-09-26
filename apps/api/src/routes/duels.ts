import { Hono } from 'hono';
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import {
  ANTWORTZEIT_MS,
  FRAGEN_PRO_DUELL,
  antwortSchema,
  beitretenSchema,
  feldFehler,
  neuesDuellSchema,
  type AntwortErgebnis,
  type ApiFehler,
  type DuellDetails,
  type DuellSpieler,
  type DuellUebersicht,
  type EinladungsVorschau,
  type GestellteFrage,
  type NeuesDuell,
} from '@halmduell/shared';
import { db } from '../db/client';
import { answerOptions, duelAnswers, duelQuestions, duels, questions, users } from '../db/schema';
import type { Tx } from '../db/types';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import {
  antwortStand,
  baueUebersicht,
  erzeugeEinladungsCode,
  istAmZug,
  istLaufend,
  istTeilnehmer,
  mischeAntworten,
  sortiereFuerDashboard,
  zugBis,
} from '../services/duell';
import { beendeVorzeitig } from '../services/duell-ende';
import { werteDuell } from '../services/wertung';

/** Toleranz für die Netzwerklaufzeit zwischen Anzeige der Frage und Eintreffen der Antwort */
const ZEIT_TOLERANZ_MS = 2_000;
/** Wie viele abgeschlossene Duelle das Dashboard zeigt (laufende immer alle) */
const ABGESCHLOSSENE_IM_DASHBOARD = 20;

type Duell = typeof duels.$inferSelect;

const fehler = (error: string): ApiFehler => ({ error });
const leseJson = (req: Request) => req.json().catch(() => null);

function parseId(roh: string): number | null {
  const id = Number(roh);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function ladeSpieler(tx: Tx | typeof db, ids: number[]): Promise<Map<number, DuellSpieler>> {
  if (ids.length === 0) return new Map();
  const zeilen = await tx.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, ids));
  return new Map(zeilen.map((u) => [u.id, u]));
}

function gegnerId(duel: Duell, userId: number): number | null {
  return duel.spielerAId === userId ? duel.spielerBId : duel.spielerAId;
}

/** Duell laden und sperren; liefert eine Fehlerantwort, wenn es fehlt oder der User nicht mitspielt */
async function ladeEigenesDuell(tx: Tx, duelId: number, userId: number) {
  const [duel] = await tx.select().from(duels).where(eq(duels.id, duelId)).for('update');
  if (!duel) return { fehler: fehler('Duell nicht gefunden'), status: 404 as const };
  if (!istTeilnehmer(duel, userId)) return { fehler: fehler('Kein Teilnehmer dieses Duells'), status: 403 as const };
  return { duel };
}

/**
 * Frist abgelaufen, aber der Fristen-Job hat das Duell noch nicht beendet?
 * Dann jetzt beenden, damit niemand nach Ablauf noch spielen kann.
 */
async function fristPruefen(tx: Tx, duel: Duell, jetzt = new Date()): Promise<Duell> {
  const frist = zugBis(duel);
  if (!frist || frist > jetzt) return duel;
  const verlierer = duel.status === 'wartet_a' ? duel.spielerAId : duel.spielerBId ?? duel.spielerAId;
  return beendeVorzeitig(tx, duel, verlierer, jetzt);
}

/**
 * Wählt Fragen für ein neues Duell: bevorzugt Fragen, die keiner der Spieler
 * schon in einem Duell hatte; bei 'gemischt' reihum aus allen Kategorien.
 */
async function waehleFragen(tx: Tx, kategorie: NeuesDuell['kategorie'], spielerIds: number[]): Promise<number[]> {
  const ids = sql.join(spielerIds.map((id) => sql`${id}`), sql`, `);
  const gesehen = sql`(
    select count(*) from duel_questions dq join duels d on d.id = dq.duel_id
    where dq.question_id = q.id and (d.spieler_a_id in (${ids}) or d.spieler_b_id in (${ids}))
  )`;
  const filter = kategorie === 'gemischt' ? sql`` : sql`and q.kategorie = ${kategorie}`;
  const zeilen = await tx.execute<{ id: number }>(sql`
    select id from (
      select q.id, row_number() over (partition by q.kategorie order by ${gesehen}, random()) as rang
      from questions q
      where q.status = 'freigegeben' ${filter}
    ) auswahl
    order by rang, random()
    limit ${FRAGEN_PRO_DUELL}`);
  return zeilen.map((z) => z.id);
}

export const duelsRoute = new Hono<AuthEnv>();

duelsRoute.use(requireAuth);

// Dashboard: alle laufenden Duelle + die letzten abgeschlossenen
duelsRoute.get('/', async (c) => {
  const ich = c.var.userId;
  const beteiligt = or(eq(duels.spielerAId, ich), eq(duels.spielerBId, ich));
  const laufend = await db.select().from(duels)
    .where(and(beteiligt, inArray(duels.status, ['wartet_a', 'wartet_b'])));
  const abgeschlossen = await db.select().from(duels)
    .where(and(beteiligt, inArray(duels.status, ['abgeschlossen', 'abgebrochen'])))
    .orderBy(desc(duels.abgeschlossenAt))
    .limit(ABGESCHLOSSENE_IM_DASHBOARD);
  const liste = [...laufend, ...abgeschlossen];
  if (liste.length === 0) return c.json([] satisfies DuellUebersicht[]);

  const antworten = await db.select().from(duelAnswers)
    .where(and(inArray(duelAnswers.duelId, liste.map((d) => d.id)), isNotNull(duelAnswers.istRichtig)));
  const spieler = await ladeSpieler(db, liste.map((d) => gegnerId(d, ich)).filter((id): id is number => id !== null));

  const uebersicht = liste.map((d) => {
    const gid = gegnerId(d, ich);
    return baueUebersicht(d, ich, gid === null ? null : spieler.get(gid) ?? null, antworten.filter((a) => a.duelId === d.id));
  });
  return c.json(uebersicht.sort(sortiereFuerDashboard) satisfies DuellUebersicht[]);
});

// Neues Duell: gegen einen User (per Name) oder offen mit Einladungscode
duelsRoute.post('/', async (c) => {
  const eingabe = neuesDuellSchema.safeParse(await leseJson(c.req.raw));
  if (!eingabe.success) {
    return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  }
  const { kategorie, gegner } = eingabe.data;
  const ich = c.var.userId;

  return db.transaction(async (tx) => {
    let gegnerSpieler: DuellSpieler | null = null;
    if (gegner) {
      const [gefunden] = await tx.select({ id: users.id, username: users.username }).from(users)
        .where(eq(sql`lower(${users.username})`, gegner.toLowerCase()));
      if (!gefunden) return c.json(fehler('Gegner nicht gefunden'), 404);
      if (gefunden.id === ich) return c.json(fehler('Du kannst dich nicht selbst herausfordern'), 400);
      gegnerSpieler = gefunden;
    }

    const fragen = await waehleFragen(tx, kategorie, gegnerSpieler ? [ich, gegnerSpieler.id] : [ich]);
    if (fragen.length < FRAGEN_PRO_DUELL) return c.json(fehler('Nicht genug Fragen in dieser Kategorie'), 409);

    const [duel] = await tx.insert(duels).values({
      spielerAId: ich,
      spielerBId: gegnerSpieler?.id ?? null,
      kategorie,
      einladungsCode: gegnerSpieler ? null : erzeugeEinladungsCode(),
    }).returning();
    await tx.insert(duelQuestions).values(
      fragen.map((questionId, i) => ({ duelId: duel!.id, questionId, reihenfolge: i + 1 })),
    );
    return c.json(baueUebersicht(duel!, ich, gegnerSpieler, []) satisfies DuellUebersicht, 201);
  });
});

// Vorschau einer Einladung (für die Seite, die der Einladungslink öffnet)
duelsRoute.get('/einladung/:code', async (c) => {
  const code = beitretenSchema.safeParse({ code: c.req.param('code') });
  if (!code.success) return c.json(fehler('Ungültiger Einladungscode'), 400);

  const [duel] = await db.select().from(duels)
    .where(and(eq(duels.einladungsCode, code.data.code), isNull(duels.spielerBId)));
  if (!duel || !istLaufend(duel)) return c.json(fehler('Einladung nicht gefunden oder schon angenommen'), 404);
  const von = (await ladeSpieler(db, [duel.spielerAId])).get(duel.spielerAId)!;
  return c.json({ duelId: duel.id, kategorie: duel.kategorie, von } satisfies EinladungsVorschau);
});

// Einladung annehmen: der Beitretende wird Spieler B
duelsRoute.post('/beitreten', async (c) => {
  const eingabe = beitretenSchema.safeParse(await leseJson(c.req.raw));
  if (!eingabe.success) return c.json(fehler('Ungültiger Einladungscode'), 400);
  const ich = c.var.userId;

  return db.transaction(async (tx) => {
    const [duel] = await tx.select().from(duels)
      .where(and(eq(duels.einladungsCode, eingabe.data.code), isNull(duels.spielerBId)))
      .for('update');
    if (!duel) return c.json(fehler('Einladung nicht gefunden oder schon angenommen'), 404);
    if (duel.spielerAId === ich) return c.json(fehler('Das ist deine eigene Einladung'), 400);
    if ((await fristPruefen(tx, duel)).status === 'abgebrochen') {
      return c.json(fehler('Einladung nicht gefunden oder schon angenommen'), 404);
    }

    const [aktualisiert] = await tx.update(duels)
      // hat A schon gespielt, beginnt Bs Zug (und dessen Frist) jetzt
      .set({ spielerBId: ich, einladungsCode: null, ...(duel.status === 'wartet_b' ? { zugSeit: new Date() } : {}) })
      .where(eq(duels.id, duel.id))
      .returning();
    const spieler = await ladeSpieler(tx, [duel.spielerAId]);
    const antworten = await tx.select().from(duelAnswers).where(eq(duelAnswers.duelId, duel.id));
    return c.json(baueUebersicht(aktualisiert!, ich, spieler.get(duel.spielerAId) ?? null, antworten) satisfies DuellUebersicht);
  });
});

// Details + Frage-für-Frage-Vergleich
duelsRoute.get('/:id', async (c) => {
  const duelId = parseId(c.req.param('id'));
  if (duelId === null) return c.json(fehler('Ungültige Duell-ID'), 400);
  const ich = c.var.userId;

  const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
  if (!duel) return c.json(fehler('Duell nicht gefunden'), 404);
  if (!istTeilnehmer(duel, ich)) return c.json(fehler('Kein Teilnehmer dieses Duells'), 403);

  const fragen = await db.select({
    reihenfolge: duelQuestions.reihenfolge,
    id: questions.id,
    typ: questions.typ,
    frageText: questions.frageText,
    bildUrl: questions.bildUrl,
    bildQuelle: questions.bildQuelle,
    erklaerung: questions.erklaerung,
  }).from(duelQuestions)
    .innerJoin(questions, eq(questions.id, duelQuestions.questionId))
    .where(eq(duelQuestions.duelId, duelId))
    .orderBy(asc(duelQuestions.reihenfolge));
  const richtige = await db.select({ id: answerOptions.id, questionId: answerOptions.questionId, text: answerOptions.text })
    .from(answerOptions)
    .where(and(inArray(answerOptions.questionId, fragen.map((f) => f.id)), eq(answerOptions.istRichtig, true)));
  const antworten = await db.select().from(duelAnswers).where(eq(duelAnswers.duelId, duelId));

  const gid = gegnerId(duel, ich);
  const gegner = gid === null ? null : (await ladeSpieler(db, [gid])).get(gid) ?? null;

  const details: DuellDetails = {
    ...baueUebersicht(duel, ich, gegner, antworten),
    fragen: fragen.map(({ reihenfolge, ...frage }) => {
      const meine = antworten.find((a) => a.userId === ich && a.questionId === frage.id);
      const seine = antworten.find((a) => a.userId === gid && a.questionId === frage.id);
      const beantwortet = meine?.istRichtig != null;
      const richtig = richtige.find((r) => r.questionId === frage.id);
      return {
        reihenfolge,
        beantwortet,
        // Inhalt und Lösung erst nach eigener Antwort – sonst ließe sich vorab nachschlagen
        frage: beantwortet ? { ...frage, richtigeAntwort: richtig ? { id: richtig.id, text: richtig.text } : null } : null,
        ich: antwortStand(meine),
        gegner: beantwortet ? antwortStand(seine) : null,
      };
    }),
  };
  return c.json(details);
});

// Aktuelle Frage abrufen; startet beim ersten Abruf den Timer
duelsRoute.get('/:id/frage', async (c) => {
  const duelId = parseId(c.req.param('id'));
  if (duelId === null) return c.json(fehler('Ungültige Duell-ID'), 400);
  const ich = c.var.userId;

  return db.transaction(async (tx) => {
    const geladen = await ladeEigenesDuell(tx, duelId, ich);
    if (!geladen.duel) return c.json(geladen.fehler, geladen.status);
    if (!istLaufend(await fristPruefen(tx, geladen.duel))) return c.json(fehler('Das Duell ist beendet'), 409);
    if (!istAmZug(geladen.duel, ich)) return c.json(fehler('Du bist gerade nicht am Zug'), 409);

    const meine = await tx.select().from(duelAnswers)
      .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, ich)));
    let offen = meine.find((a) => a.istRichtig === null);
    if (!offen) {
      const beantwortet = new Set(meine.map((a) => a.questionId));
      const reihe = await tx.select().from(duelQuestions)
        .where(eq(duelQuestions.duelId, duelId))
        .orderBy(asc(duelQuestions.reihenfolge));
      const naechste = reihe.find((q) => !beantwortet.has(q.questionId));
      if (!naechste) return c.json(fehler('Alle Fragen sind beantwortet'), 409);
      [offen] = await tx.insert(duelAnswers)
        .values({ duelId, userId: ich, questionId: naechste.questionId, gestelltAt: new Date() })
        .returning();
    }

    const [frage] = await tx.select({
      reihenfolge: duelQuestions.reihenfolge,
      typ: questions.typ,
      frageText: questions.frageText,
      bildUrl: questions.bildUrl,
      bildQuelle: questions.bildQuelle,
    }).from(duelQuestions)
      .innerJoin(questions, eq(questions.id, duelQuestions.questionId))
      .where(and(eq(duelQuestions.duelId, duelId), eq(duelQuestions.questionId, offen!.questionId)));
    const optionen = await tx.select({ id: answerOptions.id, text: answerOptions.text }).from(answerOptions)
      .where(eq(answerOptions.questionId, offen!.questionId));

    const vergangen = Date.now() - offen!.gestelltAt.getTime();
    return c.json({
      duelId,
      reihenfolge: frage!.reihenfolge,
      anzahl: FRAGEN_PRO_DUELL,
      frageId: offen!.questionId,
      typ: frage!.typ,
      frageText: frage!.frageText,
      bildUrl: frage!.bildUrl,
      bildQuelle: frage!.bildQuelle,
      antworten: mischeAntworten(optionen, duelId, ich),
      zeitlimitMs: ANTWORTZEIT_MS,
      restzeitMs: Math.max(0, ANTWORTZEIT_MS - vergangen),
    } satisfies GestellteFrage);
  });
});

// Antwort auf die aktuell gestellte Frage; nach der letzten Frage wechselt der Zug bzw. das Duell wird gewertet
duelsRoute.post('/:id/antwort', async (c) => {
  const duelId = parseId(c.req.param('id'));
  if (duelId === null) return c.json(fehler('Ungültige Duell-ID'), 400);
  const eingabe = antwortSchema.safeParse(await leseJson(c.req.raw));
  if (!eingabe.success) {
    return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  }
  const { frageId, antwortId } = eingabe.data;
  const ich = c.var.userId;

  return db.transaction(async (tx) => {
    const geladen = await ladeEigenesDuell(tx, duelId, ich);
    if (!geladen.duel) return c.json(geladen.fehler, geladen.status);
    const duel = geladen.duel;
    if (!istLaufend(await fristPruefen(tx, duel))) return c.json(fehler('Das Duell ist beendet'), 409);
    if (!istAmZug(duel, ich)) return c.json(fehler('Du bist gerade nicht am Zug'), 409);

    const [offen] = await tx.select().from(duelAnswers)
      .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, ich), isNull(duelAnswers.istRichtig)));
    if (!offen) return c.json(fehler('Keine offene Frage – zuerst die Frage abrufen'), 409);
    if (offen.questionId !== frageId) return c.json(fehler('Antwort passt nicht zur aktuell gestellten Frage'), 409);

    const optionen = await tx.select().from(answerOptions).where(eq(answerOptions.questionId, frageId));
    const richtige = optionen.find((o) => o.istRichtig);
    if (!richtige) throw new Error(`Frage ${frageId} hat keine richtige Antwort`);
    const gewaehlt = antwortId === null ? null : optionen.find((o) => o.id === antwortId);
    if (gewaehlt === undefined) return c.json(fehler('Antwort gehört nicht zu dieser Frage'), 400);

    const jetzt = new Date();
    const dauer = jetzt.getTime() - offen.gestelltAt.getTime();
    const zeitAbgelaufen = gewaehlt === null || dauer > ANTWORTZEIT_MS + ZEIT_TOLERANZ_MS;
    const richtig = !zeitAbgelaufen && gewaehlt.istRichtig;

    await tx.update(duelAnswers).set({
      answerOptionId: zeitAbgelaufen ? null : gewaehlt.id,
      antwortzeitMs: zeitAbgelaufen ? null : dauer,
      istRichtig: richtig,
      beantwortetAt: jetzt,
    }).where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, ich), eq(duelAnswers.questionId, frageId)));

    const [{ anzahl } = { anzahl: 0 }] = await tx.select({ anzahl: sql<number>`count(*)::int` }).from(duelAnswers)
      .where(and(eq(duelAnswers.duelId, duelId), eq(duelAnswers.userId, ich), isNotNull(duelAnswers.istRichtig)));
    const rundeFertig = anzahl >= FRAGEN_PRO_DUELL;

    let status = duel.status;
    if (rundeFertig && status === 'wartet_a') {
      status = 'wartet_b';
      // Bs Frist beginnt jetzt (bei offener Einladung erst mit dem Beitritt)
      await tx.update(duels).set({ status, zugSeit: jetzt }).where(eq(duels.id, duelId));
    } else if (rundeFertig && status === 'wartet_b') {
      status = 'abgeschlossen';
      const [abgeschlossen] = await tx.update(duels)
        .set({ status, abgeschlossenAt: jetzt })
        .where(eq(duels.id, duelId))
        .returning();
      await werteDuell(tx, abgeschlossen!);
    }

    const [frage] = await tx.select({ erklaerung: questions.erklaerung }).from(questions).where(eq(questions.id, frageId));
    return c.json({
      richtig,
      zeitAbgelaufen,
      richtigeAntwortId: richtige.id,
      erklaerung: frage?.erklaerung ?? null,
      rundeFertig,
      status,
    } satisfies AntwortErgebnis);
  });
});

// Aufgeben: der Gegner gewinnt; ohne Gegner (offene Einladung) wird das Duell abgebrochen
duelsRoute.post('/:id/aufgeben', async (c) => {
  const duelId = parseId(c.req.param('id'));
  if (duelId === null) return c.json(fehler('Ungültige Duell-ID'), 400);
  const ich = c.var.userId;

  return db.transaction(async (tx) => {
    const geladen = await ladeEigenesDuell(tx, duelId, ich);
    if (!geladen.duel) return c.json(geladen.fehler, geladen.status);
    if (!istLaufend(geladen.duel)) return c.json(fehler('Das Duell ist bereits beendet'), 409);

    const beendet = await beendeVorzeitig(tx, geladen.duel, ich);
    const gid = gegnerId(beendet, ich);
    const gegner = gid === null ? null : (await ladeSpieler(tx, [gid])).get(gid) ?? null;
    const antworten = await tx.select().from(duelAnswers).where(eq(duelAnswers.duelId, duelId));
    return c.json(baueUebersicht(beendet, ich, gegner, antworten) satisfies DuellUebersicht);
  });
});

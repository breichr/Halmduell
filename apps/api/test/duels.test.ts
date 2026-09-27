import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { DuellDetails, DuellUebersicht, GestellteFrage } from '@halmduell/shared';
import {
  anfrage,
  antwortIds,
  erstelleFragen,
  leereDatenbank,
  mitDatenbank,
  neuerUser,
  sqlAusfuehren,
} from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const frageHolen = (duelId: number, u: User) => anfrage(`/duels/${duelId}/frage`, { cookie: u.cookie });
const antworten = (duelId: number, u: User, frageId: number, antwortId: number | null) =>
  anfrage(`/duels/${duelId}/antwort`, { method: 'POST', cookie: u.cookie, body: { frageId, antwortId } });

/** Spielt die komplette Runde; `richtig` legt je Frage fest, ob richtig (true), falsch (false) oder gar nicht (null) geantwortet wird */
async function spieleRunde(duelId: number, u: User, richtig: (boolean | null)[]) {
  const ergebnisse = [];
  for (const soll of richtig) {
    const frage = (await frageHolen(duelId, u)).json as GestellteFrage;
    const ids = await antwortIds(frage.frageId);
    const antwortId = soll === null ? null : soll ? ids.richtig : ids.falsch;
    ergebnisse.push((await antworten(duelId, u, frage.frageId, antwortId)).json);
  }
  return ergebnisse;
}

describe.skipIf(!mitDatenbank)('Duell-Flow', () => {
  let anna: User;
  let ben: User;
  let fremd: User;

  beforeAll(async () => {
    await leereDatenbank();
    [anna, ben, fremd] = [await neuerUser('anna'), await neuerUser('ben'), await neuerUser('fremd')];
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage('/duels')).status).toBe(401);
    expect((await anfrage('/duels', { method: 'POST', body: { kategorie: 'wissen' } })).status).toBe(401);
  });

  test('zu wenige Fragen → 409', async () => {
    await erstelleFragen(5, 'wissen');
    const res = await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'wissen', gegner: ben.username } });
    expect(res.status).toBe(409);
  });

  test('Gegner muss existieren und darf nicht man selbst sein', async () => {
    await erstelleFragen(3, 'wissen');
    const body = (gegner: string) => ({ method: 'POST', cookie: anna.cookie, body: { kategorie: 'wissen', gegner } });
    expect((await anfrage('/duels', body('gibtsnicht'))).status).toBe(404);
    expect((await anfrage('/duels', body(anna.username.toUpperCase()))).status).toBe(400);
    expect((await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'obst' } })).status).toBe(400);
  });

  test('kompletter Ablauf: A spielt, B spielt, Wertung', async () => {
    const neu = await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'wissen', gegner: ben.username } });
    expect(neu.status).toBe(201);
    const duel = neu.json as DuellUebersicht;
    expect(duel).toMatchObject({ status: 'wartet_a', duBistDran: true, gegner: { username: ben.username }, einladungsCode: null });

    // B ist noch nicht dran
    expect((await frageHolen(duel.id, ben)).status).toBe(409);
    const benDashboard = (await anfrage('/duels', { cookie: ben.cookie })).json as DuellUebersicht[];
    expect(benDashboard.find((d) => d.id === duel.id)).toMatchObject({ duBistDran: false, gegner: { username: anna.username } });

    // Fremde sehen nichts
    expect((await anfrage(`/duels/${duel.id}`, { cookie: fremd.cookie })).status).toBe(403);
    expect((await frageHolen(duel.id, fremd)).status).toBe(403);

    // Erste Frage: keine Lösung in der Antwort, Neuladen liefert dieselbe Frage
    const erste = await frageHolen(duel.id, anna);
    expect(erste.status).toBe(200);
    const frage = erste.json as GestellteFrage;
    expect(frage).toMatchObject({ reihenfolge: 1, anzahl: 6, zeitlimitMs: 15000 });
    expect(frage.antworten).toHaveLength(4);
    expect(Object.keys(frage.antworten[0]!).sort()).toEqual(['id', 'text']);
    const nochmal = (await frageHolen(duel.id, anna)).json as GestellteFrage;
    expect(nochmal.frageId).toBe(frage.frageId);
    expect(nochmal.antworten).toEqual(frage.antworten);
    expect(nochmal.restzeitMs).toBeLessThanOrEqual(frage.restzeitMs);

    // Falsche Frage-ID bzw. Antwort einer anderen Frage
    expect((await antworten(duel.id, anna, frage.frageId + 1000, null)).status).toBe(409);
    const fremdeOption = (await sqlAusfuehren(sql`select id from answer_options where question_id <> ${frage.frageId} limit 1`))[0] as { id: number };
    expect((await antworten(duel.id, anna, frage.frageId, fremdeOption.id)).status).toBe(400);

    // A: 4 richtig, 1 falsch, 1 Zeit abgelaufen
    const ids = await antwortIds(frage.frageId);
    const r1 = await antworten(duel.id, anna, frage.frageId, ids.richtig);
    expect(r1.json).toMatchObject({ richtig: true, zeitAbgelaufen: false, richtigeAntwortId: ids.richtig, erklaerung: 'Weil es so ist.', rundeFertig: false, status: 'wartet_a' });
    const rest = await spieleRunde(duel.id, anna, [true, true, true, false, null]);
    expect(rest.map((r) => r.richtig)).toEqual([true, true, true, false, false]);
    expect(rest[4]).toMatchObject({ zeitAbgelaufen: true, rundeFertig: true, status: 'wartet_b' });

    // A ist fertig und nicht mehr dran
    expect((await frageHolen(duel.id, anna)).status).toBe(409);
    const annaDetails = (await anfrage(`/duels/${duel.id}`, { cookie: anna.cookie })).json as DuellDetails;
    expect(annaDetails.meinePunkte).toBe(4);
    expect(annaDetails.fragen.every((f) => f.beantwortet && f.frage?.richtigeAntwort)).toBe(true);
    expect(annaDetails.fragen.every((f) => f.gegner === null)).toBe(true);

    // B sieht vor dem eigenen Spielen weder Fragen noch As Ergebnisse
    const benVorher = (await anfrage(`/duels/${duel.id}`, { cookie: ben.cookie })).json as DuellDetails;
    expect(benVorher).toMatchObject({ duBistDran: true, gegnerPunkte: 0 });
    expect(benVorher.fragen.every((f) => f.frage === null && f.gegner === null)).toBe(true);

    // B: 2 richtig → A gewinnt 4:2
    const benErgebnisse = await spieleRunde(duel.id, ben, [true, false, true, false, false, false]);
    expect(benErgebnisse.at(-1)).toMatchObject({ rundeFertig: true, status: 'abgeschlossen' });

    const annaNachher = ((await anfrage('/duels', { cookie: anna.cookie })).json as DuellUebersicht[]).find((d) => d.id === duel.id);
    expect(annaNachher).toMatchObject({ status: 'abgeschlossen', meinePunkte: 4, gegnerPunkte: 2, ratingAenderung: 20 });
    const benNachher = (await anfrage(`/duels/${duel.id}`, { cookie: ben.cookie })).json as DuellDetails;
    expect(benNachher).toMatchObject({ meinePunkte: 2, gegnerPunkte: 4, ratingAenderung: -20 });
    expect(benNachher.fragen.every((f) => f.gegner !== null)).toBe(true);

    // Neue Abzeichen durch dieses Duell (Antworten im Test sind blitzschnell)
    const annaAbzeichen = ((await anfrage(`/duels/${duel.id}`, { cookie: anna.cookie })).json as DuellDetails).neueAbzeichen.map((a) => a.key);
    expect(annaAbzeichen.sort()).toEqual(['blitzmerker', 'erster_sieg', 'erstes_duell']);
    expect(benNachher.neueAbzeichen.map((a) => a.key).sort()).toEqual(['blitzmerker', 'erstes_duell']);
    expect(annaDetails.neueAbzeichen).toEqual([]);

    const ratings = await sqlAusfuehren(sql`select user_id, kategorie, rating, duelle_gespielt from ratings order by user_id, kategorie`);
    expect([...ratings]).toEqual([
      { user_id: anna.id, kategorie: 'gesamt', rating: 1020, duelle_gespielt: 1 },
      { user_id: anna.id, kategorie: 'wissen', rating: 1020, duelle_gespielt: 1 },
      { user_id: ben.id, kategorie: 'gesamt', rating: 980, duelle_gespielt: 1 },
      { user_id: ben.id, kategorie: 'wissen', rating: 980, duelle_gespielt: 1 },
    ]);

    // Nach Abschluss ist niemand mehr dran
    expect((await frageHolen(duel.id, ben)).status).toBe(409);
  });

  test('Timer wird serverseitig geprüft', async () => {
    const duel = (await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'gemischt', gegner: ben.username } })).json as DuellUebersicht;
    const frage = (await frageHolen(duel.id, anna)).json as GestellteFrage;
    await sqlAusfuehren(sql`update duel_answers set gestellt_at = now() - interval '20 seconds'
      where duel_id = ${duel.id} and user_id = ${anna.id}`);

    const erneut = (await frageHolen(duel.id, anna)).json as GestellteFrage;
    expect(erneut.restzeitMs).toBe(0);

    const res = await antworten(duel.id, anna, frage.frageId, (await antwortIds(frage.frageId)).richtig);
    expect(res.json).toMatchObject({ richtig: false, zeitAbgelaufen: true });
  });

  test('Einladung per Code', async () => {
    const neu = await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'gemischt' } });
    const duel = neu.json as DuellUebersicht;
    expect(duel.gegner).toBeNull();
    expect(duel.einladungsCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

    // A kann schon spielen, bevor jemand beitritt
    expect((await frageHolen(duel.id, anna)).status).toBe(200);

    const code = duel.einladungsCode!;
    const vorschau = await anfrage(`/duels/einladung/${code.toLowerCase()}`, { cookie: fremd.cookie });
    expect(vorschau.json).toEqual({ duelId: duel.id, kategorie: 'gemischt', von: { id: anna.id, username: anna.username } });
    expect((await anfrage('/duels/einladung/AAAAAAAA', { cookie: fremd.cookie })).status).toBe(404);
    expect((await anfrage('/duels/einladung/kurz', { cookie: fremd.cookie })).status).toBe(400);

    expect((await anfrage('/duels/beitreten', { method: 'POST', cookie: anna.cookie, body: { code } })).status).toBe(400);
    const beitritt = await anfrage('/duels/beitreten', { method: 'POST', cookie: fremd.cookie, body: { code: code.toLowerCase() } });
    expect(beitritt.status).toBe(200);
    expect(beitritt.json).toMatchObject({ id: duel.id, gegner: { username: anna.username }, einladungsCode: null, duBistDran: false });

    // Code ist danach verbraucht
    expect((await anfrage('/duels/beitreten', { method: 'POST', cookie: ben.cookie, body: { code } })).status).toBe(404);
    expect((await anfrage(`/duels/einladung/${code}`, { cookie: ben.cookie })).status).toBe(404);
    const annaSicht = (await anfrage(`/duels/${duel.id}`, { cookie: anna.cookie })).json as DuellDetails;
    expect(annaSicht.gegner?.username).toBe(fremd.username);
  });

  test('Dashboard: wer am Zug ist, steht oben', async () => {
    const liste = (await anfrage('/duels', { cookie: ben.cookie })).json as DuellUebersicht[];
    const raenge = liste.map((d) => (d.duBistDran ? 0 : d.status === 'abgeschlossen' ? 2 : 1));
    expect(raenge).toEqual([...raenge].sort());
    expect(liste.length).toBeGreaterThanOrEqual(2);
  });
});

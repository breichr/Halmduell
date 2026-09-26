import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { DuellDetails, DuellUebersicht } from '@halmduell/shared';
import { anfrage, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const neuesDuell = async (von: User, gegner: User | null, kategorie = 'wissen') =>
  (await anfrage('/duels', { method: 'POST', cookie: von.cookie, body: { kategorie, ...(gegner ? { gegner: gegner.username } : {}) } })).json as DuellUebersicht;
const aufgeben = (duelId: number, u: User) => anfrage(`/duels/${duelId}/aufgeben`, { method: 'POST', cookie: u.cookie });
const details = async (duelId: number, u: User) => (await anfrage(`/duels/${duelId}`, { cookie: u.cookie })).json as DuellDetails;
const verarbeiteFristen = async (jetzt?: Date) => (await import('../src/services/duell-ende')).verarbeiteFristen(jetzt);
const ratings = async (userId: number) =>
  [...await sqlAusfuehren(sql`select kategorie, saison, rating, duelle_gespielt from ratings where user_id = ${userId} order by kategorie, saison`)];

describe.skipIf(!mitDatenbank)('Aufgeben und Fristen', () => {
  let anna: User;
  let ben: User;

  beforeAll(async () => {
    await leereDatenbank();
    [anna, ben] = [await neuerUser('anna'), await neuerUser('ben')];
    await erstelleFragen(6, 'wissen');
  });

  test('Aufgeben: Gegner gewinnt unabhängig vom Punktestand', async () => {
    const duel = await neuesDuell(anna, ben);
    const res = await aufgeben(duel.id, anna);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'abgeschlossen', aufgegeben: 'ich', ratingAenderung: -20, zugBis: null, duBistDran: false });
    expect(await details(duel.id, ben)).toMatchObject({ aufgegeben: 'gegner', ratingAenderung: 20 });

    expect((await aufgeben(duel.id, ben)).status).toBe(409);
    expect((await anfrage(`/duels/${duel.id}/frage`, { cookie: anna.cookie })).status).toBe(409);
  });

  test('Aufgeben einer offenen Einladung bricht ohne Wertung ab', async () => {
    const vorher = await ratings(anna.id);
    const duel = await neuesDuell(anna, null);
    const res = await aufgeben(duel.id, anna);
    expect(res.json).toMatchObject({ status: 'abgebrochen', einladungsCode: null, ratingAenderung: null });
    expect(await ratings(anna.id)).toEqual(vorher);
    expect((await anfrage('/duels/beitreten', { method: 'POST', cookie: ben.cookie, body: { code: duel.einladungsCode } })).status).toBe(404);
  });

  test('zugBis: 3 Tage pro Zug, offene Einladung 7 Tage', async () => {
    const duel = await neuesDuell(anna, ben);
    const frist = new Date(duel.zugBis!).getTime() - new Date(duel.erstelltAt).getTime();
    expect(Math.abs(frist - 3 * 24 * 3600 * 1000)).toBeLessThan(5000);
    await aufgeben(duel.id, anna);
  });

  test('Fristen-Job: wer am Zug ist, verliert; alte Einladungen verfallen', async () => {
    const verpasstA = await neuesDuell(anna, ben);
    const verpasstB = await neuesDuell(ben, anna);
    const einladung = await neuesDuell(anna, null);
    const frisch = await neuesDuell(anna, ben);

    // verpasstB: Ben hat gespielt, jetzt ist Anna (als B) seit 4 Tagen dran
    await sqlAusfuehren(sql`update duels set zug_seit = now() - interval '4 days' where id = ${verpasstA.id}`);
    await sqlAusfuehren(sql`update duels set status = 'wartet_b', zug_seit = now() - interval '4 days' where id = ${verpasstB.id}`);
    // Einladung: A hat gespielt, seit 8 Tagen tritt niemand bei
    await sqlAusfuehren(sql`update duels set status = 'wartet_b', erstellt_at = now() - interval '8 days' where id = ${einladung.id}`);

    expect(await verarbeiteFristen()).toEqual({ beendet: 3 });
    expect(await details(verpasstA.id, anna)).toMatchObject({ status: 'abgeschlossen', aufgegeben: 'ich' });
    expect(await details(verpasstB.id, anna)).toMatchObject({ status: 'abgeschlossen', aufgegeben: 'ich' });
    expect(await details(einladung.id, anna)).toMatchObject({ status: 'abgebrochen' });
    expect(await details(frisch.id, anna)).toMatchObject({ status: 'wartet_a', aufgegeben: null });

    // nochmal laufen lassen ändert nichts
    expect(await verarbeiteFristen()).toEqual({ beendet: 0 });
    await aufgeben(frisch.id, anna);
  });

  test('abgelaufene Frist greift sofort, auch bevor der Job läuft', async () => {
    const duel = await neuesDuell(anna, ben);
    await anfrage(`/duels/${duel.id}/frage`, { cookie: anna.cookie });
    await sqlAusfuehren(sql`update duels set zug_seit = now() - interval '4 days' where id = ${duel.id}`);

    const res = await anfrage(`/duels/${duel.id}/antwort`, { method: 'POST', cookie: anna.cookie, body: { frageId: 1, antwortId: null } });
    expect(res.status).toBe(409);
    expect(await details(duel.id, ben)).toMatchObject({ status: 'abgeschlossen', aufgegeben: 'gegner' });
  });

  test('beim Beitritt nach As Runde beginnt Bs Frist neu', async () => {
    const duel = await neuesDuell(anna, null);
    await sqlAusfuehren(sql`update duels set status = 'wartet_b', zug_seit = now() - interval '2 days' where id = ${duel.id}`);
    const beitritt = (await anfrage('/duels/beitreten', { method: 'POST', cookie: ben.cookie, body: { code: duel.einladungsCode } })).json as DuellUebersicht;
    const rest = new Date(beitritt.zugBis!).getTime() - Date.now();
    expect(rest).toBeGreaterThan(3 * 24 * 3600 * 1000 - 60_000);
    await aufgeben(duel.id, ben);
  });
});

describe.skipIf(!mitDatenbank)('K-Faktor über alle Saisons', () => {
  test('erfahrener Spieler hat in neuer Saison K = 20', async () => {
    await leereDatenbank();
    const [neu, erfahren] = [await neuerUser('neu'), await neuerUser('erfahren')];
    await erstelleFragen(6, 'wissen');
    const { aktuelleSaison } = await import('../src/services/saison');
    // 25 Duelle in der Vorsaison, Rating 1000 → Soft-Reset bleibt 1000
    await sqlAusfuehren(sql`insert into ratings values (${erfahren.id}, 'gesamt', ${aktuelleSaison() - 1}, 1000, 25)`);

    const duel = await neuesDuell(neu, erfahren);
    await aufgeben(duel.id, neu);

    expect(await details(duel.id, erfahren)).toMatchObject({ ratingAenderung: 10 }); // K = 20
    expect(await details(duel.id, neu)).toMatchObject({ ratingAenderung: -20 }); // K = 40
  });
});

describe.skipIf(!mitDatenbank)('Fragenauswahl', () => {
  let anna: User;
  let ben: User;

  beforeAll(async () => {
    await leereDatenbank();
    [anna, ben] = [await neuerUser('anna'), await neuerUser('ben')];
  });

  const fragenIds = async (duelId: number) =>
    [...await sqlAusfuehren(sql`select question_id from duel_questions where duel_id = ${duelId}`)].map((z) => (z as { question_id: number }).question_id);

  test('bereits gesehene Fragen kommen erst, wenn nichts Neues mehr da ist', async () => {
    await erstelleFragen(12, 'kulturen');
    const erstes = await neuesDuell(anna, ben, 'kulturen');
    const zweites = await neuesDuell(ben, anna, 'kulturen');
    const [a, b] = [await fragenIds(erstes.id), await fragenIds(zweites.id)];
    expect(a.filter((id) => b.includes(id))).toEqual([]);

    // alle 12 gesehen → drittes Duell geht trotzdem
    expect((await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'kulturen', gegner: ben.username } })).status).toBe(201);
  });

  test('gemischt verteilt auf alle Kategorien', async () => {
    await erstelleFragen(10, 'wissen');
    await erstelleFragen(10, 'krankheiten');
    await erstelleFragen(10, 'schaedlinge');
    const fremd = await neuerUser('fremd'); // hat noch nichts gesehen
    const duel = await neuesDuell(fremd, null, 'gemischt');
    const kategorien = [...await sqlAusfuehren(sql`
      select q.kategorie, count(*)::int as n from duel_questions dq join questions q on q.id = dq.question_id
      where dq.duel_id = ${duel.id} group by q.kategorie`)] as { kategorie: string; n: number }[];
    expect(kategorien).toHaveLength(4);
    expect(Math.max(...kategorien.map((k) => k.n))).toBe(2);
  });
});


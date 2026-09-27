import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { AnstupsenErgebnis, DuellDetails, DuellUebersicht, GestellteFrage, PushNachricht } from '@halmduell/shared';
import { anfrage, antwortIds, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;
interface Gesendet { endpoint: string; nachricht: PushNachricht }

const push = async () => import('../src/services/push');
const ende = async () => import('../src/services/duell-ende');

let gesendet: Gesendet[] = [];
/** Antwort des Push-Dienstes je Endpoint (Standard 201) */
let antwortVon: Record<string, number> = {};

const abo = (u: User, endpoint = `https://push.example/${u.username}`) =>
  anfrage('/push/abo', { method: 'POST', cookie: u.cookie, body: { endpoint, keys: { p256dh: 'BPUBLIC', auth: 'AUTH' } } });

async function versendet(): Promise<Gesendet[]> {
  await (await push()).allePushesVersendet();
  return gesendet;
}

async function runde(duelId: number, u: User) {
  for (let n = 0; n < 6; n++) {
    const frage = (await anfrage(`/duels/${duelId}/frage`, { cookie: u.cookie })).json as GestellteFrage;
    const ids = await antwortIds(frage.frageId);
    await anfrage(`/duels/${duelId}/antwort`, { method: 'POST', cookie: u.cookie, body: { frageId: frage.frageId, antwortId: n < 4 ? ids.richtig : ids.falsch } });
  }
}

describe.skipIf(!mitDatenbank)('Web Push', () => {
  let anna: User;
  let ben: User;

  beforeEach(async () => {
    await leereDatenbank();
    [anna, ben] = [await neuerUser('anna'), await neuerUser('ben')];
    gesendet = [];
    antwortVon = {};
    (await push()).setzePushSender(async (a, payload) => {
      gesendet.push({ endpoint: a.endpoint, nachricht: JSON.parse(payload) });
      return antwortVon[a.endpoint] ?? 201;
    });
  });

  afterAll(async () => {
    await (await push()).allePushesVersendet();
    (await push()).setzePushSender(null);
  });

  test('öffentlicher Schlüssel, Abo an- und abmelden', async () => {
    const schluessel = await anfrage('/push/schluessel');
    expect(schluessel.json.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);

    expect((await anfrage('/push/abo', { method: 'POST', body: {} })).status).toBe(401);
    expect((await anfrage('/push/abo', { method: 'POST', cookie: anna.cookie, body: { endpoint: 'http://unsicher', keys: { p256dh: 'x', auth: 'y' } } })).status).toBe(400);
    expect((await abo(anna)).status).toBe(204);
    expect((await abo(anna)).status).toBe(204); // idempotent
    // Gerät wechselt das Konto → Abo gehört danach Ben
    expect((await abo(ben, `https://push.example/${anna.username}`)).status).toBe(204);
    const zeilen = await sqlAusfuehren(sql`select user_id from push_subscriptions`);
    expect([...zeilen]).toEqual([{ user_id: ben.id }]);

    const weg = await anfrage('/push/abo', { method: 'DELETE', cookie: ben.cookie, body: { endpoint: `https://push.example/${anna.username}` } });
    expect(weg.status).toBe(204);
    expect([...await sqlAusfuehren(sql`select * from push_subscriptions`)]).toEqual([]);
  });

  test('Duell: Herausforderung nach As Runde, Ergebnis an A nach Bs Runde', async () => {
    await erstelleFragen(6, 'wissen');
    await abo(anna);
    await abo(ben);
    const duel = (await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'wissen', gegner: ben.username } })).json as DuellUebersicht;
    await runde(duel.id, anna);
    expect(await versendet()).toEqual([{
      endpoint: `https://push.example/${ben.username}`,
      nachricht: { titel: `${anna.username} fordert dich heraus!`, text: `Wissen – ${anna.username} hat die Runde gespielt, jetzt bist du dran.`, url: `/duell/${duel.id}`, tag: `duell-${duel.id}` },
    }]);

    gesendet = [];
    await runde(duel.id, ben);
    expect(await versendet()).toEqual([{
      endpoint: `https://push.example/${anna.username}`,
      nachricht: expect.objectContaining({ titel: `Unentschieden gegen ${ben.username}`, text: '4 : 4 – schau dir den Vergleich an.' }),
    }]);
  });

  test('Aufgeben benachrichtigt den Gegner; abgelaufene Abos werden entfernt', async () => {
    await erstelleFragen(6, 'wissen');
    await abo(ben);
    await abo(ben, 'https://push.example/altes-handy');
    antwortVon['https://push.example/altes-handy'] = 410;
    const duel = (await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'wissen', gegner: ben.username } })).json as DuellUebersicht;
    await anfrage(`/duels/${duel.id}/aufgeben`, { method: 'POST', cookie: anna.cookie });
    const n = await versendet();
    expect(n).toHaveLength(2);
    expect(n.every((g) => g.nachricht.titel === `${anna.username} hat aufgegeben`)).toBe(true);
    expect([...await sqlAusfuehren(sql`select endpoint from push_subscriptions`)]).toEqual([{ endpoint: `https://push.example/${ben.username}` }]);
  });

  test('Anstupsen: nur wenn der Gegner am Zug ist, höchstens alle 12 Stunden', async () => {
    await erstelleFragen(6, 'wissen');
    const duel = (await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'wissen', gegner: ben.username } })).json as DuellUebersicht;
    // Anna ist selbst dran
    expect((await anfrage(`/duels/${duel.id}/anstupsen`, { method: 'POST', cookie: anna.cookie })).status).toBe(409);
    expect(((await anfrage(`/duels/${duel.id}`, { cookie: anna.cookie })).json as DuellDetails).anstupsenAb).toBeNull();

    await runde(duel.id, anna);
    const details = (await anfrage(`/duels/${duel.id}`, { cookie: anna.cookie })).json as DuellDetails;
    expect(new Date(details.anstupsenAb!).getTime()).toBeLessThanOrEqual(Date.now());

    // Ben hat keine Benachrichtigungen → nicht zugestellt
    const ohne = await anfrage(`/duels/${duel.id}/anstupsen`, { method: 'POST', cookie: anna.cookie });
    expect(ohne.status).toBe(200);
    expect((ohne.json as AnstupsenErgebnis).zugestellt).toBe(false);
    expect((await anfrage(`/duels/${duel.id}/anstupsen`, { method: 'POST', cookie: anna.cookie })).status).toBe(429);
    const gesperrt = (await anfrage(`/duels/${duel.id}`, { cookie: anna.cookie })).json as DuellDetails;
    expect(new Date(gesperrt.anstupsenAb!).getTime()).toBeGreaterThan(Date.now() + 11 * 3600_000);

    // Sperre abgelaufen, Ben hat jetzt ein Abo
    await sqlAusfuehren(sql`update duels set angestupst_at = now() - interval '13 hours' where id = ${duel.id}`);
    await abo(ben);
    const mit = await anfrage(`/duels/${duel.id}/anstupsen`, { method: 'POST', cookie: anna.cookie });
    expect((mit.json as AnstupsenErgebnis).zugestellt).toBe(true);
    expect((await versendet()).at(-1)!.nachricht).toMatchObject({ titel: `${anna.username} stupst dich an` });

    // Ben selbst kann Anna nicht anstupsen (er ist dran)
    expect((await anfrage(`/duels/${duel.id}/anstupsen`, { method: 'POST', cookie: ben.cookie })).status).toBe(409);
  });

  test('Fristen: Erinnerung einmal je Zug, Ablauf an beide', async () => {
    await abo(anna);
    await abo(ben);
    const [d] = (await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status, zug_seit)
      values ('wissen', ${anna.id}, ${ben.id}, 'wartet_b', now() - interval '50 hours') returning id`)) as unknown as { id: number }[];
    const { verschickeErinnerungen, verarbeiteFristen } = await ende();

    expect(await verschickeErinnerungen()).toEqual({ erinnert: 1 });
    expect(await verschickeErinnerungen()).toEqual({ erinnert: 0 });
    expect(await versendet()).toEqual([{
      endpoint: `https://push.example/${ben.username}`,
      nachricht: expect.objectContaining({ titel: 'Nur noch 24 Stunden', text: `Dein Zug gegen ${anna.username} läuft bald ab.` }),
    }]);

    gesendet = [];
    await sqlAusfuehren(sql`update duels set zug_seit = now() - interval '73 hours' where id = ${d!.id}`);
    await verarbeiteFristen();
    const n = await versendet();
    expect(n.find((g) => g.endpoint.endsWith(anna.username))!.nachricht.titel).toBe(`Gewonnen gegen ${ben.username}`);
    expect(n.find((g) => g.endpoint.endsWith(ben.username))!.nachricht.titel).toBe('Frist verpasst');
  });

  test('Freundschaft: Anfrage und Annahme', async () => {
    await abo(anna);
    await abo(ben);
    await anfrage('/freunde', { method: 'POST', cookie: anna.cookie, body: { username: ben.username } });
    await anfrage(`/freunde/${anna.id}/annehmen`, { method: 'POST', cookie: ben.cookie });
    expect((await versendet()).map((g) => [g.endpoint.split('/').at(-1), g.nachricht.titel])).toEqual([
      [ben.username, 'Neue Freundschaftsanfrage'],
      [anna.username, `Du und ${ben.username} seid jetzt Freunde`],
    ]);
  });
});

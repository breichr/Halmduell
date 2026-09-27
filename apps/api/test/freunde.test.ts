import { beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { OFFENE_ANFRAGEN_MAX, aktuelleSaison, type Freundesliste, type Rangliste } from '@halmduell/shared';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const saison = aktuelleSaison();

const liste = async (u: User) => (await anfrage('/freunde', { cookie: u.cookie })).json as Freundesliste;
const anfragen = (von: User, an: User | string) =>
  anfrage('/freunde', { method: 'POST', cookie: von.cookie, body: { username: typeof an === 'string' ? an : an.username } });
const annehmen = (u: User, von: User) => anfrage(`/freunde/${von.id}/annehmen`, { method: 'POST', cookie: u.cookie });
const entfernen = (u: User, andere: User) => anfrage(`/freunde/${andere.id}`, { method: 'DELETE', cookie: u.cookie });

async function setzeRating(userId: number, kategorie: string, rating: number) {
  await sqlAusfuehren(sql`insert into ratings (user_id, kategorie, saison, rating, duelle_gespielt)
    values (${userId}, ${kategorie}, ${saison}, ${rating}, 1)`);
}

describe.skipIf(!mitDatenbank)('Freunde', () => {
  let anna: User;
  let ben: User;
  let clara: User;

  beforeEach(async () => {
    await leereDatenbank();
    [anna, ben, clara] = [await neuerUser('anna'), await neuerUser('ben'), await neuerUser('clara')];
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage('/freunde')).status).toBe(401);
    expect((await anfrage('/freunde', { method: 'POST', body: { username: 'x' } })).status).toBe(401);
  });

  test('Anfrage schicken, annehmen, beide sehen sich als Freunde', async () => {
    const res = await anfragen(anna, ben.username.toUpperCase());
    expect(res.status).toBe(201);
    expect(res.json).toEqual({ id: ben.id, username: ben.username, status: 'angefragt' });

    expect((await liste(anna)).gesendet.map((a) => a.id)).toEqual([ben.id]);
    const beiBen = await liste(ben);
    expect(beiBen.anfragen).toMatchObject([{ id: anna.id, username: anna.username }]);
    expect(beiBen.freunde).toEqual([]);
    expect((await anfrage('/freunde/anfragen/anzahl', { cookie: ben.cookie })).json).toEqual({ anzahl: 1 });

    expect((await annehmen(ben, anna)).status).toBe(204);
    expect((await liste(anna)).freunde.map((f) => f.username)).toEqual([ben.username]);
    const nachher = await liste(ben);
    expect(nachher.freunde.map((f) => f.username)).toEqual([anna.username]);
    expect(nachher.anfragen).toEqual([]);
    expect((await anfrage('/freunde/anfragen/anzahl', { cookie: ben.cookie })).json).toEqual({ anzahl: 0 });
  });

  test('Gegenanfrage gilt als Annahme', async () => {
    await anfragen(anna, ben);
    const res = await anfragen(ben, anna);
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('bestaetigt');
    expect((await liste(anna)).freunde).toHaveLength(1);
    expect((await liste(anna)).gesendet).toEqual([]);
  });

  test('Fehlerfälle beim Anfragen', async () => {
    expect((await anfragen(anna, 'gibtsnicht')).status).toBe(404);
    expect((await anfragen(anna, anna)).status).toBe(400);
    expect((await anfragen(anna, '')).status).toBe(400);
    await anfragen(anna, ben);
    expect((await anfragen(anna, ben)).status).toBe(409);
    await annehmen(ben, anna);
    const doppelt = await anfragen(anna, ben);
    expect(doppelt.status).toBe(409);
    expect(doppelt.json.error).toContain('schon');
  });

  test('nur der Empfänger kann annehmen', async () => {
    await anfragen(anna, ben);
    expect((await annehmen(anna, ben)).status).toBe(404);
    expect((await annehmen(clara, anna)).status).toBe(404);
    expect((await anfrage('/freunde/abc/annehmen', { method: 'POST', cookie: ben.cookie })).status).toBe(404);
  });

  test('ablehnen, zurückziehen und Freundschaft beenden', async () => {
    await anfragen(anna, ben);
    expect((await entfernen(ben, anna)).status).toBe(204); // abgelehnt
    expect((await liste(anna)).gesendet).toEqual([]);

    await anfragen(anna, ben);
    expect((await entfernen(anna, ben)).status).toBe(204); // zurückgezogen
    expect((await liste(ben)).anfragen).toEqual([]);

    await anfragen(anna, ben);
    await annehmen(ben, anna);
    expect((await entfernen(ben, anna)).status).toBe(204); // beendet
    expect((await liste(anna)).freunde).toEqual([]);
    expect((await entfernen(ben, anna)).status).toBe(404);
  });

  test('begrenzte Zahl offener Anfragen', async () => {
    const zeilen = await sqlAusfuehren(sql`insert into users (username, passwort_hash)
      select 'still' || n, 'x' from generate_series(1, ${OFFENE_ANFRAGEN_MAX}) as n returning id`);
    for (const { id } of zeilen as unknown as { id: number }[]) {
      await sqlAusfuehren(sql`insert into friendships (user_id, friend_id) values (${anna.id}, ${id})`);
    }
    expect((await anfragen(anna, ben)).status).toBe(429);
    // Annehmen einer fremden Anfrage geht trotzdem
    await anfragen(clara, anna);
    expect((await anfragen(anna, clara)).json.status).toBe('bestaetigt');
  });

  test('Freundesliste: Rating, laufendes Duell und Vorschläge', async () => {
    await anfragen(anna, ben);
    await annehmen(ben, anna);
    await setzeRating(ben.id, 'gesamt', 1150);
    // Anna fordert Ben und Clara heraus (Kategorie ohne Fragen → direkt per SQL)
    const [duell] = await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status)
      values ('wissen', ${anna.id}, ${ben.id}, 'wartet_b') returning id`) as unknown as { id: number }[];
    await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status)
      values ('wissen', ${clara.id}, ${anna.id}, 'abgeschlossen')`);

    const beiAnna = await liste(anna);
    expect(beiAnna.freunde).toEqual([{
      id: ben.id, username: ben.username, rating: 1150, liga: 'Gold', laufendesDuell: { id: duell!.id, duBistDran: false },
    }]);
    expect(beiAnna.vorschlaege).toEqual([{ id: clara.id, username: clara.username }]);

    const beiBen = await liste(ben);
    expect(beiBen.freunde[0]).toMatchObject({ rating: null, liga: null, laufendesDuell: { id: duell!.id, duBistDran: true } });
    expect(beiBen.vorschlaege).toEqual([]);
  });

  test('Rangliste im Freundeskreis', async () => {
    const fremd = await neuerUser('fremd');
    await setzeRating(anna.id, 'gesamt', 1000);
    await setzeRating(ben.id, 'gesamt', 1200);
    await setzeRating(clara.id, 'gesamt', 1100);
    await setzeRating(fremd.id, 'gesamt', 1300);
    await anfragen(anna, ben);
    await annehmen(ben, anna);
    await anfragen(anna, clara); // noch nicht angenommen → zählt nicht

    const freunde = (await anfrage('/rangliste?kreis=freunde', { cookie: anna.cookie })).json as Rangliste;
    expect(freunde.kreis).toBe('freunde');
    expect(freunde.spielerAnzahl).toBe(2);
    expect(freunde.eintraege.map((e) => [e.platz, e.username])).toEqual([[1, ben.username], [2, anna.username]]);
    expect(freunde.ich?.platz).toBe(2);

    const alle = (await anfrage('/rangliste', { cookie: anna.cookie })).json as Rangliste;
    expect(alle.kreis).toBe('alle');
    expect(alle.spielerAnzahl).toBe(4);
    expect(alle.ich?.platz).toBe(4);

    expect((await anfrage('/rangliste?kreis=quatsch', { cookie: anna.cookie })).status).toBe(400);
  });
});

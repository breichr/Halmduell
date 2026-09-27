import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { RANGLISTE_LAENGE, aktuelleSaison, type Rangliste } from '@halmduell/shared';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const saison = aktuelleSaison();
const rangliste = async (u: User, query = '') => {
  const res = await anfrage(`/rangliste${query}`, { cookie: u.cookie });
  return { status: res.status, daten: res.json as Rangliste };
};

async function setzeRating(userId: number, kategorie: string, s: number, rating: number, duelle = 1) {
  await sqlAusfuehren(sql`insert into ratings (user_id, kategorie, saison, rating, duelle_gespielt)
    values (${userId}, ${kategorie}, ${s}, ${rating}, ${duelle})`);
}

/** Legt Spieler direkt in der DB an (ohne teures Passwort-Hashing) */
async function stilleSpieler(anzahl: number, prefix: string): Promise<number[]> {
  const zeilen = await sqlAusfuehren(sql`insert into users (username, passwort_hash)
    select ${prefix} || n, 'x' from generate_series(1, ${anzahl}) as n returning id`);
  return (zeilen as unknown as { id: number }[]).map((z) => z.id);
}

describe.skipIf(!mitDatenbank)('Rangliste', () => {
  let anna: User;
  let ben: User;
  let clara: User;
  let neu: User;

  beforeAll(async () => {
    await leereDatenbank();
    [anna, ben, clara, neu] = [await neuerUser('anna'), await neuerUser('ben'), await neuerUser('clara'), await neuerUser('neu')];
    await setzeRating(anna.id, 'gesamt', saison, 1100, 3);
    await setzeRating(ben.id, 'gesamt', saison, 1100, 5);
    await setzeRating(clara.id, 'gesamt', saison, 980, 2);
    await setzeRating(anna.id, 'kulturen', saison, 1020, 1);
    // Vorsaison: Clara vorne
    await setzeRating(clara.id, 'gesamt', saison - 1, 1300, 12);
    await setzeRating(anna.id, 'gesamt', saison - 1, 1000, 4);
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage('/rangliste')).status).toBe(401);
  });

  test('laufende Saison, Gesamt: gleiches Rating = gleicher Platz, mehr Duelle zuerst', async () => {
    const { status, daten } = await rangliste(anna);
    expect(status).toBe(200);
    expect(daten.kategorie).toBe('gesamt');
    expect(daten.saison).toBe(saison);
    expect(daten.aktuelleSaison).toBe(saison);
    expect(daten.spielerAnzahl).toBe(3);
    expect(daten.eintraege.map((e) => [e.platz, e.username, e.rating])).toEqual([
      [1, ben.username, 1100],
      [1, anna.username, 1100],
      [3, clara.username, 980],
    ]);
    expect(daten.eintraege[0]!.liga).toBe('Gold');
    expect(daten.eintraege[2]!.liga).toBe('Silber');
    expect(daten.ich).toMatchObject({ platz: 1, id: anna.id, duelle: 3 });
    expect(daten.saisons).toEqual([saison, saison - 1]);
  });

  test('wer noch nicht gespielt hat, ist nicht platziert', async () => {
    const { daten } = await rangliste(neu);
    expect(daten.ich).toBeNull();
    expect(daten.eintraege.some((e) => e.id === neu.id)).toBe(false);
  });

  test('je Kategorie eigene Liste', async () => {
    const { daten } = await rangliste(ben, '?kategorie=kulturen');
    expect(daten.eintraege.map((e) => e.username)).toEqual([anna.username]);
    expect(daten.ich).toBeNull();
    const wissen = await rangliste(ben, '?kategorie=wissen');
    expect(wissen.daten.eintraege).toEqual([]);
    expect(wissen.daten.spielerAnzahl).toBe(0);
  });

  test('vergangene Saison bleibt abrufbar', async () => {
    const { daten } = await rangliste(anna, `?saison=${saison - 1}`);
    expect(daten.saison).toBe(saison - 1);
    expect(daten.eintraege.map((e) => [e.platz, e.username])).toEqual([[1, clara.username], [2, anna.username]]);
    expect(daten.ich).toMatchObject({ platz: 2, rating: 1000 });
  });

  test('ungültige Eingaben → 400', async () => {
    expect((await rangliste(anna, '?kategorie=gemischt')).status).toBe(400);
    expect((await rangliste(anna, '?saison=0')).status).toBe(400);
    expect((await rangliste(anna, '?saison=abc')).status).toBe(400);
    expect((await rangliste(anna, `?saison=${saison + 1}`)).status).toBe(400);
  });

  test(`zeigt höchstens ${RANGLISTE_LAENGE} Plätze, den eigenen aber immer`, async () => {
    const ids = await stilleSpieler(RANGLISTE_LAENGE + 5, 'profi');
    for (const id of ids) await setzeRating(id, 'krankheiten', saison, 1200);
    await setzeRating(clara.id, 'krankheiten', saison, 850);
    const { daten } = await rangliste(clara, '?kategorie=krankheiten');
    expect(daten.eintraege).toHaveLength(RANGLISTE_LAENGE);
    expect(daten.spielerAnzahl).toBe(RANGLISTE_LAENGE + 6);
    expect(daten.eintraege.some((e) => e.id === clara.id)).toBe(false);
    expect(daten.ich).toMatchObject({ platz: RANGLISTE_LAENGE + 6, liga: 'Bronze' });
  });

});

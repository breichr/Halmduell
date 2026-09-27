import { beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { OFFENE_ZUFALLSDUELLE_MAX, aktuelleSaison, type DuellUebersicht, type GestellteFrage } from '@halmduell/shared';
import { anfrage, antwortIds, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const zufall = (u: User, kategorie = 'pflanzenbau') =>
  anfrage('/duels', { method: 'POST', cookie: u.cookie, body: { kategorie, zufall: true } });

/** Spielt die komplette Runde (immer richtig) */
async function spieleRunde(duelId: number, u: User) {
  for (let i = 0; i < 6; i++) {
    const frage = (await anfrage(`/duels/${duelId}/frage`, { cookie: u.cookie })).json as GestellteFrage;
    const ids = await antwortIds(frage.frageId);
    await anfrage(`/duels/${duelId}/antwort`, { method: 'POST', cookie: u.cookie, body: { frageId: frage.frageId, antwortId: ids.richtig } });
  }
}

async function setzeRating(userId: number, rating: number) {
  await sqlAusfuehren(sql`insert into ratings (user_id, kategorie, saison, rating, duelle_gespielt)
    values (${userId}, 'gesamt', ${aktuelleSaison()}, ${rating}, 1)`);
}

describe.skipIf(!mitDatenbank)('Zufallsgegner', () => {
  let anna: User;
  let ben: User;
  let clara: User;

  beforeEach(async () => {
    await leereDatenbank();
    [anna, ben, clara] = [await neuerUser('anna'), await neuerUser('ben'), await neuerUser('clara')];
    await erstelleFragen(12, 'pflanzenbau');
    await erstelleFragen(6, 'landtechnik');
  });

  test('niemand wartet: neues Zufallsduell ohne Einladungscode, ich spiele zuerst', async () => {
    const res = await zufall(anna);
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ zufall: true, gegner: null, einladungsCode: null, duBistDran: true, status: 'wartet_a' });
  });

  test('Gegner und Zufall gleichzeitig ist ungültig', async () => {
    const res = await anfrage('/duels', { method: 'POST', cookie: anna.cookie, body: { kategorie: 'pflanzenbau', zufall: true, gegner: ben.username } });
    expect(res.status).toBe(400);
  });

  test('wer sucht, tritt einem wartenden Duell bei, dessen Runde schon gespielt ist', async () => {
    const offen = (await zufall(anna)).json as DuellUebersicht;
    // Anna hat noch nicht gespielt → Ben bekommt ein eigenes Duell
    const bensEigenes = (await zufall(ben)).json as DuellUebersicht;
    expect(bensEigenes.id).not.toBe(offen.id);

    await spieleRunde(offen.id, anna);
    const res = await zufall(clara);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ id: offen.id, gegner: { id: anna.id }, duBistDran: true, status: 'wartet_b', zufall: true });

    // Anna sieht jetzt Clara als Gegnerin; nicht mehr im Pool
    const beiAnna = ((await anfrage('/duels', { cookie: anna.cookie })).json as DuellUebersicht[]).find((d) => d.id === offen.id);
    expect(beiAnna?.gegner?.username).toBe(clara.username);
    expect((await zufall(ben)).status).toBe(201);
  });

  test('nur gleiche Kategorie, nicht das eigene, nicht abgelaufene', async () => {
    const eigenes = (await zufall(anna)).json as DuellUebersicht;
    await spieleRunde(eigenes.id, anna);
    // eigenes Duell wird nicht gefunden
    expect((await zufall(anna)).status).toBe(201);
    // andere Kategorie auch nicht
    expect((await zufall(ben, 'landtechnik')).status).toBe(201);
    // abgelaufen (älter als 7 Tage) auch nicht
    await sqlAusfuehren(sql`update duels set erstellt_at = now() - interval '8 days' where id = ${eigenes.id}`);
    expect((await zufall(ben)).json).toMatchObject({ gegner: null });
  });

  test('kein Zufallsduell gegen jemanden, mit dem schon ein Duell läuft', async () => {
    const offen = (await zufall(anna)).json as DuellUebersicht;
    await spieleRunde(offen.id, anna);
    await anfrage('/duels', { method: 'POST', cookie: ben.cookie, body: { kategorie: 'pflanzenbau', gegner: anna.username } });
    expect((await zufall(ben)).json).toMatchObject({ gegner: null });
    expect((await zufall(clara)).json).toMatchObject({ id: offen.id });
  });

  test('bevorzugt ähnliches Gesamt-Rating', async () => {
    const dora = await neuerUser('dora');
    await setzeRating(anna.id, 1400);
    await setzeRating(ben.id, 1010);
    await setzeRating(dora.id, 1380);
    const vonAnna = (await zufall(anna)).json as DuellUebersicht;
    const vonBen = (await zufall(ben)).json as DuellUebersicht;
    await spieleRunde(vonAnna.id, anna);
    await spieleRunde(vonBen.id, ben);
    // Dora (1380) landet bei Anna (1400), Clara (ohne Rating = 1000) bei Ben
    expect((await zufall(dora)).json).toMatchObject({ id: vonAnna.id });
    expect((await zufall(clara)).json).toMatchObject({ id: vonBen.id });
  });

  test('höchstens drei offene Suchen gleichzeitig', async () => {
    for (let i = 0; i < OFFENE_ZUFALLSDUELLE_MAX; i++) expect((await zufall(anna)).status).toBe(201);
    const res = await zufall(anna);
    expect(res.status).toBe(429);
    expect(res.json.error).toContain('Gegner');
  });

  test('Zufallsduell ohne Gegner verfällt nach sieben Tagen ohne Wertung', async () => {
    const offen = (await zufall(anna)).json as DuellUebersicht;
    await spieleRunde(offen.id, anna);
    const { verarbeiteFristen } = await import('../src/services/duell-ende');
    await verarbeiteFristen(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
    const d = (await anfrage(`/duels/${offen.id}`, { cookie: anna.cookie })).json as DuellUebersicht;
    expect(d).toMatchObject({ status: 'abgebrochen', ratingAenderung: null });
  });
});

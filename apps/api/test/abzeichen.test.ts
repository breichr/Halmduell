import { beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { ABZEICHEN, EXPERTEN_ZIEL, aktuelleSaison, type AbzeichenListe } from '@halmduell/shared';
import { anfrage, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const liste = async (u: User) => (await anfrage('/abzeichen', { cookie: u.cookie })).json as AbzeichenListe;
const eintrag = (l: AbzeichenListe, key: string) => l.abzeichen.find((a) => a.key === key)!;
const erreicht = (l: AbzeichenListe) => l.abzeichen.filter((a) => a.erreichtAt).map((a) => a.key).sort();

async function frageIds(kategorie: string): Promise<number[]> {
  const zeilen = await sqlAusfuehren(sql`select id from questions where kategorie = ${kategorie} order by id`);
  return (zeilen as unknown as { id: number }[]).map((z) => z.id);
}

let minute = 0;
/** Abgeschlossenes Duell direkt in der DB; `richtig` = je Frage richtig/falsch für a, b antwortet immer falsch */
async function duell(a: User, b: User, fragen: number[], richtig: boolean[], ms = 5000) {
  minute++;
  const [d] = (await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status, abgeschlossen_at)
    values ('gemischt', ${a.id}, ${b.id}, 'abgeschlossen', now() + ${`${minute} minutes`}::interval) returning id`)) as unknown as { id: number }[];
  for (const [i, frage] of fragen.entries()) {
    await sqlAusfuehren(sql`insert into duel_answers (duel_id, user_id, question_id, beantwortet_at, antwortzeit_ms, ist_richtig)
      values (${d!.id}, ${a.id}, ${frage}, now(), ${ms}, ${richtig[i] ?? false}),
             (${d!.id}, ${b.id}, ${frage}, now(), ${ms}, false)`);
  }
  return d!.id;
}

describe.skipIf(!mitDatenbank)('Abzeichen', () => {
  let anna: User;
  let ben: User;
  let pflanzenbau: number[];

  beforeEach(async () => {
    await leereDatenbank();
    [anna, ben] = [await neuerUser('anna'), await neuerUser('ben')];
    await erstelleFragen(6, 'pflanzenbau');
    pflanzenbau = await frageIds('pflanzenbau');
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage('/abzeichen')).status).toBe(401);
  });

  test('neu: nichts erreicht, alle Abzeichen mit Fortschritt sichtbar', async () => {
    const l = await liste(anna);
    expect(l.erreicht).toBe(0);
    expect(l.abzeichen.map((a) => a.key)).toEqual(ABZEICHEN.map((a) => a.key));
    expect(eintrag(l, 'zehn_duelle')).toMatchObject({ erreichtAt: null, stand: 0, ziel: 10 });
    expect(eintrag(l, 'volle_scheune')).toMatchObject({ erreichtAt: null, stand: null });
  });

  test('Meilensteine, Serie und volle Scheune', async () => {
    await duell(anna, ben, pflanzenbau, [true, true, true, true, true, true]);
    await duell(anna, ben, pflanzenbau.slice(0, 2), [true, false]);
    await duell(anna, ben, pflanzenbau.slice(0, 1), [true]);
    const l = await liste(anna);
    expect(erreicht(l)).toEqual(['erster_sieg', 'erstes_duell', 'siegesserie', 'volle_scheune']);
    expect(eintrag(l, 'zehn_duelle')).toMatchObject({ erreichtAt: null, stand: 3 });
    expect(eintrag(l, 'siegesserie')).toMatchObject({ stand: null });
    expect(eintrag(l, 'siegesserie').erreichtAt).not.toBeNull();
    expect(eintrag(l, 'pflanzenbau_experte')).toMatchObject({ erreichtAt: null, stand: 8 });

    // Ben hat alles verloren: nur „Erste Schritte“
    expect(erreicht(await liste(ben))).toEqual(['erstes_duell']);
  });

  test('Serie zählt nur ununterbrochene Siege', async () => {
    await duell(anna, ben, pflanzenbau.slice(0, 1), [true]);
    await duell(anna, ben, pflanzenbau.slice(0, 1), [true]);
    await duell(anna, ben, pflanzenbau.slice(0, 1), [false]); // unentschieden 0:0
    await duell(anna, ben, pflanzenbau.slice(0, 1), [true]);
    expect(eintrag(await liste(anna), 'siegesserie')).toMatchObject({ erreichtAt: null, stand: 2 });
  });

  test('Kategorie-Experte ab 50 richtigen, Blitzmerker unter 2 Sekunden', async () => {
    // 50 richtige Pflanzenbaufragen über mehrere Duelle (je 5, die Fragen dürfen sich wiederholen)
    for (let i = 0; i < EXPERTEN_ZIEL / 5; i++) await duell(anna, ben, pflanzenbau.slice(0, 5), [true, true, true, true, true]);
    let l = await liste(anna);
    expect(eintrag(l, 'pflanzenbau_experte').erreichtAt).not.toBeNull();
    expect(eintrag(l, 'blitzmerker').erreichtAt).toBeNull();

    await duell(anna, ben, pflanzenbau.slice(0, 1), [true], 1500);
    l = await liste(anna);
    expect(eintrag(l, 'blitzmerker').erreichtAt).not.toBeNull();
    expect(eintrag(l, 'zehn_duelle').erreichtAt).not.toBeNull();
  });

  test('Liga Gold und Saison-Abzeichen', async () => {
    const s = aktuelleSaison();
    const andere = await Promise.all(Array.from({ length: 10 }, (_, i) => neuerUser(`mitte${i}`)));
    await sqlAusfuehren(sql`insert into ratings (user_id, kategorie, saison, rating, duelle_gespielt) values
      (${anna.id}, 'gesamt', ${s - 1}, 1250, 5), (${ben.id}, 'gesamt', ${s - 1}, 1000, 5), (${ben.id}, 'gesamt', ${s}, 1500, 5)`);
    for (const [i, u] of andere.entries()) {
      await sqlAusfuehren(sql`insert into ratings (user_id, kategorie, saison, rating, duelle_gespielt) values (${u.id}, 'gesamt', ${s - 1}, ${1010 + i}, 1)`);
    }
    // Anna: Platz 1 der Vorsaison, Gold erreicht
    expect(erreicht(await liste(anna))).toEqual(['liga_gold', 'saison_meister', 'saison_top10']);
    // Ben: Platz 12 der Vorsaison, laufende Saison zählt noch nicht – aber sein Rating (Platin) für Liga Gold
    expect(erreicht(await liste(ben))).toEqual(['liga_gold']);
  });

  test('Gesellig bei 3 Freunden, auch wenn der andere annimmt', async () => {
    const freunde = await Promise.all([neuerUser('f1'), neuerUser('f2'), neuerUser('f3')]);
    for (const f of freunde) {
      await anfrage('/freunde', { method: 'POST', cookie: anna.cookie, body: { username: f.username } });
      await anfrage(`/freunde/${anna.id}/annehmen`, { method: 'POST', cookie: f.cookie });
    }
    const rows = await sqlAusfuehren(sql`select a.key from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = ${anna.id}`);
    expect([...rows]).toEqual([{ key: 'gesellig' }]);
  });

  test('Vergeben ist idempotent', async () => {
    await duell(anna, ben, pflanzenbau.slice(0, 1), [true]);
    await liste(anna);
    await liste(anna);
    const [zeile] = (await sqlAusfuehren(sql`select count(*)::int as anzahl from user_achievements where user_id = ${anna.id}`)) as unknown as { anzahl: number }[];
    expect(zeile?.anzahl).toBe(2);
  });
});

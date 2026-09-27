import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { aktuelleSaison, type Statistik } from '@halmduell/shared';
import { anfrage, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;
type Antwort = 'richtig' | 'falsch' | 'abgelaufen' | 'offen';

const statistik = async (u: User) => (await anfrage('/statistik', { cookie: u.cookie })).json as Statistik;

async function frageIds(kategorie: string): Promise<number[]> {
  const zeilen = await sqlAusfuehren(sql`select id from questions where kategorie = ${kategorie} order by id`);
  return (zeilen as unknown as { id: number }[]).map((z) => z.id);
}

let zeitpunkt = 0;
/** Legt ein Duell samt Antworten direkt in der DB an; spätere Aufrufe gelten als neuer */
async function duell(
  a: User,
  b: User,
  status: 'abgeschlossen' | 'abgebrochen' | 'wartet_b',
  antworten: { user: User; frage: number; antwort: Antwort; ms?: number }[],
  aufgegebenVon: User | null = null,
) {
  zeitpunkt++;
  const [d] = (await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status, abgeschlossen_at, aufgegeben_von)
    values ('gemischt', ${a.id}, ${b.id}, ${status}, now() + ${`${zeitpunkt} minutes`}::interval, ${aufgegebenVon?.id ?? null})
    returning id`)) as unknown as { id: number }[];
  for (const x of antworten) {
    const optionen = (await sqlAusfuehren(sql`select id, ist_richtig from answer_options where question_id = ${x.frage} order by id`)) as unknown as { id: number; ist_richtig: boolean }[];
    const option = x.antwort === 'richtig' ? optionen.find((o) => o.ist_richtig)!.id
      : x.antwort === 'falsch' ? optionen.find((o) => !o.ist_richtig)!.id : null;
    const beantwortet = x.antwort !== 'offen';
    await sqlAusfuehren(sql`insert into duel_answers (duel_id, user_id, question_id, beantwortet_at, answer_option_id, antwortzeit_ms, ist_richtig)
      values (${d!.id}, ${x.user.id}, ${x.frage}, ${beantwortet ? sql`now()` : null}, ${option}, ${beantwortet ? (x.ms ?? 5000) : null},
        ${beantwortet ? x.antwort === 'richtig' : null})`);
  }
}

describe.skipIf(!mitDatenbank)('Statistik', () => {
  let anna: User;
  let ben: User;
  let neu: User;
  let wissen: number[];
  let kulturen: number[];

  beforeAll(async () => {
    await leereDatenbank();
    [anna, ben, neu] = [await neuerUser('anna'), await neuerUser('ben'), await neuerUser('neu')];
    await erstelleFragen(3, 'wissen');
    await erstelleFragen(2, 'kulturen');
    [wissen, kulturen] = [await frageIds('wissen'), await frageIds('kulturen')];

    // 1. Anna gewinnt 2:1 (älteste)
    await duell(anna, ben, 'abgeschlossen', [
      { user: anna, frage: wissen[0]!, antwort: 'richtig', ms: 3000 },
      { user: anna, frage: kulturen[0]!, antwort: 'richtig', ms: 5000 },
      { user: anna, frage: wissen[1]!, antwort: 'abgelaufen' },
      { user: ben, frage: wissen[0]!, antwort: 'richtig' },
    ]);
    // 2. Unentschieden 1:1, Ben als Herausforderer
    await duel2();
    // 3. + 4. Anna verliert: nach Punkten 0:1 und durch Aufgabe trotz Führung
    await duell(anna, ben, 'abgeschlossen', [
      { user: anna, frage: wissen[2]!, antwort: 'falsch' },
      { user: ben, frage: wissen[2]!, antwort: 'richtig' },
    ]);
    await duell(anna, ben, 'abgeschlossen', [{ user: anna, frage: kulturen[1]!, antwort: 'richtig', ms: 1000 }], anna);
    // Abgebrochen und laufend: zählen nicht als Duell, beantwortete Fragen aber schon
    await duell(anna, ben, 'abgebrochen', [{ user: anna, frage: wissen[0]!, antwort: 'falsch' }]);
    await duell(anna, ben, 'wartet_b', [{ user: anna, frage: wissen[1]!, antwort: 'offen' }]);

    await sqlAusfuehren(sql`insert into ratings (user_id, kategorie, saison, rating, duelle_gespielt)
      values (${anna.id}, 'gesamt', ${aktuelleSaison()}, 1310, 4), (${anna.id}, 'gesamt', ${aktuelleSaison() - 1}, 900, 2)`);

    async function duel2() {
      await duell(ben, anna, 'abgeschlossen', [
        { user: anna, frage: kulturen[0]!, antwort: 'falsch' },
        { user: anna, frage: wissen[1]!, antwort: 'richtig', ms: 2000 },
        { user: ben, frage: kulturen[0]!, antwort: 'richtig' },
      ]);
    }
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage('/statistik')).status).toBe(401);
  });

  test('Bilanz, Form und Serie', async () => {
    const s = await statistik(anna);
    expect(s.duelle).toEqual({ gespielt: 4, siege: 1, unentschieden: 1, niederlagen: 2 });
    expect(s.form).toEqual(['niederlage', 'niederlage', 'unentschieden', 'sieg']);
    expect(s.serie).toEqual({ ausgang: 'niederlage', laenge: 2 });

    const b = await statistik(ben);
    expect(b.duelle).toEqual({ gespielt: 4, siege: 2, unentschieden: 1, niederlagen: 1 });
    expect(b.serie).toEqual({ ausgang: 'sieg', laenge: 2 });
  });

  test('Trefferquote gesamt und je Kategorie', async () => {
    const s = await statistik(anna);
    // richtig: w0, k0, w1, k1 · falsch: k0, w2, w0 · abgelaufen: w1 · offen zählt nicht
    expect(s.fragen).toEqual({ beantwortet: 8, richtig: 4, abgelaufen: 1, schnittRichtigMs: 2750 });
    expect(s.kategorien).toEqual([
      { kategorie: 'kulturen', beantwortet: 3, richtig: 2 },
      { kategorie: 'schaedlinge', beantwortet: 0, richtig: 0 },
      { kategorie: 'krankheiten', beantwortet: 0, richtig: 0 },
      { kategorie: 'wissen', beantwortet: 5, richtig: 2 },
    ]);
  });

  test('Ratings nur aus der laufenden Saison', async () => {
    const s = await statistik(anna);
    expect(s.saison).toBe(aktuelleSaison());
    expect(s.ratings[0]).toEqual({ kategorie: 'gesamt', rating: 1310, liga: 'Platin' });
    expect(s.ratings.slice(1).every((r) => r.rating === null && r.liga === null)).toBe(true);
  });

  test('ohne Duelle alles leer', async () => {
    const s = await statistik(neu);
    expect(s.duelle).toEqual({ gespielt: 0, siege: 0, unentschieden: 0, niederlagen: 0 });
    expect(s.form).toEqual([]);
    expect(s.serie).toBeNull();
    expect(s.fragen).toEqual({ beantwortet: 0, richtig: 0, abgelaufen: 0, schnittRichtigMs: null });
    expect(s.kategorien.every((k) => k.beantwortet === 0)).toBe(true);
  });
});

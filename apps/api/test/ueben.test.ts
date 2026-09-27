import { beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { AbzeichenListe, UebenUebersicht, UebungsErgebnis, UebungsRunde } from '@halmduell/shared';
import { anfrage, antwortIds, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const uebersicht = async (u: User) => (await anfrage('/ueben', { cookie: u.cookie })).json as UebenUebersicht;
const runde = async (u: User, query = '') => (await anfrage(`/ueben/frage${query}`, { cookie: u.cookie })).json as UebungsRunde;
const antworten = (u: User, frageId: number, antwortId: number, kategorie?: string) =>
  anfrage('/ueben/antwort', { method: 'POST', cookie: u.cookie, body: { frageId, antwortId, ...(kategorie ? { kategorie } : {}) } });

async function frageIds(kategorie: string): Promise<number[]> {
  const zeilen = await sqlAusfuehren(sql`select id from questions where kategorie = ${kategorie} order by id`);
  return (zeilen as unknown as { id: number }[]).map((z) => z.id);
}

/** Duell mit Antworten direkt in der DB; `falsch`: Fragen, die u falsch (bzw. `null` = Zeit abgelaufen) beantwortet */
async function duellMit(u: User, gegner: User, antworten: { frage: number; richtig: boolean | null; vorMinuten?: number }[]) {
  const [d] = (await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status)
    values ('gemischt', ${u.id}, ${gegner.id}, 'wartet_b') returning id`)) as unknown as { id: number }[];
  for (const a of antworten) {
    const ids = await antwortIds(a.frage);
    await sqlAusfuehren(sql`insert into duel_answers (duel_id, user_id, question_id, beantwortet_at, answer_option_id, antwortzeit_ms, ist_richtig)
      values (${d!.id}, ${u.id}, ${a.frage}, now() - ${`${a.vorMinuten ?? 0} minutes`}::interval,
        ${a.richtig === null ? null : a.richtig ? ids.richtig : ids.falsch}, 5000, ${a.richtig ?? false})`);
  }
}

describe.skipIf(!mitDatenbank)('Fehler üben', () => {
  let anna: User;
  let ben: User;
  let pflanzenbau: number[];
  let landtechnik: number[];

  beforeEach(async () => {
    await leereDatenbank();
    [anna, ben] = [await neuerUser('anna'), await neuerUser('ben')];
    await erstelleFragen(3, 'pflanzenbau');
    await erstelleFragen(2, 'landtechnik');
    [pflanzenbau, landtechnik] = [await frageIds('pflanzenbau'), await frageIds('landtechnik')];
  });

  test('ohne Anmeldung 401', async () => {
    expect((await anfrage('/ueben')).status).toBe(401);
    expect((await anfrage('/ueben/frage')).status).toBe(401);
  });

  test('offen sind nur falsch beantwortete Fragen (auch Zeit abgelaufen), eigene', async () => {
    await duellMit(anna, ben, [
      { frage: pflanzenbau[0]!, richtig: false },
      { frage: pflanzenbau[1]!, richtig: null },
      { frage: pflanzenbau[2]!, richtig: true },
      { frage: landtechnik[0]!, richtig: false },
    ]);
    await duellMit(ben, anna, [{ frage: landtechnik[1]!, richtig: false }]);
    expect(await uebersicht(anna)).toEqual({
      offen: 3,
      jeKategorie: [
        { kategorie: 'landtechnik', offen: 1 },
        { kategorie: 'pflanzenbau', offen: 2 },
        { kategorie: 'viehzucht', offen: 0 },
      ],
      gemeistert: 0,
    });
    expect((await uebersicht(ben)).offen).toBe(1);

    const r = await runde(anna, '?kategorie=landtechnik');
    expect(r.offen).toBe(1);
    expect(r.frage).toMatchObject({ frageId: landtechnik[0], kategorie: 'landtechnik', richtigInFolge: 0 });
    expect(r.frage!.antworten).toHaveLength(4);
    expect(Object.keys(r.frage!.antworten[0]!).sort()).toEqual(['id', 'text']);
    expect((await runde(anna, '?kategorie=viehzucht'))).toEqual({ frage: null, offen: 0 });
    expect((await anfrage('/ueben/frage?kategorie=obst', { cookie: anna.cookie })).status).toBe(400);
  });

  test('zweimal in Folge richtig = gemeistert, ein Fehler setzt zurück', async () => {
    await duellMit(anna, ben, [{ frage: pflanzenbau[0]!, richtig: false }, { frage: pflanzenbau[1]!, richtig: false }]);
    const ids = await antwortIds(pflanzenbau[0]!);

    let e = (await antworten(anna, pflanzenbau[0]!, ids.richtig)).json as UebungsErgebnis;
    expect(e).toMatchObject({ richtig: true, richtigeAntwortId: ids.richtig, erklaerung: 'Weil es so ist.', richtigInFolge: 1, gemeistert: false, offen: 2 });
    e = (await antworten(anna, pflanzenbau[0]!, ids.falsch)).json as UebungsErgebnis;
    expect(e).toMatchObject({ richtig: false, richtigInFolge: 0, gemeistert: false, offen: 2 });
    await antworten(anna, pflanzenbau[0]!, ids.richtig);
    e = (await antworten(anna, pflanzenbau[0]!, ids.richtig)).json as UebungsErgebnis;
    expect(e).toMatchObject({ richtig: true, richtigInFolge: 2, gemeistert: true, offen: 1 });

    expect(await uebersicht(anna)).toMatchObject({ offen: 1, gemeistert: 1 });
    // gemeistert → nicht mehr offen, also auch nicht mehr beantwortbar
    expect((await antworten(anna, pflanzenbau[0]!, ids.richtig)).status).toBe(409);
  });

  test('neuer Fehler im Duell holt eine gemeisterte Frage zurück', async () => {
    await duellMit(anna, ben, [{ frage: pflanzenbau[0]!, richtig: false, vorMinuten: 10 }]);
    const ids = await antwortIds(pflanzenbau[0]!);
    await antworten(anna, pflanzenbau[0]!, ids.richtig);
    await antworten(anna, pflanzenbau[0]!, ids.richtig);
    expect(await uebersicht(anna)).toMatchObject({ offen: 0, gemeistert: 1 });

    await duellMit(anna, ben, [{ frage: pflanzenbau[0]!, richtig: false }]);
    expect(await uebersicht(anna)).toMatchObject({ offen: 1, gemeistert: 0 });
    expect((await runde(anna)).frage).toMatchObject({ frageId: pflanzenbau[0], richtigInFolge: 0 });
  });

  test('keine Lösungen für fremde Fragen: nur offene Fragen sind beantwortbar', async () => {
    await duellMit(anna, ben, [{ frage: pflanzenbau[0]!, richtig: true }]);
    const ids = await antwortIds(pflanzenbau[0]!);
    const res = await antworten(anna, pflanzenbau[0]!, ids.richtig);
    expect(res.status).toBe(409);
    expect(res.json.richtigeAntwortId).toBeUndefined();
    // Antwort einer anderen Frage
    await duellMit(anna, ben, [{ frage: pflanzenbau[1]!, richtig: false }]);
    expect((await antworten(anna, pflanzenbau[1]!, ids.richtig)).status).toBe(400);
  });

  test('zuletzt geübte Frage kommt nicht direkt wieder, nie geübte zuerst', async () => {
    await duellMit(anna, ben, [{ frage: pflanzenbau[0]!, richtig: false }, { frage: pflanzenbau[1]!, richtig: false }]);
    const erste = (await runde(anna)).frage!;
    const ids = await antwortIds(erste.frageId);
    await antworten(anna, erste.frageId, ids.falsch);
    for (let i = 0; i < 5; i++) {
      expect((await runde(anna, `?ohne=${erste.frageId}`)).frage!.frageId).not.toBe(erste.frageId);
      // nie geübt vor zuletzt geübt – auch ohne „ohne“
      expect((await runde(anna)).frage!.frageId).not.toBe(erste.frageId);
    }
    // Nur noch eine offen → sie kommt trotz „ohne“
    const zweite = pflanzenbau.find((w) => w !== erste.frageId && w !== pflanzenbau[2])!;
    const ids2 = await antwortIds(zweite);
    await antworten(anna, zweite, ids2.richtig);
    await antworten(anna, zweite, ids2.richtig);
    expect((await runde(anna, `?ohne=${erste.frageId}`)).frage!.frageId).toBe(erste.frageId);
  });

  test('Abzeichen „Nachgelernt“ nach 10 gemeisterten Fragen', async () => {
    await erstelleFragen(7, 'pflanzenbau');
    const alle = await frageIds('pflanzenbau');
    await duellMit(anna, ben, alle.slice(0, 10).map((frage) => ({ frage, richtig: false })));
    let letztes: UebungsErgebnis | null = null;
    for (const frage of alle.slice(0, 10)) {
      const ids = await antwortIds(frage);
      await antworten(anna, frage, ids.richtig);
      letztes = (await antworten(anna, frage, ids.richtig)).json as UebungsErgebnis;
    }
    expect(letztes!.neueAbzeichen.map((a) => a.key)).toEqual(['nachgelernt']);
    const l = (await anfrage('/abzeichen', { cookie: anna.cookie })).json as AbzeichenListe;
    expect(l.abzeichen.find((a) => a.key === 'nachgelernt')!.erreichtAt).not.toBeNull();
  });
});

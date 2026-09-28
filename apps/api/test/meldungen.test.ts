import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { MELDUNGEN_PRO_TAG, type PushNachricht, type AdminFrage, type AdminFragenListe, type AdminMeldung, type DuellDetails } from '@halmduell/shared';
import { anfrage, antwortIds, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const melden = (u: User, frageId: number, body: unknown = { grund: 'antwort_falsch' }) =>
  anfrage(`/fragen/${frageId}/melden`, { method: 'POST', cookie: u.cookie, body });

/** Duell in der DB; `u` hat die Fragen beantwortet (true = richtig, false = falsch, null = Zeit abgelaufen) */
async function duellMit(u: User, gegner: User, antworten: { frage: number; richtig: boolean | null }[]) {
  const [d] = (await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status)
    values ('gemischt', ${u.id}, ${gegner.id}, 'wartet_b') returning id`)) as unknown as { id: number }[];
  for (const [i, a] of antworten.entries()) {
    const ids = await antwortIds(a.frage);
    await sqlAusfuehren(sql`insert into duel_questions (duel_id, question_id, reihenfolge) values (${d!.id}, ${a.frage}, ${i + 1})`);
    await sqlAusfuehren(sql`insert into duel_answers (duel_id, user_id, question_id, beantwortet_at, answer_option_id, antwortzeit_ms, ist_richtig)
      values (${d!.id}, ${u.id}, ${a.frage}, now(), ${a.richtig === null ? null : a.richtig ? ids.richtig : ids.falsch}, 5000, ${a.richtig ?? false})`);
  }
  return d!.id;
}

describe.skipIf(!mitDatenbank)('Fragen melden', () => {
  let admin: User;
  let anna: User;
  let ben: User;
  let fragen: number[];
  const vorher = process.env.ADMIN_USERNAMES;

  afterAll(() => {
    process.env.ADMIN_USERNAMES = vorher;
  });

  beforeEach(async () => {
    await leereDatenbank();
    [admin, anna, ben] = [await neuerUser('redaktion'), await neuerUser('anna'), await neuerUser('ben')];
    process.env.ADMIN_USERNAMES = admin.username;
    await erstelleFragen(3);
    fragen = ((await sqlAusfuehren(sql`select id from questions order by id`)) as unknown as { id: number }[]).map((z) => z.id);
  });

  test('ohne Anmeldung 401, ungültige Eingaben 400/404', async () => {
    expect((await anfrage(`/fragen/${fragen[0]}/melden`, { method: 'POST', body: { grund: 'antwort_falsch' } })).status).toBe(401);
    expect((await melden(anna, fragen[0]!, { grund: 'quatsch' })).status).toBe(400);
    expect((await melden(anna, fragen[0]!, { grund: 'sonstiges', kommentar: 'x'.repeat(501) })).status).toBe(400);
    expect((await melden(anna, 0)).status).toBe(404);
  });

  test('nur wer die Frage beantwortet hat, darf melden', async () => {
    expect((await melden(anna, fragen[0]!)).status).toBe(403);
    await duellMit(anna, ben, [{ frage: fragen[0]!, richtig: null }]); // auch „Zeit abgelaufen“ zählt
    expect((await melden(anna, fragen[0]!)).status).toBe(204);
    expect((await melden(ben, fragen[0]!)).status).toBe(403);
  });

  test('erneutes Melden ändert die offene Meldung; Duell zeigt „gemeldet“', async () => {
    const duelId = await duellMit(anna, ben, [{ frage: fragen[0]!, richtig: false }, { frage: fragen[1]!, richtig: true }]);
    await melden(anna, fragen[0]!, { grund: 'antwort_falsch', kommentar: '  ' });
    expect((await melden(anna, fragen[0]!, { grund: 'frage_unklar', kommentar: 'Beides ginge' })).status).toBe(204);
    const zeilen = await sqlAusfuehren(sql`select grund, kommentar, status from frage_meldungen`);
    expect([...zeilen]).toEqual([{ grund: 'frage_unklar', kommentar: 'Beides ginge', status: 'offen' }]);

    const d = (await anfrage(`/duels/${duelId}`, { cookie: anna.cookie })).json as DuellDetails;
    expect(d.fragen.map((f) => f.frage?.gemeldet)).toEqual([true, false]);
  });

  test('Tageslimit für neue Meldungen', async () => {
    await duellMit(anna, ben, [{ frage: fragen[0]!, richtig: true }, { frage: fragen[1]!, richtig: true }]);
    await sqlAusfuehren(sql`insert into frage_meldungen (question_id, user_id, grund, status)
      select ${fragen[2]!}, ${anna.id}, 'sonstiges', 'verworfen' from generate_series(1, ${MELDUNGEN_PRO_TAG - 1})`);
    expect((await melden(anna, fragen[0]!)).status).toBe(204);
    expect((await melden(anna, fragen[1]!)).status).toBe(429);
    // die eigene offene Meldung ändern geht weiterhin
    expect((await melden(anna, fragen[0]!, { grund: 'sonstiges' })).status).toBe(204);
  });

  test('Admin: Filter, Anzahl, Liste mit gegebener Antwort, abschließen', async () => {
    await duellMit(anna, ben, [{ frage: fragen[0]!, richtig: false }]);
    await duellMit(ben, anna, [{ frage: fragen[0]!, richtig: null }, { frage: fragen[1]!, richtig: true }]);
    await melden(anna, fragen[0]!, { grund: 'antwort_falsch', kommentar: 'Laut LWK ist es B' });
    await melden(ben, fragen[0]!, { grund: 'frage_unklar' });
    await melden(ben, fragen[1]!, { grund: 'sonstiges' });

    expect((await anfrage(`/admin/fragen/${fragen[0]}/meldungen`, { cookie: anna.cookie })).status).toBe(403);

    const liste = (await anfrage('/admin/fragen?gemeldet=1', { cookie: admin.cookie })).json as AdminFragenListe;
    expect(liste.gemeldet).toBe(2);
    expect(liste.fragen.map((f) => [f.id, f.meldungen])).toEqual([[fragen[0]!, 2], [fragen[1]!, 1]]);

    const meldungen = (await anfrage(`/admin/fragen/${fragen[0]}/meldungen`, { cookie: admin.cookie })).json as AdminMeldung[];
    const falsch = (await sqlAusfuehren(sql`select text from answer_options where id = ${(await antwortIds(fragen[0]!)).falsch}`))[0] as { text: string };
    expect(meldungen).toEqual([
      { id: expect.any(Number), username: ben.username, grund: 'frage_unklar', kommentar: null, seineAntwort: null, erstelltAt: expect.any(String) },
      { id: expect.any(Number), username: anna.username, grund: 'antwort_falsch', kommentar: 'Laut LWK ist es B', seineAntwort: falsch.text, erstelltAt: expect.any(String) },
    ]);

    expect((await anfrage(`/admin/fragen/${fragen[0]}/meldungen`, { method: 'POST', cookie: admin.cookie, body: { status: 'offen' } })).status).toBe(400);
    const res = await anfrage(`/admin/fragen/${fragen[0]}/meldungen`, { method: 'POST', cookie: admin.cookie, body: { status: 'erledigt' } });
    expect(res.json).toEqual({ abgeschlossen: 2, benachrichtigt: 0 }); // Push ist in diesem Test aus
    expect(((await anfrage(`/admin/fragen/${fragen[0]}`, { cookie: admin.cookie })).json as AdminFrage).meldungen).toBe(0);
    expect(((await anfrage('/admin/fragen?gemeldet=1', { cookie: admin.cookie })).json as AdminFragenListe).gemeldet).toBe(1);

    // nach dem Abschluss darf erneut gemeldet werden
    expect((await melden(anna, fragen[0]!)).status).toBe(204);
    const [z] = await sqlAusfuehren(sql`select count(*)::int as n from frage_meldungen where question_id = ${fragen[0]!}`) as unknown as { n: number }[];
    expect(z!.n).toBe(3);
  });

  test('Abschließen benachrichtigt die Melder per Push, mit Antwort und Link zum Duell', async () => {
    const push = await import('../src/services/push');
    const gesendet: { endpoint: string; nachricht: PushNachricht }[] = [];
    push.setzePushSender(async (a, payload) => {
      gesendet.push({ endpoint: a.endpoint, nachricht: JSON.parse(payload) });
      return 201;
    });
    try {
      for (const u of [anna, ben]) {
        await anfrage('/push/abo', { method: 'POST', cookie: u.cookie, body: { endpoint: `https://push.example/${u.username}`, keys: { p256dh: 'B', auth: 'A' } } });
      }
      await sqlAusfuehren(sql`update questions set frage_text = ${'Welche Kultur gehört nicht zum Getreide, obwohl sie oft in der Fruchtfolge mit Weizen steht?'} where id = ${fragen[0]!}`);
      const duelAnna = await duellMit(anna, ben, [{ frage: fragen[0]!, richtig: false }]);
      const duelBen = await duellMit(ben, anna, [{ frage: fragen[0]!, richtig: true }, { frage: fragen[1]!, richtig: true }]);
      await melden(anna, fragen[0]!);
      await melden(ben, fragen[0]!, { grund: 'frage_unklar' });
      await melden(ben, fragen[1]!);

      const res = await anfrage(`/admin/fragen/${fragen[0]}/meldungen`, {
        method: 'POST', cookie: admin.cookie, body: { status: 'verworfen', antwort: '  Raps ist ein Kreuzblütler.  ' },
      });
      expect(res.json).toEqual({ abgeschlossen: 2, benachrichtigt: 2 });
      await push.allePushesVersendet();
      const an = (u: User) => gesendet.find((g) => g.endpoint.endsWith(u.username))?.nachricht;
      expect(an(anna)).toEqual({
        titel: 'Deine Meldung wurde geprüft',
        text: '„Welche Kultur gehört nicht zum Getreide, obwohl sie oft in…“ bleibt so, wie sie ist. Raps ist ein Kreuzblütler.',
        url: `/duell/${duelAnna}`,
        tag: 'meldungen',
      });
      expect(an(ben)?.url).toBe(`/duell/${duelBen}`);
      expect(gesendet).toHaveLength(2);
      const [z] = await sqlAusfuehren(sql`select antwort from frage_meldungen where user_id = ${anna.id}`) as unknown as { antwort: string }[];
      expect(z!.antwort).toBe('Raps ist ein Kreuzblütler.');

      // „erledigt“ ohne Antwort; Bens zweite Meldung ist davon unberührt geblieben
      gesendet.length = 0;
      await anfrage(`/admin/fragen/${fragen[1]}/meldungen`, { method: 'POST', cookie: admin.cookie, body: { status: 'erledigt' } });
      await push.allePushesVersendet();
      expect(gesendet.map((g) => g.nachricht.titel)).toEqual(['Danke für deine Meldung!']);
      expect(gesendet[0]!.nachricht.text).toMatch(/überarbeitet\.$/);

      // nichts mehr offen → niemand wird benachrichtigt
      expect((await anfrage(`/admin/fragen/${fragen[1]}/meldungen`, { method: 'POST', cookie: admin.cookie, body: { status: 'erledigt' } })).json)
        .toEqual({ abgeschlossen: 0, benachrichtigt: 0 });
      expect((await anfrage('/admin/fragen/999999/meldungen', { method: 'POST', cookie: admin.cookie, body: { status: 'erledigt' } })).status).toBe(404);
    } finally {
      await push.allePushesVersendet();
      push.setzePushSender(null);
    }
  });
});

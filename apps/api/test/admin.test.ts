import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { AdminFrage, AdminFragenListe, AngemeldeterUser, FrageBearbeiten } from '@halmduell/shared';
import { anfrage, erstelleFragen, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const neueFrage = (abweichend: Partial<FrageBearbeiten> = {}): FrageBearbeiten => ({
  kategorie: 'landtechnik', typ: 'text', frage: 'Welche Farbe hat reifer Weizen?', richtig: 'Goldgelb',
  falsch: ['Blau', 'Violett', 'Schwarz'], erklaerung: 'Reifer Weizen ist goldgelb.', schwierigkeit: 1,
  bildUrl: null, bildQuelle: null, status: 'entwurf', ...abweichend,
});

describe.skipIf(!mitDatenbank)('Admin-Portal', () => {
  let admin: User;
  let spieler: User;
  const vorher = process.env.ADMIN_USERNAMES;

  beforeAll(async () => {
    await leereDatenbank();
    [admin, spieler] = [await neuerUser('admin'), await neuerUser('spieler')];
    // Groß-/Kleinschreibung und Leerzeichen egal
    process.env.ADMIN_USERNAMES = ` ${admin.username.toUpperCase()} , jemand_anders`;
    await sqlAusfuehren(sql`insert into questions (code, kategorie, typ, frage_text, status) values
      ('landtechnik-007', 'landtechnik', 'text', 'Vorhandene Landtechnikfrage', 'freigegeben')`);
    await sqlAusfuehren(sql`insert into answer_options (question_id, text, ist_richtig)
      select id, t.text, t.r from questions, (values ('Ja', true), ('Nein', false), ('Vielleicht', false), ('Nie', false)) as t(text, r)
      where code = 'landtechnik-007'`);
  });

  afterAll(() => {
    process.env.ADMIN_USERNAMES = vorher;
  });

  test('nur Admins: 401 ohne Anmeldung, 403 für normale Spieler; /me meldet istAdmin', async () => {
    expect((await anfrage('/admin/fragen')).status).toBe(401);
    expect((await anfrage('/admin/fragen', { cookie: spieler.cookie })).status).toBe(403);
    expect((await anfrage('/admin/fragen.csv', { cookie: spieler.cookie })).status).toBe(403);
    expect((await anfrage('/admin/fragen', { method: 'POST', cookie: spieler.cookie, body: neueFrage() })).status).toBe(403);
    expect((await anfrage('/admin/fragen', { cookie: admin.cookie })).status).toBe(200);
    expect(((await anfrage('/auth/me', { cookie: admin.cookie })).json as AngemeldeterUser).istAdmin).toBe(true);
    expect(((await anfrage('/auth/me', { cookie: spieler.cookie })).json as AngemeldeterUser).istAdmin).toBe(false);
  });

  test('neue Frage: Code wird je Kategorie fortlaufend vergeben', async () => {
    const res = await anfrage('/admin/fragen', { method: 'POST', cookie: admin.cookie, body: neueFrage() });
    expect(res.status).toBe(201);
    const f = res.json as AdminFrage;
    expect(f).toMatchObject({ code: 'landtechnik-008', richtig: 'Goldgelb', falsch: ['Blau', 'Violett', 'Schwarz'], status: 'entwurf', statistik: { beantwortet: 0, richtig: 0 } });
    const zweite = (await anfrage('/admin/fragen', { method: 'POST', cookie: admin.cookie, body: neueFrage({ frage: 'Noch eine?', kategorie: 'pflanzenbau' }) })).json as AdminFrage;
    expect(zweite.code).toBe('pflanzenbau-001');
  });

  test('Validierung wie beim CSV-Import', async () => {
    const pruefen = async (f: Partial<FrageBearbeiten>) =>
      (await anfrage('/admin/fragen', { method: 'POST', cookie: admin.cookie, body: neueFrage(f) }));
    const doppelt = await pruefen({ falsch: ['goldgelb', 'Blau', 'Rot'] });
    expect(doppelt.status).toBe(400);
    expect(doppelt.json.felder.falsch).toEqual(['Die 4 Antworten müssen verschieden sein']);
    expect((await pruefen({ typ: 'bild' })).json.felder.bildUrl).toBeDefined();
    expect((await pruefen({ bildUrl: 'https://example.org/a.jpg' })).json.felder.bildQuelle).toBeDefined();
    expect((await pruefen({ bildUrl: 'http://example.org/a.jpg', bildQuelle: 'X' })).json.felder.bildUrl).toBeDefined();
    expect((await pruefen({ frage: '  ' })).json.felder.frage).toBeDefined();
    expect((await pruefen({ richtig: 'x'.repeat(101) })).json.felder.richtig).toBeDefined();
  });

  test('bearbeiten: Antwort-IDs bleiben erhalten, richtige bleibt dieselbe Option', async () => {
    const [f] = ((await anfrage('/admin/fragen?suche=Vorhandene', { cookie: admin.cookie })).json as AdminFragenListe).fragen;
    const idsVorher = [...await sqlAusfuehren(sql`select id, ist_richtig from answer_options where question_id = ${f!.id} order by id`)];

    const res = await anfrage(`/admin/fragen/${f!.id}`, {
      method: 'PUT', cookie: admin.cookie,
      body: neueFrage({ kategorie: 'landtechnik', frage: 'Korrigierte Frage?', richtig: 'Jawohl', falsch: ['Nein', 'Kaum', 'Nie'], status: 'freigegeben', schwierigkeit: 3 }),
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ code: 'landtechnik-007', frage: 'Korrigierte Frage?', richtig: 'Jawohl', falsch: ['Nein', 'Kaum', 'Nie'], schwierigkeit: 3 });
    const idsNachher = [...await sqlAusfuehren(sql`select id, ist_richtig from answer_options where question_id = ${f!.id} order by id`)];
    expect(idsNachher).toEqual(idsVorher);

    expect((await anfrage('/admin/fragen/99999', { method: 'PUT', cookie: admin.cookie, body: neueFrage() })).status).toBe(404);
  });

  test('Status setzen, Filter, Übersicht je Kategorie und Duell-Statistik', async () => {
    const liste = (q = '') => anfrage(`/admin/fragen${q}`, { cookie: admin.cookie }).then((r) => r.json as AdminFragenListe);
    const entwuerfe = await liste('?status=entwurf');
    expect(entwuerfe.fragen.map((f) => f.code)).toEqual(['landtechnik-008', 'pflanzenbau-001']);

    const res = await anfrage(`/admin/fragen/${entwuerfe.fragen[0]!.id}/status`, { method: 'POST', cookie: admin.cookie, body: { status: 'freigegeben' } });
    expect((res.json as AdminFrage).status).toBe('freigegeben');
    expect((await anfrage(`/admin/fragen/${entwuerfe.fragen[0]!.id}/status`, { method: 'POST', cookie: admin.cookie, body: { status: 'weg' } })).status).toBe(400);

    const alle = await liste();
    expect(alle.uebersicht.find((u) => u.kategorie === 'landtechnik')).toEqual({ kategorie: 'landtechnik', freigegeben: 2, entwurf: 0, eingereicht: 0, abgelehnt: 0 });
    expect(alle.uebersicht.find((u) => u.kategorie === 'pflanzenbau')).toMatchObject({ entwurf: 1 });
    expect((await liste('?kategorie=pflanzenbau')).fragen).toHaveLength(1);
    expect((await liste('?suche=goldgelb')).fragen.map((f) => f.code)).toEqual(['landtechnik-008', 'pflanzenbau-001']); // Suche auch in Antworten
    expect((await liste('?suche=landtechnik-00')).fragen.map((f) => f.code)).toEqual(['landtechnik-007', 'landtechnik-008']); // und im Code
    expect((await liste('?suche=100%25')).fragen).toEqual([]); // Platzhalter werden nicht als Muster gewertet

    // Statistik aus Duell-Antworten
    await erstelleFragen(0);
    const [d] = (await sqlAusfuehren(sql`insert into duels (kategorie, spieler_a_id, spieler_b_id, status)
      values ('landtechnik', ${admin.id}, ${spieler.id}, 'wartet_b') returning id`)) as unknown as { id: number }[];
    const frageId = entwuerfe.fragen[0]!.id;
    await sqlAusfuehren(sql`insert into duel_answers (duel_id, user_id, question_id, beantwortet_at, antwortzeit_ms, ist_richtig) values
      (${d!.id}, ${admin.id}, ${frageId}, now(), 3000, true), (${d!.id}, ${spieler.id}, ${frageId}, now(), 3000, false)`);
    expect((await anfrage(`/admin/fragen/${frageId}`, { cookie: admin.cookie })).json.statistik).toEqual({ beantwortet: 2, richtig: 1 });
  });

  test('CSV-Export im Format von fragen.csv, wieder einlesbar', async () => {
    const res = await (await import('../src/app')).app.request('/api/admin/fragen.csv', { headers: { cookie: admin.cookie, 'x-forwarded-for': '10.1.2.3' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="fragen-\d{4}-\d{2}-\d{2}\.csv"/);
    const { leseFragenCsv } = await import('../src/fragen/csv');
    const { fragen, fehler } = leseFragenCsv(new Uint8Array(await res.arrayBuffer()));
    expect(fehler).toEqual([]);
    expect(fragen.map((f) => f.code)).toEqual(['landtechnik-007', 'landtechnik-008', 'pflanzenbau-001']);
    expect(fragen[0]).toMatchObject({ frage: 'Korrigierte Frage?', richtig: 'Jawohl', falsch1: 'Nein', schwierigkeit: 3, status: 'freigegeben' });
  });
  test('Commons-Link: Bild-URL, Urheber und Lizenz übernehmen', async () => {
    const { setzeCommonsFetch } = await import('../src/services/commons');
    const aufrufe: string[] = [];
    setzeCommonsFetch(async (url, init) => {
      aufrufe.push(url);
      expect(new Headers(init.headers).get('user-agent')).toContain('Halmduell');
      const titel = new URL(url).searchParams.get('titles');
      if (titel === 'File:Gibt es nicht.jpg') return Response.json({ query: { pages: [{ title: titel, missing: true }] } });
      if (titel === 'File:Ohne Lizenz.jpg') {
        return Response.json({ query: { pages: [{ imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Ohne_Lizenz.jpg', extmetadata: {} }] }] } });
      }
      if (titel === 'File:Kaputt.jpg') return new Response('Fehler', { status: 503 });
      return Response.json({ query: { pages: [{ title: titel, imageinfo: [{
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Kaefer.jpg/1024px-Kaefer.jpg',
        url: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Kaefer.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Kaefer.jpg',
        extmetadata: {
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:Muster">Max &amp; Moritz Muster</a>' },
        },
      }] }] } });
    });
    try {
      const commons = (link: string, cookie = admin.cookie) => anfrage('/admin/commons', { method: 'POST', cookie, body: { link } });

      const ok = await commons('https://commons.wikimedia.org/wiki/File:Kaefer.jpg');
      expect(ok.status).toBe(200);
      expect(ok.json).toEqual({
        bildUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Kaefer.jpg/1024px-Kaefer.jpg',
        bildQuelle: 'Max & Moritz Muster, CC BY-SA 4.0, Wikimedia Commons',
        urheber: 'Max & Moritz Muster',
        lizenz: 'CC BY-SA 4.0',
        seite: 'https://commons.wikimedia.org/wiki/File:Kaefer.jpg',
      });
      expect(new URL(aufrufe[0]!).searchParams.get('iiurlwidth')).toBe('1024');

      expect((await commons('https://example.org/bild.jpg')).status).toBe(400);
      expect((await commons('Datei:Gibt_es_nicht.jpg')).status).toBe(404);
      expect((await commons('Datei:Ohne_Lizenz.jpg')).status).toBe(422);
      expect((await commons('Datei:Kaputt.jpg')).status).toBe(502);
      expect((await commons('Datei:Kaefer.jpg', spieler.cookie)).status).toBe(403);

      // Übernommene Daten ergeben eine gültige Bildfrage
      const neu = await anfrage('/admin/fragen', {
        method: 'POST', cookie: admin.cookie,
        body: neueFrage({ typ: 'bild', frage: 'Welcher Käfer ist hier zu sehen?', richtig: 'Kartoffelkäfer', bildUrl: ok.json.bildUrl, bildQuelle: ok.json.bildQuelle }),
      });
      expect(neu.status).toBe(201);
      expect(neu.json).toMatchObject({ typ: 'bild', bildQuelle: 'Max & Moritz Muster, CC BY-SA 4.0, Wikimedia Commons' });
    } finally {
      setzeCommonsFetch(null);
    }
  });
});

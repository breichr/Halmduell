import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { EINGEREICHT_OFFEN_MAX, type AdminFrage, type AdminFragenListe, type EigeneFrage, type FrageEinreichen, type PushNachricht } from '@halmduell/shared';
import { anfrage, leereDatenbank, mitDatenbank, neuerUser, sqlAusfuehren } from './helpers';

type User = Awaited<ReturnType<typeof neuerUser>>;

const neueFrage = (abweichend: Partial<FrageEinreichen> = {}): FrageEinreichen => ({
  kategorie: 'viehzucht', frage: 'Wie viele Zitzen hat ein Kuheuter?', richtig: 'Vier', falsch: ['Zwei', 'Sechs', 'Acht'],
  erklaerung: 'Das Euter hat vier Viertel mit je einer Zitze.', ...abweichend,
});

describe.skipIf(!mitDatenbank)('Community-Fragen', () => {
  let admin: User;
  let anna: User;
  let ben: User;
  const vorher = process.env.ADMIN_USERNAMES;
  const gesendet: { endpoint: string; nachricht: PushNachricht }[] = [];

  beforeEach(async () => {
    await leereDatenbank();
    [admin, anna, ben] = [await neuerUser('admin'), await neuerUser('anna'), await neuerUser('ben')];
    process.env.ADMIN_USERNAMES = admin.username;
    gesendet.length = 0;
    (await import('../src/services/push')).setzePushSender(async (a, payload) => {
      gesendet.push({ endpoint: a.endpoint, nachricht: JSON.parse(payload) });
      return 201;
    });
  });

  afterAll(async () => {
    process.env.ADMIN_USERNAMES = vorher;
    const push = await import('../src/services/push');
    await push.allePushesVersendet();
    push.setzePushSender(null);
  });

  const einreichen = (u: User, f: unknown = neueFrage()) => anfrage('/fragen', { method: 'POST', cookie: u.cookie, body: f });
  const eigene = async (u: User) => (await anfrage('/fragen/eigene', { cookie: u.cookie })).json as EigeneFrage[];
  const status = (id: number, s: string, rueckmeldung?: string) =>
    anfrage(`/admin/fragen/${id}/status`, { method: 'POST', cookie: admin.cookie, body: { status: s, rueckmeldung } });
  const versendet = async () => {
    await (await import('../src/services/push')).allePushesVersendet();
    return gesendet.map((g) => g.nachricht);
  };

  test('einreichen: landet als „eingereicht“ ohne Code, nur in „Meine Fragen“ des Einreichers', async () => {
    expect((await anfrage('/fragen', { method: 'POST', body: neueFrage() })).status).toBe(401);
    const res = await einreichen(anna, neueFrage({ erklaerung: '  ' }));
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ status: 'eingereicht', frage: 'Wie viele Zitzen hat ein Kuheuter?', richtig: 'Vier', erklaerung: null, rueckmeldung: null });
    const [z] = await sqlAusfuehren(sql`select code, typ, status, eingereicht_von from questions`) as unknown as Record<string, unknown>[];
    expect(z).toEqual({ code: null, typ: 'text', status: 'eingereicht', eingereicht_von: anna.id });
    expect(await eigene(anna)).toHaveLength(1);
    expect(await eigene(ben)).toEqual([]);
  });

  test('Prüfungen: Pflichtfelder, verschiedene Antworten, doppelte Frage, Limit', async () => {
    const leer = await einreichen(anna, neueFrage({ frage: '' }));
    expect(leer.status).toBe(400);
    expect(leer.json.felder.frage).toBeDefined();
    expect((await einreichen(anna, neueFrage({ falsch: ['vier', 'Sechs', 'Acht'] }))).json.felder.falsch).toEqual(['Die 4 Antworten müssen verschieden sein']);
    expect((await einreichen(anna, neueFrage({ kategorie: 'gemischt' as never }))).status).toBe(400);

    await einreichen(anna);
    const doppelt = await einreichen(ben, neueFrage({ frage: 'WIE VIELE ZITZEN HAT EIN KUHEUTER?' }));
    expect(doppelt.status).toBe(409);

    for (let i = 1; i < EINGEREICHT_OFFEN_MAX; i++) expect((await einreichen(anna, neueFrage({ frage: `Frage ${i}?` }))).status).toBe(201);
    expect((await einreichen(anna, neueFrage({ frage: 'Eine zu viel?' }))).status).toBe(429);
    expect((await einreichen(ben, neueFrage({ frage: 'Bens Frage?' }))).status).toBe(201);
  });

  test('zurückziehen nur, solange ungeprüft, und nur die eigene', async () => {
    const f = (await einreichen(anna)).json as EigeneFrage;
    expect((await anfrage(`/fragen/eigene/${f.id}`, { method: 'DELETE', cookie: ben.cookie })).status).toBe(404);
    expect((await anfrage(`/fragen/eigene/${f.id}`, { method: 'DELETE', cookie: anna.cookie })).status).toBe(204);
    expect(await eigene(anna)).toEqual([]);

    const g = (await einreichen(anna)).json as EigeneFrage;
    await status(g.id, 'freigegeben');
    expect((await anfrage(`/fragen/eigene/${g.id}`, { method: 'DELETE', cookie: anna.cookie })).status).toBe(409);
  });

  test('Admin: Filter „eingereicht“ zeigt Einreicher; Freigabe vergibt Code, speichert Rückmeldung und benachrichtigt', async () => {
    await anfrage('/push/abo', { method: 'POST', cookie: anna.cookie, body: { endpoint: 'https://push.example/anna', keys: { p256dh: 'B', auth: 'A' } } });
    await sqlAusfuehren(sql`insert into questions (code, kategorie, typ, frage_text, status) values ('viehzucht-025', 'viehzucht', 'text', 'Vorhanden?', 'freigegeben')`);
    const f = (await einreichen(anna)).json as EigeneFrage;

    const liste = (await anfrage('/admin/fragen?status=eingereicht', { cookie: admin.cookie })).json as AdminFragenListe;
    expect(liste.fragen.map((x) => [x.id, x.eingereichtVon, x.code])).toEqual([[f.id, anna.username, null]]);
    expect(liste.uebersicht.find((u) => u.kategorie === 'viehzucht')?.eingereicht).toBe(1);

    const res = await status(f.id, 'freigegeben', ' Danke, sehr gute Frage! ');
    expect(res.json).toMatchObject({ status: 'freigegeben', code: 'viehzucht-026', rueckmeldung: 'Danke, sehr gute Frage!' } satisfies Partial<AdminFrage>);
    expect(await versendet()).toEqual([{
      titel: 'Deine Frage ist im Spiel!', text: '„Wie viele Zitzen hat ein Kuheuter?“ wurde freigegeben. Danke, sehr gute Frage!',
      url: '/fragen/eigene', tag: 'eigene-fragen',
    }]);
    expect((await eigene(anna))[0]).toMatchObject({ status: 'freigegeben', rueckmeldung: 'Danke, sehr gute Frage!' });

    // gleicher Status noch einmal → keine zweite Nachricht; Code bleibt
    await status(f.id, 'freigegeben');
    expect(await versendet()).toHaveLength(1);
    expect(((await anfrage(`/admin/fragen/${f.id}`, { cookie: admin.cookie })).json as AdminFrage).code).toBe('viehzucht-026');
  });

  test('Ablehnen mit und ohne Rückmeldung; über das Bearbeiten-Formular ebenso', async () => {
    await anfrage('/push/abo', { method: 'POST', cookie: ben.cookie, body: { endpoint: 'https://push.example/ben', keys: { p256dh: 'B', auth: 'A' } } });
    const a = (await einreichen(ben)).json as EigeneFrage;
    const b = (await einreichen(ben, neueFrage({ frage: 'Welche Farbe hat eine Holsteinkuh meist?', richtig: 'Schwarz-weiß', falsch: ['Braun', 'Rot', 'Grau'] }))).json as EigeneFrage;

    await status(a.id, 'abgelehnt', 'Gibt es schon als viehzucht-001.');
    await status(b.id, 'abgelehnt');
    const texte = (await versendet()).map((n) => n.text);
    expect(texte).toContain('„Wie viele Zitzen hat ein Kuheuter?“ – Gibt es schon als viehzucht-001.');
    expect(texte).toContain('„Welche Farbe hat eine Holsteinkuh meist?“ passt leider nicht in den Katalog.');

    // Admin überarbeitet und gibt über das Formular frei → Freigabe-Nachricht, Code vergeben
    gesendet.length = 0;
    const put = await anfrage(`/admin/fragen/${b.id}`, {
      method: 'PUT', cookie: admin.cookie,
      body: { kategorie: 'viehzucht', typ: 'text', frage: 'Welche Fellfarbe hat eine Holsteinkuh meist?', richtig: 'Schwarz-weiß', falsch: ['Braun', 'Rot', 'Grau'], erklaerung: null, schwierigkeit: 1, bildUrl: null, bildQuelle: null, status: 'freigegeben' },
    });
    expect(put.json).toMatchObject({ status: 'freigegeben', code: 'viehzucht-001', eingereichtVon: ben.username });
    expect((await versendet()).map((n) => n.titel)).toEqual(['Deine Frage ist im Spiel!']);
  });
});

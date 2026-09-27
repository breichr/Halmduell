import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { FragenZeile } from '../src/fragen/csv';
import { leereDatenbank, mitDatenbank, sqlAusfuehren } from './helpers';

const frage = (code: string, abweichend: Partial<FragenZeile> = {}): FragenZeile => ({
  code, kategorie: 'pflanzenbau', typ: 'text', frage: `Frage ${code}`, richtig: 'A', falsch1: 'B', falsch2: 'C', falsch3: 'D',
  erklaerung: undefined, schwierigkeit: 1, bild_url: undefined, bild_quelle: undefined, status: 'freigegeben', ...abweichend,
});

async function importiere(fragen: FragenZeile[], ueberschreiben = false) {
  const { db } = await import('../src/db/client');
  const { importiereFragen } = await import('../src/fragen/import');
  return db.transaction((tx) => importiereFragen(tx, fragen, { ueberschreiben }));
}

describe.skipIf(!mitDatenbank)('Fragen-Import', () => {
  beforeAll(leereDatenbank);

  test('Standard: nur neue Codes, vorhandene Fragen (im Portal gepflegt) bleiben unangetastet', async () => {
    expect(await importiere([frage('p-1')])).toMatchObject({ neu: 1, uebersprungen: 0 });
    await sqlAusfuehren(sql`update questions set frage_text = 'Im Portal geändert', status = 'abgelehnt' where code = 'p-1'`);
    expect(await importiere([frage('p-1'), frage('p-2')])).toMatchObject({ neu: 1, geaendert: 0, uebersprungen: 1 });
    const [zeile] = [...await sqlAusfuehren(sql`select frage_text, status from questions where code = 'p-1'`)];
    expect(zeile).toEqual({ frage_text: 'Im Portal geändert', status: 'abgelehnt' });
    await sqlAusfuehren(sql`delete from questions where code in ('p-1', 'p-2')`);
  });

  test('mit --ueberschreiben: neu → unverändert → geändert, Antwort-IDs bleiben erhalten', async () => {
    expect(await importiere([frage('w-1'), frage('w-2')], true)).toEqual({ neu: 2, geaendert: 0, unveraendert: 0, uebersprungen: 0, nichtInDatei: [] });
    const idsVorher = [...await sqlAusfuehren(sql`select a.id from answer_options a join questions q on q.id = a.question_id where q.code = 'w-1' order by a.id`)];

    expect(await importiere([frage('w-1'), frage('w-2')], true)).toMatchObject({ neu: 0, geaendert: 0, unveraendert: 2 });

    const ergebnis = await importiere([frage('w-1', { frage: 'Korrigiert', falsch2: 'C2', status: 'abgelehnt' }), frage('w-2')], true);
    expect(ergebnis).toMatchObject({ neu: 0, geaendert: 1, unveraendert: 1 });
    const nachher = [...await sqlAusfuehren(sql`
      select q.frage_text, q.status, a.id, a.text, a.ist_richtig from questions q join answer_options a on a.question_id = q.id
      where q.code = 'w-1' order by a.id`)] as { frage_text: string; status: string; id: number; text: string; ist_richtig: boolean }[];
    expect(nachher.map((z) => z.id)).toEqual(idsVorher.map((z) => (z as { id: number }).id));
    expect(nachher.map((z) => z.text)).toEqual(['A', 'B', 'C2', 'D']);
    expect(nachher.filter((z) => z.ist_richtig).map((z) => z.text)).toEqual(['A']);
    expect(nachher[0]).toMatchObject({ frage_text: 'Korrigiert', status: 'abgelehnt' });
  });

  test('fehlende Zeilen werden gemeldet, aber nicht gelöscht', async () => {
    const ergebnis = await importiere([frage('w-1')]);
    expect(ergebnis.nichtInDatei).toEqual(['w-2']);
    const [zeile] = [...await sqlAusfuehren(sql`select count(*)::int as anzahl from questions`)] as { anzahl: number }[];
    expect(zeile?.anzahl).toBe(2);
  });

  test('mitgelieferte fragen.csv ist gültig und importierbar', async () => {
    const { leseFragenCsv } = await import('../src/fragen/csv');
    const { STANDARD_DATEI } = await import('../src/fragen/import');
    const { fragen, fehler } = leseFragenCsv(new Uint8Array(await Bun.file(STANDARD_DATEI).arrayBuffer()));
    expect(fehler).toEqual([]);
    expect((await importiere(fragen)).neu).toBe(fragen.length);
  });

  test('CSV schreiben und wieder lesen ergibt dieselben Fragen', async () => {
    const { leseFragenCsv, schreibeFragenCsv } = await import('../src/fragen/csv');
    const fragen = [
      frage('x-1', { frage: 'Mit ; Semikolon, "Anführungszeichen" und\nUmbruch?', erklaerung: 'Ä Ö Ü ß – „deutsch“' }),
      frage('x-2', { typ: 'bild', bild_url: 'https://upload.wikimedia.org/a.jpg', bild_quelle: 'Max Muster, CC BY-SA 4.0', schwierigkeit: 3, status: 'entwurf' }),
    ];
    const csv = schreibeFragenCsv(fragen);
    expect(csv.startsWith('\uFEFFcode;kategorie;')).toBe(true);
    expect(csv.includes('\r\n')).toBe(true);
    const gelesen = leseFragenCsv(new TextEncoder().encode(csv));
    expect(gelesen.fehler).toEqual([]);
    expect(gelesen.fragen).toEqual(fragen);
  });
});

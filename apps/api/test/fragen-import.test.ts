import { beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import type { FragenZeile } from '../src/fragen/csv';
import { leereDatenbank, mitDatenbank, sqlAusfuehren } from './helpers';

const frage = (code: string, abweichend: Partial<FragenZeile> = {}): FragenZeile => ({
  code, kategorie: 'wissen', typ: 'text', frage: `Frage ${code}`, richtig: 'A', falsch1: 'B', falsch2: 'C', falsch3: 'D',
  erklaerung: undefined, schwierigkeit: 1, bild_url: undefined, bild_quelle: undefined, status: 'freigegeben', ...abweichend,
});

async function importiere(fragen: FragenZeile[]) {
  const { db } = await import('../src/db/client');
  const { importiereFragen } = await import('../src/fragen/import');
  return db.transaction((tx) => importiereFragen(tx, fragen));
}

describe.skipIf(!mitDatenbank)('Fragen-Import', () => {
  beforeAll(leereDatenbank);

  test('neu → unverändert → geändert, Antwort-IDs bleiben erhalten', async () => {
    expect(await importiere([frage('w-1'), frage('w-2')])).toEqual({ neu: 2, geaendert: 0, unveraendert: 0, nichtInDatei: [] });
    const idsVorher = [...await sqlAusfuehren(sql`select a.id from answer_options a join questions q on q.id = a.question_id where q.code = 'w-1' order by a.id`)];

    expect(await importiere([frage('w-1'), frage('w-2')])).toMatchObject({ neu: 0, geaendert: 0, unveraendert: 2 });

    const ergebnis = await importiere([frage('w-1', { frage: 'Korrigiert', falsch2: 'C2', status: 'abgelehnt' }), frage('w-2')]);
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
});

import { describe, expect, test } from 'bun:test';
import { leseFragenCsv } from './csv';

const KOPF = 'code;kategorie;typ;frage;richtig;falsch1;falsch2;falsch3;erklaerung;schwierigkeit;bild_url;bild_quelle;status';
const zeile = (felder: Partial<Record<string, string>> = {}) => {
  const werte = {
    code: 'wissen-001', kategorie: 'wissen', typ: 'text', frage: 'Was düngt man?', richtig: 'Stickstoff',
    falsch1: 'Sand', falsch2: 'Kies', falsch3: 'Luft', erklaerung: '', schwierigkeit: '', bild_url: '', bild_quelle: '', status: '',
    ...felder,
  };
  return Object.values(werte).join(';');
};
const csv = (...zeilen: string[]) => new TextEncoder().encode([KOPF, ...zeilen].join('\r\n'));

describe('leseFragenCsv', () => {
  test('gültige Zeile mit Standardwerten', () => {
    const { fragen, fehler } = leseFragenCsv(csv(zeile()));
    expect(fehler).toEqual([]);
    expect(fragen).toEqual([{
      code: 'wissen-001', kategorie: 'wissen', typ: 'text', frage: 'Was düngt man?', richtig: 'Stickstoff',
      falsch1: 'Sand', falsch2: 'Kies', falsch3: 'Luft', erklaerung: undefined, schwierigkeit: 1,
      bild_url: undefined, bild_quelle: undefined, status: 'freigegeben',
    }]);
  });

  test('Windows-1252 (Excel-Standard) und UTF-8-BOM', () => {
    const inhalt = [KOPF, zeile({ frage: 'Welcher Käfer frisst Rüben?' })].join('\r\n');
    const cp1252 = Uint8Array.from(inhalt, (z) => ({ ä: 0xe4, ü: 0xfc } as Record<string, number>)[z] ?? z.charCodeAt(0));
    expect(leseFragenCsv(cp1252).fragen[0]?.frage).toBe('Welcher Käfer frisst Rüben?');

    const mitBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(inhalt)]);
    expect(leseFragenCsv(mitBom).fragen[0]?.code).toBe('wissen-001');
  });

  test('Komma als Trenner und Anführungszeichen mit Zeilenumbruch', () => {
    const komma = `${KOPF.replaceAll(';', ',')}\n` +
      'wissen-001,wissen,text,"Was ist ""NPK""?",Nährstoffe,Maschine,Sorte,Krankheit,"Zeile 1\nZeile 2",2,,,';
    const { fragen, fehler } = leseFragenCsv(new TextEncoder().encode(komma));
    expect(fehler).toEqual([]);
    expect(fragen[0]).toMatchObject({ frage: 'Was ist "NPK"?', erklaerung: 'Zeile 1\nZeile 2', schwierigkeit: 2 });
  });

  test('Fehler mit Zeilennummer, nichts wird übernommen', () => {
    const { fragen, fehler } = leseFragenCsv(csv(
      zeile(),
      zeile({ code: 'Wissen 2', kategorie: 'obst', richtig: '' }),
      zeile({ code: 'bild-1', typ: 'bild' }),
      zeile({ code: 'bild-2', typ: 'bild', bild_url: 'https://upload.wikimedia.org/x.jpg' }),
      zeile({ code: 'doppelt', falsch1: 'stickstoff' }),
      zeile({ schwierigkeit: '7' }),
      zeile(),
    ));
    expect(fragen).toEqual([]);
    expect(fehler).toEqual([
      'Zeile 3: code: nur Kleinbuchstaben, Ziffern, - und _',
      'Zeile 3: kategorie: muss eine von kulturen, schaedlinge, krankheiten, wissen sein',
      'Zeile 3: richtig: fehlt',
      'Zeile 4: bild_url: fehlt (typ ist "bild")',
      'Zeile 5: bild_quelle: fehlt (Urheber + Lizenz angeben)',
      'Zeile 6: die 4 Antworten müssen verschieden sein',
      'Zeile 7: schwierigkeit: muss eine Zahl von 1 bis 5 sein',
      'Zeile 8: code "wissen-001" kommt schon in Zeile 2 vor',
    ]);
  });

  test('fehlende Pflichtspalten', () => {
    const { fehler } = leseFragenCsv(new TextEncoder().encode('code;frage\nx;y'));
    expect(fehler[0]).toStartWith('Spalten fehlen: kategorie, richtig');
  });
});

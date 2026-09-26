import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { FRAGE_STATUS, FRAGE_TYPEN, FRAGEN_KATEGORIEN } from '@halmduell/shared';

export const SPALTEN = [
  'code', 'kategorie', 'typ', 'frage', 'richtig', 'falsch1', 'falsch2', 'falsch3',
  'erklaerung', 'schwierigkeit', 'bild_url', 'bild_quelle', 'status',
] as const;

const leerZuUndefined = (wert: unknown) => (typeof wert === 'string' && wert.trim() === '' ? undefined : wert);
// Meldungen ohne Feldnamen – der wird beim Ausgeben vorangestellt ("Zeile 7: frage: fehlt")
const pflichttext = (max: number) =>
  z.string({ error: 'fehlt' }).trim().min(1, 'fehlt').max(max, `länger als ${max} Zeichen`);
const optionalerText = (max: number) =>
  z.preprocess(leerZuUndefined, z.string().trim().max(max, `länger als ${max} Zeichen`).optional());
const auswahl = <T extends readonly [string, ...string[]]>(werte: T) =>
  z.string({ error: 'fehlt' }).trim().toLowerCase().pipe(z.enum(werte, { error: `muss eine von ${werte.join(', ')} sein` }));

const zeileSchema = z.object({
  code: pflichttext(40).regex(/^[a-z0-9][a-z0-9_-]*$/, 'nur Kleinbuchstaben, Ziffern, - und _'),
  kategorie: auswahl(FRAGEN_KATEGORIEN),
  typ: z.preprocess(leerZuUndefined, auswahl(FRAGE_TYPEN).default('text')),
  frage: pflichttext(1000),
  richtig: pflichttext(100),
  falsch1: pflichttext(100),
  falsch2: pflichttext(100),
  falsch3: pflichttext(100),
  erklaerung: optionalerText(2000),
  schwierigkeit: z.preprocess(leerZuUndefined,
    z.coerce.number({ error: 'muss eine Zahl von 1 bis 5 sein' }).int('muss eine Zahl von 1 bis 5 sein')
      .min(1, 'muss eine Zahl von 1 bis 5 sein').max(5, 'muss eine Zahl von 1 bis 5 sein').default(1)),
  bild_url: z.preprocess(leerZuUndefined, z.url({ protocol: /^https$/, error: 'muss eine https-URL sein' }).optional()),
  bild_quelle: optionalerText(500),
  status: z.preprocess(leerZuUndefined, auswahl(FRAGE_STATUS).default('freigegeben')),
}).superRefine((zeile, ctx) => {
  if (zeile.typ === 'bild' && !zeile.bild_url) ctx.addIssue({ code: 'custom', path: ['bild_url'], message: 'fehlt (typ ist "bild")' });
  // Attribution ist bei CC-Lizenzen Pflicht (siehe konzept.md)
  if (zeile.bild_url && !zeile.bild_quelle) ctx.addIssue({ code: 'custom', path: ['bild_quelle'], message: 'fehlt (Urheber + Lizenz angeben)' });
  const antworten = [zeile.richtig, zeile.falsch1, zeile.falsch2, zeile.falsch3].map((a) => a.toLowerCase());
  if (new Set(antworten).size !== 4) ctx.addIssue({ code: 'custom', message: 'die 4 Antworten müssen verschieden sein' });
});

export type FragenZeile = z.infer<typeof zeileSchema>;

/** Excel speichert CSV oft als Windows-1252 statt UTF-8 – beides akzeptieren */
function dekodiere(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Liest und prüft die Fragen-CSV. Liefert entweder alle Fragen oder alle Fehler
 * (mit Zeilennummer, wie sie in der Tabellenkalkulation angezeigt wird).
 */
export function leseFragenCsv(bytes: Uint8Array): { fragen: FragenZeile[]; fehler: string[] } {
  const inhalt = dekodiere(bytes);
  const kopf = inhalt.split(/\r?\n/, 1)[0] ?? '';
  const trenner = (kopf.match(/;/g)?.length ?? 0) >= (kopf.match(/,/g)?.length ?? 0) ? ';' : ',';

  let zeilen: Record<string, string>[];
  try {
    zeilen = parse(inhalt, {
      delimiter: trenner,
      columns: (spalten: string[]) => spalten.map((s) => s.trim().toLowerCase()),
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch (e) {
    return { fragen: [], fehler: [`CSV nicht lesbar: ${(e as Error).message}`] };
  }

  const fehler: string[] = [];
  const vorhandeneSpalten = Object.keys(zeilen[0] ?? {});
  const fehlend = SPALTEN.filter((s) => ['code', 'kategorie', 'frage', 'richtig', 'falsch1', 'falsch2', 'falsch3'].includes(s))
    .filter((s) => zeilen.length > 0 && !vorhandeneSpalten.includes(s));
  if (fehlend.length) return { fragen: [], fehler: [`Spalten fehlen: ${fehlend.join(', ')}`] };

  const fragen: FragenZeile[] = [];
  const codes = new Map<string, number>();
  zeilen.forEach((roh, i) => {
    const zeilenNr = i + 2; // +1 Kopfzeile, +1 weil Tabellen bei 1 zählen
    const ergebnis = zeileSchema.safeParse(roh);
    if (!ergebnis.success) {
      for (const problem of ergebnis.error.issues) {
        const feld = problem.path.length ? `${String(problem.path[0])}: ` : '';
        fehler.push(`Zeile ${zeilenNr}: ${feld}${problem.message}`);
      }
      return;
    }
    const frueher = codes.get(ergebnis.data.code);
    if (frueher) {
      fehler.push(`Zeile ${zeilenNr}: code "${ergebnis.data.code}" kommt schon in Zeile ${frueher} vor`);
      return;
    }
    codes.set(ergebnis.data.code, zeilenNr);
    fragen.push(ergebnis.data);
  });

  return fehler.length ? { fragen: [], fehler } : { fragen, fehler };
}

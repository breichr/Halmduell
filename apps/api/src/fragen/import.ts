// Importiert fragen/fragen.csv in die Datenbank (idempotent).
//   bun run fragen:import               → importieren
//   bun run fragen:import -- --pruefen  → nur prüfen, ohne Datenbank (für CI)
//   bun run fragen:import -- pfad.csv   → andere Datei
import { asc, eq, isNotNull } from 'drizzle-orm';
import { answerOptions, questions } from '../db/schema';
import type { Tx } from '../db/types';
import { leseFragenCsv, type FragenZeile } from './csv';

export const STANDARD_DATEI = new URL('../../../../fragen/fragen.csv', import.meta.url).pathname;

export interface ImportErgebnis {
  neu: number;
  geaendert: number;
  unveraendert: number;
  /** Fragen mit Code in der DB, die in der Datei fehlen (werden nicht gelöscht) */
  nichtInDatei: string[];
}

/**
 * Legt neue Fragen an und aktualisiert bestehende (per `code`). Antwortoptionen
 * werden an Ort und Stelle geändert, damit ihre IDs – auf die gespielte Duelle
 * verweisen – erhalten bleiben. Gelöscht wird nie.
 */
export async function importiereFragen(tx: Tx, fragen: FragenZeile[]): Promise<ImportErgebnis> {
  const ergebnis: ImportErgebnis = { neu: 0, geaendert: 0, unveraendert: 0, nichtInDatei: [] };

  for (const zeile of fragen) {
    const felder = {
      kategorie: zeile.kategorie,
      typ: zeile.typ,
      frageText: zeile.frage,
      bildUrl: zeile.bild_url ?? null,
      bildQuelle: zeile.bild_quelle ?? null,
      schwierigkeit: zeile.schwierigkeit,
      erklaerung: zeile.erklaerung ?? null,
      status: zeile.status,
    };
    // Reihenfolge der Optionen: richtige zuerst (angezeigt wird ohnehin gemischt)
    const antworten = [
      { text: zeile.richtig, istRichtig: true },
      { text: zeile.falsch1, istRichtig: false },
      { text: zeile.falsch2, istRichtig: false },
      { text: zeile.falsch3, istRichtig: false },
    ];

    const [vorhanden] = await tx.select().from(questions).where(eq(questions.code, zeile.code));
    if (!vorhanden) {
      const [frage] = await tx.insert(questions).values({ code: zeile.code, ...felder }).returning({ id: questions.id });
      await tx.insert(answerOptions).values(antworten.map((a) => ({ questionId: frage!.id, ...a })));
      ergebnis.neu++;
      continue;
    }

    const alteOptionen = await tx.select().from(answerOptions)
      .where(eq(answerOptions.questionId, vorhanden.id))
      .orderBy(asc(answerOptions.id));
    if (alteOptionen.length !== antworten.length) {
      throw new Error(`Frage "${zeile.code}" hat ${alteOptionen.length} statt ${antworten.length} Antwortoptionen in der Datenbank`);
    }

    const frageGeaendert = (Object.keys(felder) as (keyof typeof felder)[]).some((k) => vorhanden[k] !== felder[k]);
    const optionenGeaendert = alteOptionen.some((o, i) => o.text !== antworten[i]!.text || o.istRichtig !== antworten[i]!.istRichtig);
    if (!frageGeaendert && !optionenGeaendert) {
      ergebnis.unveraendert++;
      continue;
    }

    if (frageGeaendert) await tx.update(questions).set(felder).where(eq(questions.id, vorhanden.id));
    for (const [i, option] of alteOptionen.entries()) {
      await tx.update(answerOptions).set(antworten[i]!).where(eq(answerOptions.id, option.id));
    }
    ergebnis.geaendert++;
  }

  const codesInDatei = new Set(fragen.map((f) => f.code));
  const mitCode = await tx.select({ code: questions.code }).from(questions).where(isNotNull(questions.code));
  ergebnis.nichtInDatei = mitCode.map((f) => f.code!).filter((c) => !codesInDatei.has(c));
  return ergebnis;
}

if (import.meta.main) {
  const argumente = process.argv.slice(2);
  const nurPruefen = argumente.includes('--pruefen');
  const datei = argumente.find((a) => !a.startsWith('--')) ?? STANDARD_DATEI;

  const { fragen, fehler } = leseFragenCsv(new Uint8Array(await Bun.file(datei).arrayBuffer()));
  if (fehler.length) {
    console.error(`${datei}: ${fehler.length} Fehler – nichts importiert\n${fehler.map((f) => `  ${f}`).join('\n')}`);
    process.exit(1);
  }
  if (nurPruefen) {
    console.log(`${datei}: ${fragen.length} Fragen, alle gültig`);
    process.exit(0);
  }

  const { db, sqlClient } = await import('../db/client');
  const ergebnis = await db.transaction((tx) => importiereFragen(tx, fragen));
  console.log(`Fragen: ${ergebnis.neu} neu, ${ergebnis.geaendert} geändert, ${ergebnis.unveraendert} unverändert`);
  if (ergebnis.nichtInDatei.length) {
    console.warn(`Nicht mehr in der Datei (bleiben unverändert in der DB): ${ergebnis.nichtInDatei.join(', ')}`);
  }
  await sqlClient.end();
}

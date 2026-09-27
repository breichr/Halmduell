import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import type { DuellAusgang } from '@halmduell/shared';
import type { db } from '../db/client';
import { duelAnswers, duels } from '../db/schema';
import type { Tx } from '../db/types';

/**
 * Ergebnisse aller gewerteten Duelle eines Spielers, neueste zuerst. Aufgabe bzw.
 * Fristablauf entscheidet wie bei der Wertung unabhängig von den Punkten.
 */
export async function duellAusgaenge(q: Tx | typeof db, ich: number): Promise<DuellAusgang[]> {
  const richtigeVon = (spieler: typeof duels.spielerAId | typeof duels.spielerBId) => sql<number>`(
    select count(*)::int from ${duelAnswers}
    where ${duelAnswers.duelId} = ${duels.id} and ${duelAnswers.userId} = ${spieler} and ${duelAnswers.istRichtig})`;

  const zeilen = await q.select({
    a: duels.spielerAId,
    aufgegebenVon: duels.aufgegebenVon,
    punkteA: richtigeVon(duels.spielerAId),
    punkteB: richtigeVon(duels.spielerBId),
  }).from(duels)
    .where(and(eq(duels.status, 'abgeschlossen'), isNotNull(duels.spielerBId), or(eq(duels.spielerAId, ich), eq(duels.spielerBId, ich))))
    .orderBy(desc(duels.abgeschlossenAt), desc(duels.id));

  return zeilen.map((d) => {
    if (d.aufgegebenVon !== null) return d.aufgegebenVon === ich ? 'niederlage' : 'sieg';
    const [meine, seine] = d.a === ich ? [d.punkteA, d.punkteB] : [d.punkteB, d.punkteA];
    return meine > seine ? 'sieg' : meine < seine ? 'niederlage' : 'unentschieden';
  });
}

/** Längste Folge von Siegen (Reihenfolge egal, ob neueste oder älteste zuerst) */
export function laengsteSiegesserie(ausgaenge: DuellAusgang[]): number {
  let laengste = 0;
  let aktuell = 0;
  for (const a of ausgaenge) {
    aktuell = a === 'sieg' ? aktuell + 1 : 0;
    laengste = Math.max(laengste, aktuell);
  }
  return laengste;
}

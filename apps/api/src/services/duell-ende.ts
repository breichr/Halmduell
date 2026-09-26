import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { EINLADUNG_FRIST_MS, ZUG_FRIST_MS } from '@halmduell/shared';
import { db } from '../db/client';
import { duels } from '../db/schema';
import type { Tx } from '../db/types';
import { istLaufend } from './duell';
import { werteDuell } from './wertung';

type Duell = typeof duels.$inferSelect;

/**
 * Beendet ein laufendes Duell vorzeitig: `verliererId` hat aufgegeben bzw. die
 * Frist verpasst. Ohne Gegner (offene Einladung) wird es ohne Wertung abgebrochen.
 * Der Aufrufer muss die Duell-Zeile gesperrt haben.
 */
export async function beendeVorzeitig(tx: Tx, duel: Duell, verliererId: number, jetzt = new Date()): Promise<Duell> {
  if (!istLaufend(duel)) throw new Error(`Duell ${duel.id} ist bereits beendet`);

  if (duel.spielerBId === null) {
    const [abgebrochen] = await tx.update(duels)
      .set({ status: 'abgebrochen', abgeschlossenAt: jetzt, einladungsCode: null })
      .where(eq(duels.id, duel.id))
      .returning();
    return abgebrochen!;
  }

  const [beendet] = await tx.update(duels)
    .set({ status: 'abgeschlossen', abgeschlossenAt: jetzt, aufgegebenVon: verliererId })
    .where(eq(duels.id, duel.id))
    .returning();
  await werteDuell(tx, beendet!);
  const [gewertet] = await tx.select().from(duels).where(eq(duels.id, duel.id));
  return gewertet!;
}

/** Wer gerade am Zug ist (und bei Fristablauf verliert) */
function amZug(duel: Duell): number {
  return duel.status === 'wartet_a' ? duel.spielerAId : duel.spielerBId!;
}

/**
 * Beendet alle Duelle mit abgelaufener Frist:
 * - Zug nicht innerhalb von 3 Tagen gespielt → wer am Zug ist, verliert
 * - Einladung nach 7 Tagen nicht angenommen → abgebrochen ohne Wertung
 * Jedes Duell in eigener Transaktion; bereits gesperrte werden übersprungen.
 */
export async function verarbeiteFristen(jetzt = new Date()): Promise<{ beendet: number }> {
  const zugGrenze = new Date(jetzt.getTime() - ZUG_FRIST_MS);
  const einladungGrenze = new Date(jetzt.getTime() - EINLADUNG_FRIST_MS);
  const abgelaufen = or(
    // Zug verpasst (mit Gegner, oder A hat bei offener Einladung nicht gespielt)
    and(inArray(duels.status, ['wartet_a', 'wartet_b']), lt(duels.zugSeit, zugGrenze),
      or(isNotNull(duels.spielerBId), eq(duels.status, 'wartet_a'))),
    // A hat gespielt, aber niemand hat die Einladung angenommen
    and(eq(duels.status, 'wartet_b'), isNull(duels.spielerBId), lt(duels.erstelltAt, einladungGrenze)),
  );

  const kandidaten = await db.select({ id: duels.id }).from(duels).where(abgelaufen);
  let beendet = 0;
  for (const { id } of kandidaten) {
    await db.transaction(async (tx) => {
      const [duel] = await tx.select().from(duels)
        .where(and(eq(duels.id, id), abgelaufen))
        .for('update', { skipLocked: true });
      if (!duel) return; // inzwischen weitergespielt oder von anderem Prozess erledigt
      await beendeVorzeitig(tx, duel, amZug(duel), jetzt);
      beendet++;
    });
  }
  return { beendet };
}

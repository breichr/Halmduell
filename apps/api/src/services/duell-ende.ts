import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { EINLADUNG_FRIST_MS, ERINNERUNG_VOR_FRIST_MS, ZUG_FRIST_MS } from '@halmduell/shared';
import { db } from '../db/client';
import { duels, users } from '../db/schema';
import type { Tx } from '../db/types';
import { nachricht } from './benachrichtigungen';
import { istLaufend } from './duell';
import { pushAktiv, spaeterSenden, type Versand } from './push';
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
    const versand = await db.transaction(async (tx): Promise<Versand[]> => {
      const [duel] = await tx.select().from(duels)
        .where(and(eq(duels.id, id), abgelaufen))
        .for('update', { skipLocked: true });
      if (!duel) return []; // inzwischen weitergespielt oder von anderem Prozess erledigt
      const verlierer = amZug(duel);
      await beendeVorzeitig(tx, duel, verlierer, jetzt);
      beendet++;
      if (duel.spielerBId === null) return [];
      const gewinner = verlierer === duel.spielerAId ? duel.spielerBId : duel.spielerAId;
      const namen = await namenVon(tx, [verlierer, gewinner]);
      return [
        { an: gewinner, nachricht: nachricht.fristGewonnen(duel.id, namen.get(verlierer) ?? 'Dein Gegner') },
        { an: verlierer, nachricht: nachricht.fristVerloren(duel.id, namen.get(gewinner) ?? 'deinen Gegner') },
      ];
    });
    spaeterSenden(versand);
  }
  return { beendet };
}

/**
 * Erinnert per Push, wer am Zug ist und nur noch 24 Stunden hat – einmal je Zug.
 * Ohne eingerichteten Web Push passiert nichts.
 */
export async function verschickeErinnerungen(jetzt = new Date()): Promise<{ erinnert: number }> {
  if (!pushAktiv()) return { erinnert: 0 };
  const grenze = new Date(jetzt.getTime() - (ZUG_FRIST_MS - ERINNERUNG_VOR_FRIST_MS));
  const faellig = await db.update(duels)
    .set({ erinnertAt: jetzt })
    .where(and(
      inArray(duels.status, ['wartet_a', 'wartet_b']),
      lt(duels.zugSeit, grenze),
      // bei offener Einladung wartet niemand in Status wartet_b auf einen Zug
      or(isNotNull(duels.spielerBId), eq(duels.status, 'wartet_a')),
      or(isNull(duels.erinnertAt), lt(duels.erinnertAt, duels.zugSeit)),
    ))
    .returning();
  const gegnerIds = faellig.map((d) => (amZug(d) === d.spielerAId ? d.spielerBId : d.spielerAId)).filter((id): id is number => id !== null);
  const namen = await namenVon(db, gegnerIds);
  spaeterSenden(faellig.map((d) => {
    const gegner = amZug(d) === d.spielerAId ? d.spielerBId : d.spielerAId;
    return { an: amZug(d), nachricht: nachricht.erinnerung(d.id, gegner === null ? null : namen.get(gegner) ?? null) };
  }));
  return { erinnert: faellig.length };
}

async function namenVon(q: Tx | typeof db, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const zeilen = await q.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, ids));
  return new Map(zeilen.map((z) => [z.id, z.username]));
}

import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { aktuelleSaison, type RatingKategorie } from '@halmduell/shared';
import { db } from '../db/client';
import { platzVerlauf } from '../db/schema';

/** Wie lange Schnappschüsse aufbewahrt werden */
const AUFBEWAHREN_TAGE = 30;

/** Heutiger Kalendertag in deutscher Zeit */
const heute = sql`(now() at time zone 'Europe/Berlin')::date`;

/**
 * Hält einmal am Tag (beim ersten Lauf nach Mitternacht) die Plätze aller
 * Platzierten der laufenden Saison fest – also den Stand vom Ende des Vortags.
 * Mehrfach aufrufbar; mehrere API-Instanzen stören sich nicht.
 */
export async function platzSchnappschuss(): Promise<{ angelegt: number }> {
  const saison = aktuelleSaison();
  const [schonDa] = await db.select({ tag: platzVerlauf.tag }).from(platzVerlauf)
    .where(and(eq(platzVerlauf.saison, saison), sql`${platzVerlauf.tag} = ${heute}`)).limit(1);
  if (schonDa) return { angelegt: 0 };

  const angelegt = await db.execute(sql`
    insert into platz_verlauf (user_id, kategorie, saison, tag, platz)
    select user_id, kategorie, saison, ${heute}, rank() over (partition by kategorie order by rating desc)
    from ratings where saison = ${saison}
    on conflict do nothing`);
  await db.delete(platzVerlauf).where(lt(platzVerlauf.tag, sql`${heute} - ${AUFBEWAHREN_TAGE}::int`));
  return { angelegt: angelegt.count };
}

/** Plätze laut heutigem Schnappschuss (Stand Ende gestern) für die angegebenen Spieler */
export async function plaetzeVonGestern(kategorie: RatingKategorie, saison: number, userIds: number[]): Promise<Map<number, number>> {
  if (userIds.length === 0) return new Map();
  const zeilen = await db.select({ id: platzVerlauf.userId, platz: platzVerlauf.platz }).from(platzVerlauf)
    .where(and(
      eq(platzVerlauf.kategorie, kategorie),
      eq(platzVerlauf.saison, saison),
      sql`${platzVerlauf.tag} = ${heute}`,
      inArray(platzVerlauf.userId, userIds),
    ));
  return new Map(zeilen.map((z) => [z.id, z.platz]));
}

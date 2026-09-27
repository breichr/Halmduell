import { sql, type SQL } from 'drizzle-orm';
import type { FragenKategorie } from '@halmduell/shared';
import type { db } from '../db/client';
import type { Tx } from '../db/types';

type Q = Tx | typeof db;

export interface OffeneFrage {
  id: number;
  kategorie: FragenKategorie;
  richtigInFolge: number;
  geuebtAt: Date | null;
}

/**
 * Fragen zum Üben: im Duell falsch beantwortet (auch Zeit abgelaufen) und seitdem
 * nicht gemeistert. Ein erneuter Fehler im Duell nach dem Meistern holt sie zurück.
 */
export async function offeneFragen(q: Q, ich: number, filter?: { kategorie?: FragenKategorie; frageId?: number }): Promise<OffeneFrage[]> {
  const bedingungen: SQL[] = [sql`q.status = 'freigegeben'`, sql`(u.gemeistert_at is null or f.zuletzt_falsch > u.gemeistert_at)`];
  if (filter?.kategorie) bedingungen.push(sql`q.kategorie = ${filter.kategorie}`);
  if (filter?.frageId) bedingungen.push(sql`q.id = ${filter.frageId}`);
  const zeilen = await q.execute<{ id: number; kategorie: FragenKategorie; richtig_in_folge: number | null; geuebt_at: Date | string | null }>(sql`
    select q.id, q.kategorie, u.richtig_in_folge, u.geuebt_at
    from questions q
    join (
      select question_id, max(beantwortet_at) as zuletzt_falsch
      from duel_answers
      where user_id = ${ich} and ist_richtig = false
      group by question_id
    ) f on f.question_id = q.id
    left join uebungen u on u.user_id = ${ich} and u.question_id = q.id
    where ${sql.join(bedingungen, sql` and `)}`);
  return zeilen.map((z) => ({
    id: z.id,
    kategorie: z.kategorie,
    richtigInFolge: z.richtig_in_folge ?? 0,
    geuebtAt: z.geuebt_at === null ? null : new Date(z.geuebt_at),
  }));
}

/** Nächste Frage: am längsten nicht geübt zuerst (nie geübt vorn), bei Gleichstand zufällig */
export function waehleNaechste(offen: OffeneFrage[], ohne?: number): OffeneFrage | null {
  const kandidaten = offen.length > 1 ? offen.filter((f) => f.id !== ohne) : offen;
  if (kandidaten.length === 0) return null;
  const zeit = (f: OffeneFrage) => f.geuebtAt?.getTime() ?? 0;
  const aelteste = Math.min(...kandidaten.map(zeit));
  const vorne = kandidaten.filter((f) => zeit(f) === aelteste);
  return vorne[Math.floor(Math.random() * vorne.length)]!;
}

/** Antworten zufällig mischen (beim Üben darf die Reihenfolge jedes Mal anders sein) */
export function mischen<T>(liste: T[]): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

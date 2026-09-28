import {
  EINLADUNG_FRIST_MS,
  EINLADUNGSCODE_LAENGE,
  ZUG_FRIST_MS,
  type AntwortStand,
  type DuellSpieler,
  type DuellUebersicht,
} from '@halmduell/shared';
import type { duelAnswers, duels } from '../db/schema';
import { zufallsCode } from './zufall';

type Duell = typeof duels.$inferSelect;
type DuellAntwort = typeof duelAnswers.$inferSelect;

export function erzeugeEinladungsCode(): string {
  return zufallsCode(EINLADUNGSCODE_LAENGE);
}

/** Stabile, pro Spieler unterschiedliche Reihenfolge der Antwortoptionen (bleibt beim Neuladen gleich) */
export function mischeAntworten<T extends { id: number }>(optionen: T[], duelId: number, userId: number): T[] {
  const schluessel = (id: number) => Math.imul(id ^ Math.imul(duelId, 40503) ^ Math.imul(userId, 97), 2654435761) >>> 0;
  return [...optionen].sort((x, y) => schluessel(x.id) - schluessel(y.id));
}

export function istAmZug(duel: Duell, userId: number): boolean {
  return (duel.status === 'wartet_a' && duel.spielerAId === userId)
    || (duel.status === 'wartet_b' && duel.spielerBId === userId);
}

export function istLaufend(duel: Duell): boolean {
  return duel.status === 'wartet_a' || duel.status === 'wartet_b';
}

/** Frist des aktuellen Zugs; bei offener Einladung nach As Runde deren Ablauf */
export function zugBis(duel: Duell): Date | null {
  if (!istLaufend(duel)) return null;
  if (duel.status === 'wartet_b' && duel.spielerBId === null) {
    return new Date(duel.erstelltAt.getTime() + EINLADUNG_FRIST_MS);
  }
  return new Date(duel.zugSeit.getTime() + ZUG_FRIST_MS);
}

export function istTeilnehmer(duel: Duell, userId: number): boolean {
  return duel.spielerAId === userId || duel.spielerBId === userId;
}

export function antwortStand(antwort: DuellAntwort | undefined): AntwortStand | null {
  if (!antwort || antwort.istRichtig === null) return null;
  return { antwortId: antwort.answerOptionId, richtig: antwort.istRichtig, antwortzeitMs: antwort.antwortzeitMs };
}

/**
 * Sicht eines Spielers auf ein Duell. Punkte des Gegners zählen nur für Fragen,
 * die der Spieler selbst schon beantwortet hat – sonst verrät das Dashboard Ergebnisse vorab.
 */
export function baueUebersicht(
  duel: Duell,
  userId: number,
  gegner: DuellSpieler | null,
  antworten: DuellAntwort[],
): DuellUebersicht {
  const ichBinA = duel.spielerAId === userId;
  const meine = antworten.filter((a) => a.userId === userId && a.istRichtig !== null);
  const beantwortet = new Set(meine.map((a) => a.questionId));
  const gegnerSichtbar = antworten.filter(
    (a) => gegner && a.userId === gegner.id && a.istRichtig !== null && beantwortet.has(a.questionId),
  );

  return {
    id: duel.id,
    kategorie: duel.kategorie,
    status: duel.status,
    gegner,
    duBistDran: istAmZug(duel, userId),
    einladungsCode: ichBinA ? duel.einladungsCode : null,
    zufall: duel.zufall,
    meinePunkte: meine.filter((a) => a.istRichtig).length,
    gegnerPunkte: gegnerSichtbar.filter((a) => a.istRichtig).length,
    ratingAenderung: ichBinA ? duel.ratingAenderungA : duel.ratingAenderungB,
    zugBis: zugBis(duel)?.toISOString() ?? null,
    aufgegeben: duel.aufgegebenVon === null ? null : duel.aufgegebenVon === userId ? 'ich' : 'gegner',
    erstelltAt: duel.erstelltAt.toISOString(),
    abgeschlossenAt: duel.abgeschlossenAt?.toISOString() ?? null,
  };
}

/** Dashboard-Sortierung: am Zug zuerst, abgeschlossene zuletzt, sonst neueste zuerst */
export function sortiereFuerDashboard(a: DuellUebersicht, b: DuellUebersicht): number {
  const beendet = (d: DuellUebersicht) => d.status === 'abgeschlossen' || d.status === 'abgebrochen';
  const rang = (d: DuellUebersicht) => (d.duBistDran ? 0 : beendet(d) ? 2 : 1);
  return rang(a) - rang(b) || b.erstelltAt.localeCompare(a.erstelltAt);
}

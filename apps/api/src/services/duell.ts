import {
  EINLADUNGSCODE_LAENGE,
  type AntwortStand,
  type DuellSpieler,
  type DuellUebersicht,
} from '@halmduell/shared';
import type { duelAnswers, duels } from '../db/schema';

type Duell = typeof duels.$inferSelect;
type DuellAntwort = typeof duelAnswers.$inferSelect;

// ohne leicht verwechselbare Zeichen (0/O, 1/I/L)
const CODE_ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// größtes Vielfaches der Zeichenanzahl unter 256 – Bytes darüber verwerfen, sonst wären einige Zeichen häufiger
const BYTE_GRENZE = 256 - (256 % CODE_ZEICHEN.length);

export function erzeugeEinladungsCode(): string {
  let code = '';
  while (code.length < EINLADUNGSCODE_LAENGE) {
    for (const b of crypto.getRandomValues(new Uint8Array(EINLADUNGSCODE_LAENGE))) {
      if (b < BYTE_GRENZE && code.length < EINLADUNGSCODE_LAENGE) code += CODE_ZEICHEN[b % CODE_ZEICHEN.length];
    }
  }
  return code;
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
    meinePunkte: meine.filter((a) => a.istRichtig).length,
    gegnerPunkte: gegnerSichtbar.filter((a) => a.istRichtig).length,
    ratingAenderung: ichBinA ? duel.ratingAenderungA : duel.ratingAenderungB,
    erstelltAt: duel.erstelltAt.toISOString(),
    abgeschlossenAt: duel.abgeschlossenAt?.toISOString() ?? null,
  };
}

/** Dashboard-Sortierung: am Zug zuerst, abgeschlossene zuletzt, sonst neueste zuerst */
export function sortiereFuerDashboard(a: DuellUebersicht, b: DuellUebersicht): number {
  const rang = (d: DuellUebersicht) => (d.duBistDran ? 0 : d.status === 'abgeschlossen' ? 2 : 1);
  return rang(a) - rang(b) || b.erstelltAt.localeCompare(a.erstelltAt);
}

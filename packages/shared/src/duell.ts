import { z } from 'zod';
import { DUELL_KATEGORIEN, type DuellKategorie, type DuellStatus, type FrageTyp } from './konstanten';

export const FRAGEN_PRO_DUELL = 6;
/** Zeit pro Frage; der Server gibt zusätzlich eine kleine Toleranz für die Netzwerklaufzeit */
export const ANTWORTZEIT_MS = 15_000;
export const EINLADUNGSCODE_LAENGE = 8;
/** Wer nicht innerhalb dieser Frist seinen Zug spielt, verliert das Duell */
export const ZUG_FRIST_MS = 3 * 24 * 60 * 60 * 1000;
/** Nicht angenommene Einladungen verfallen danach ohne Wertung */
export const EINLADUNG_FRIST_MS = 7 * 24 * 60 * 60 * 1000;

// --- Requests ---

export const neuesDuellSchema = z.object({
  kategorie: z.enum(DUELL_KATEGORIEN),
  /** Benutzername des Gegners; ohne Gegner wird ein Einladungscode erzeugt */
  gegner: z.string().trim().min(1).max(50).optional(),
});
export type NeuesDuell = z.infer<typeof neuesDuellSchema>;

export const beitretenSchema = z.object({
  code: z.string().trim().toUpperCase().length(EINLADUNGSCODE_LAENGE, 'Ungültiger Einladungscode'),
});

export const antwortSchema = z.object({
  frageId: z.number().int(),
  /** null = Zeit abgelaufen / keine Antwort */
  antwortId: z.number().int().nullable(),
});
export type Antwort = z.infer<typeof antwortSchema>;

// --- Responses ---

export interface DuellSpieler {
  id: number;
  username: string;
}

/** Eintrag in GET /api/duels (Dashboard) */
export interface DuellUebersicht {
  id: number;
  kategorie: DuellKategorie;
  status: DuellStatus;
  gegner: DuellSpieler | null;
  duBistDran: boolean;
  /** nur für den Ersteller, solange noch niemand beigetreten ist */
  einladungsCode: string | null;
  meinePunkte: number;
  /** nur Punkte aus Fragen, die ich selbst schon beantwortet habe */
  gegnerPunkte: number;
  /** Änderung meines Gesamt-Ratings, sobald das Duell gewertet ist */
  ratingAenderung: number | null;
  /** Frist für den aktuellen Zug (bzw. Ablauf der offenen Einladung); null, wenn das Duell beendet ist */
  zugBis: string | null;
  /** wer aufgegeben hat bzw. die Frist verpasst hat */
  aufgegeben: 'ich' | 'gegner' | null;
  erstelltAt: string;
  abgeschlossenAt: string | null;
}

export interface AntwortStand {
  antwortId: number | null;
  richtig: boolean;
  antwortzeitMs: number | null;
}

/** Frage im Rundenvergleich; Details erst sichtbar, nachdem ich sie beantwortet habe */
export interface DuellFrageVergleich {
  reihenfolge: number;
  beantwortet: boolean;
  frage: {
    id: number;
    typ: FrageTyp;
    frageText: string;
    bildUrl: string | null;
    bildQuelle: string | null;
    erklaerung: string | null;
    richtigeAntwort: { id: number; text: string } | null;
  } | null;
  ich: AntwortStand | null;
  gegner: AntwortStand | null;
}

/** GET /api/duels/:id */
export interface DuellDetails extends DuellUebersicht {
  fragen: DuellFrageVergleich[];
}

/** GET /api/duels/:id/frage */
export interface GestellteFrage {
  duelId: number;
  reihenfolge: number;
  anzahl: number;
  frageId: number;
  typ: FrageTyp;
  frageText: string;
  bildUrl: string | null;
  bildQuelle: string | null;
  antworten: { id: number; text: string }[];
  zeitlimitMs: number;
  restzeitMs: number;
}

/** POST /api/duels/:id/antwort */
export interface AntwortErgebnis {
  richtig: boolean;
  zeitAbgelaufen: boolean;
  richtigeAntwortId: number;
  erklaerung: string | null;
  /** true, wenn das meine letzte Frage in diesem Duell war */
  rundeFertig: boolean;
  status: DuellStatus;
}

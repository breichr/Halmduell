import { z } from 'zod';
import type { NeuesAbzeichen } from './abzeichen';
import { FRAGEN_KATEGORIEN, type FragenKategorie, type FrageTyp } from './konstanten';

/** So oft in Folge richtig, dann gilt eine Frage als gemeistert */
export const UEBEN_ZIEL = 2;

// --- Requests ---

/** GET /api/ueben/frage – `ohne`: zuletzt geübte Frage, damit sie nicht direkt wiederkommt */
export const uebenFrageSchema = z.object({
  kategorie: z.enum(FRAGEN_KATEGORIEN).optional(),
  ohne: z.coerce.number().int().positive().optional(),
});

/** POST /api/ueben/antwort */
export const uebenAntwortSchema = z.object({
  frageId: z.number().int().positive(),
  antwortId: z.number().int().positive(),
  /** nur für den Zähler „noch offen“ in der Antwort */
  kategorie: z.enum(FRAGEN_KATEGORIEN).optional(),
});

// --- Responses ---

/** GET /api/ueben */
export interface UebenUebersicht {
  /** Fragen, die noch geübt werden sollten */
  offen: number;
  /** immer alle Fragenkategorien, in fester Reihenfolge */
  jeKategorie: { kategorie: FragenKategorie; offen: number }[];
  /** bisher durch Üben gemeistert (und nicht wieder falsch beantwortet) */
  gemeistert: number;
}

export interface UebungsFrage {
  frageId: number;
  kategorie: FragenKategorie;
  typ: FrageTyp;
  frageText: string;
  bildUrl: string | null;
  bildQuelle: string | null;
  antworten: { id: number; text: string }[];
  /** bisher in Folge richtig (Ziel: UEBEN_ZIEL) */
  richtigInFolge: number;
}

/** GET /api/ueben/frage – `frage: null`, wenn (in der Kategorie) nichts mehr offen ist */
export interface UebungsRunde {
  frage: UebungsFrage | null;
  offen: number;
}

/** POST /api/ueben/antwort */
export interface UebungsErgebnis {
  richtig: boolean;
  richtigeAntwortId: number;
  erklaerung: string | null;
  richtigInFolge: number;
  /** mit dieser Antwort gemeistert */
  gemeistert: boolean;
  /** danach noch offen (in der gewählten Kategorie bzw. insgesamt) */
  offen: number;
  neueAbzeichen: NeuesAbzeichen[];
}

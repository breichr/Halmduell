import { z } from 'zod';
import { RATING_KATEGORIEN, type Liga, type RatingKategorie } from './konstanten';

/** Wie viele Plätze die Rangliste zeigt (der eigene Platz kommt immer dazu) */
export const RANGLISTE_LAENGE = 100;

/** Ermittelt die Liga-Bezeichnung zu einem Rating (rein kosmetisch) */
export function liga(rating: number): Liga {
  if (rating < 900) return 'Bronze';
  if (rating < 1100) return 'Silber';
  if (rating < 1300) return 'Gold';
  if (rating < 1500) return 'Platin';
  return 'Meister';
}

// --- Requests ---

/** Query-Parameter von GET /api/rangliste; ohne Saison gilt die laufende */
export const ranglisteSchema = z.object({
  kategorie: z.enum(RATING_KATEGORIEN).default('gesamt'),
  saison: z.coerce.number().int().min(1).optional(),
});

// --- Responses ---

export interface RanglistenEintrag {
  /** gleiches Rating = gleicher Platz */
  platz: number;
  id: number;
  username: string;
  rating: number;
  liga: Liga;
  /** Duelle in dieser Kategorie und Saison */
  duelle: number;
}

/** GET /api/rangliste */
export interface Rangliste {
  kategorie: RatingKategorie;
  saison: number;
  aktuelleSaison: number;
  /** Saisons, für die es Ergebnisse gibt (neueste zuerst, laufende immer dabei) */
  saisons: number[];
  /** Anzahl platzierter Spieler insgesamt */
  spielerAnzahl: number;
  eintraege: RanglistenEintrag[];
  /** eigener Eintrag, auch wenn er außerhalb der gezeigten Plätze liegt; null = in dieser Saison/Kategorie noch nicht gespielt */
  ich: RanglistenEintrag | null;
}

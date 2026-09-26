// Geteilte Typen/Konstanten zwischen Frontend (apps/web) und Backend (apps/api)

export const FRAGEN_KATEGORIEN = ['kulturen', 'schaedlinge', 'krankheiten', 'wissen'] as const;
export type FragenKategorie = (typeof FRAGEN_KATEGORIEN)[number];

export const DUELL_KATEGORIEN = [...FRAGEN_KATEGORIEN, 'gemischt'] as const;
export type DuellKategorie = (typeof DUELL_KATEGORIEN)[number];

/** 'gemischt'-Duelle zählen nur für 'gesamt', es gibt kein eigenes Rating dafür */
export const RATING_KATEGORIEN = ['gesamt', ...FRAGEN_KATEGORIEN] as const;
export type RatingKategorie = (typeof RATING_KATEGORIEN)[number];

export type FrageTyp = 'bild' | 'text';
export type FrageStatus = 'entwurf' | 'eingereicht' | 'freigegeben' | 'abgelehnt';
export type DuellStatus = 'wartet_a' | 'wartet_b' | 'abgeschlossen';
export type FreundschaftStatus = 'angefragt' | 'bestaetigt';
export type Liga = 'Bronze' | 'Silber' | 'Gold' | 'Platin' | 'Meister';

/** Antwort von POST /api/duels/:id/complete */
export interface DuellWertung {
  punkteA: number;
  punkteB: number;
  saison: number;
  ratings: Partial<Record<RatingKategorie, { a: number; b: number }>>;
}

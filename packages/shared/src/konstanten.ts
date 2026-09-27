export const FRAGEN_KATEGORIEN = ['landtechnik', 'pflanzenbau', 'viehzucht'] as const;
export type FragenKategorie = (typeof FRAGEN_KATEGORIEN)[number];

export const DUELL_KATEGORIEN = [...FRAGEN_KATEGORIEN, 'gemischt'] as const;
export type DuellKategorie = (typeof DUELL_KATEGORIEN)[number];

/** Anzeigenamen der Kategorien */
export const KATEGORIE_NAMEN: Record<DuellKategorie | 'gesamt', string> = {
  landtechnik: 'Landtechnik',
  pflanzenbau: 'Pflanzenbau',
  viehzucht: 'Viehzucht',
  gemischt: 'Gemischt',
  gesamt: 'Gesamt',
};

/** 'gemischt'-Duelle zählen nur für 'gesamt', es gibt kein eigenes Rating dafür */
export const RATING_KATEGORIEN = ['gesamt', ...FRAGEN_KATEGORIEN] as const;
export type RatingKategorie = (typeof RATING_KATEGORIEN)[number];

export const FRAGE_TYPEN = ['bild', 'text'] as const;
export type FrageTyp = (typeof FRAGE_TYPEN)[number];

export const FRAGE_STATUS = ['entwurf', 'eingereicht', 'freigegeben', 'abgelehnt'] as const;
export type FrageStatus = (typeof FRAGE_STATUS)[number];

/** 'abgebrochen' = beendet ohne Wertung (z. B. Einladung nie angenommen) */
export const DUELL_STATUS = ['wartet_a', 'wartet_b', 'abgeschlossen', 'abgebrochen'] as const;
export type DuellStatus = (typeof DUELL_STATUS)[number];

export const FREUNDSCHAFT_STATUS = ['angefragt', 'bestaetigt'] as const;
export type FreundschaftStatus = (typeof FREUNDSCHAFT_STATUS)[number];
export type Liga = 'Bronze' | 'Silber' | 'Gold' | 'Platin' | 'Meister';

/** Ergebnis der ELO-Wertung eines abgeschlossenen Duells (neue Ratings je Kategorie) */
export interface DuellWertung {
  punkteA: number;
  punkteB: number;
  saison: number;
  ratings: Partial<Record<RatingKategorie, { a: number; b: number }>>;
}

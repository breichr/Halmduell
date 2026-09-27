import type { FragenKategorie, Liga, RatingKategorie } from './konstanten';

export type DuellAusgang = 'sieg' | 'unentschieden' | 'niederlage';

/** Wie viele Ergebnisse die Formkurve zeigt */
export const FORM_LAENGE = 10;

export interface Trefferquote {
  /** beantwortete Fragen (inkl. abgelaufener Zeit) */
  beantwortet: number;
  richtig: number;
}

/** GET /api/statistik – über alle Saisons, Ratings aus der laufenden */
export interface Statistik {
  /** gewertete (abgeschlossene) Duelle */
  duelle: { gespielt: number; siege: number; unentschieden: number; niederlagen: number };
  /** letzte Ergebnisse, neueste zuerst (höchstens FORM_LAENGE) */
  form: DuellAusgang[];
  /** aktuelle Serie gleicher Ergebnisse (ab 2), sonst null */
  serie: { ausgang: DuellAusgang; laenge: number } | null;
  fragen: Trefferquote & {
    /** Zeit abgelaufen, ohne Antwort */
    abgelaufen: number;
    /** Durchschnittliche Zeit bis zur richtigen Antwort; null ohne richtige Antwort */
    schnittRichtigMs: number | null;
  };
  /** immer alle Fragenkategorien, in fester Reihenfolge */
  kategorien: (Trefferquote & { kategorie: FragenKategorie })[];
  /** Ratings der laufenden Saison; null = in der Kategorie noch nicht gespielt */
  ratings: { kategorie: RatingKategorie; rating: number | null; liga: Liga | null }[];
  saison: number;
}

/** Trefferquote in Prozent (gerundet); null ohne beantwortete Fragen */
export function quote(t: Trefferquote): number | null {
  return t.beantwortet ? Math.round((t.richtig / t.beantwortet) * 100) : null;
}

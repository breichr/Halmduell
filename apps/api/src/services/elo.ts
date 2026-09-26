const K_FACTOR_NEW = 40; // für Spieler mit < 20 Duellen
const K_FACTOR_ESTABLISHED = 20; // für erfahrene Spieler

/** Erwartete Gewinnwahrscheinlichkeit von A gegen B */
export function erwartetesErgebnis(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * ergebnisA: 1 = Sieg, 0.5 = Unentschieden, 0 = Niederlage
 * spieleA: Anzahl bisheriger Duelle von Spieler A (steuert den K-Faktor)
 */
export function updateElo(
  ratingA: number,
  ratingB: number,
  ergebnisA: 0 | 0.5 | 1,
  spieleA: number,
): number {
  const k = spieleA < 20 ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED;
  const erwartetA = erwartetesErgebnis(ratingA, ratingB);
  return Math.round(ratingA + k * (ergebnisA - erwartetA));
}

/** Soft-Reset für Saisonwechsel: zieht Ratings näher an 1000, statt hart zu resetten */
export function saisonalerSoftReset(altesRating: number, faktor = 0.5): number {
  return Math.round(1000 + (altesRating - 1000) * faktor);
}

/** Ermittelt die Liga-Bezeichnung zu einem Rating (rein kosmetisch) */
export function liga(rating: number): string {
  if (rating < 900) return 'Bronze';
  if (rating < 1100) return 'Silber';
  if (rating < 1300) return 'Gold';
  if (rating < 1500) return 'Platin';
  return 'Meister';
}

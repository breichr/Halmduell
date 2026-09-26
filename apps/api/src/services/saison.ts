/** Jahr, in dessen erstem Quartal Saison 1 läuft (ggf. an den Launch anpassen) */
const ERSTES_SAISON_JAHR = 2026;

/** Saisons laufen quartalsweise (alle 3 Monate) und werden fortlaufend ab 1 gezählt */
export function aktuelleSaison(datum: Date = new Date()): number {
  return (datum.getUTCFullYear() - ERSTES_SAISON_JAHR) * 4 + Math.floor(datum.getUTCMonth() / 3) + 1;
}

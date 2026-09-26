/**
 * Saisons = Kalenderquartale (Q1: 1.1.–31.3., Q2: 1.4.–30.6., Q3: 1.7.–30.9.,
 * Q4: 1.10.–31.12.), fortlaufend gezählt ab Saison 1 = Q1 2026. Der Wechsel
 * passiert um Mitternacht deutscher/österreichischer Zeit, nicht UTC.
 */
export const SAISON_ZEITZONE = 'Europe/Berlin';
const ERSTES_SAISON_JAHR = 2026;

const datumsFormat = new Intl.DateTimeFormat('en-US', { timeZone: SAISON_ZEITZONE, year: 'numeric', month: 'numeric' });

function jahrUndQuartal(datum: Date): { jahr: number; quartal: number } {
  const teile = datumsFormat.formatToParts(datum);
  const jahr = Number(teile.find((t) => t.type === 'year')!.value);
  const monat = Number(teile.find((t) => t.type === 'month')!.value);
  return { jahr, quartal: Math.floor((monat - 1) / 3) + 1 };
}

export function aktuelleSaison(datum: Date = new Date()): number {
  const { jahr, quartal } = jahrUndQuartal(datum);
  return (jahr - ERSTES_SAISON_JAHR) * 4 + quartal;
}

/** Anzeigename einer Saison, z. B. "Q3 2026" */
export function saisonBezeichnung(saison: number): string {
  const index = saison - 1;
  const jahr = ERSTES_SAISON_JAHR + Math.floor(index / 4);
  const quartal = (((index % 4) + 4) % 4) + 1;
  return `Q${quartal} ${jahr}`;
}

import { KATEGORIE_NAMEN, type DuellKategorie } from '@halmduell/shared';

export const kategorieName = (k: DuellKategorie | 'gesamt') => KATEGORIE_NAMEN[k];

/** "noch 2 Tage", "noch 5 Std.", "noch 12 Min." */
export function restzeit(bis: string, jetzt = Date.now()): string {
	const ms = new Date(bis).getTime() - jetzt;
	if (ms <= 0) return 'abgelaufen';
	const minuten = Math.floor(ms / 60_000);
	if (minuten < 60) return `noch ${Math.max(1, minuten)} Min.`;
	const stunden = Math.floor(minuten / 60);
	if (stunden < 48) return `noch ${stunden} Std.`;
	return `noch ${Math.floor(stunden / 24)} Tage`;
}

/** "heute", "gestern", "vor 3 Tagen", sonst Datum */
export function wann(zeitpunkt: string, jetzt = new Date()): string {
	const datum = new Date(zeitpunkt);
	const tage = Math.round((startDesTages(jetzt) - startDesTages(datum)) / 86_400_000);
	if (tage <= 0) return 'heute';
	if (tage === 1) return 'gestern';
	if (tage < 7) return `vor ${tage} Tagen`;
	return datum.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

function startDesTages(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function vorzeichen(zahl: number): string {
	return zahl > 0 ? `+${zahl}` : String(zahl);
}

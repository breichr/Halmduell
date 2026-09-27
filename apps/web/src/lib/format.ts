import { GERADE_AKTIV_MS, KATEGORIE_NAMEN, type DuellKategorie } from '@halmduell/shared';

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

/** Kachelfarbe je Kategorie (Text darauf immer dunkel) */
export const KATEGORIE_FARBE: Record<DuellKategorie, string> = {
	landtechnik: 'var(--orange)',
	pflanzenbau: 'var(--hellgruen)',
	viehzucht: 'var(--sonne)',
	gemischt: '#ffffff'
};

/** Ist jemand gerade in der App? */
export const geradeAktiv = (zuletzt: string | null, jetzt = Date.now()) =>
	zuletzt !== null && jetzt - new Date(zuletzt).getTime() < GERADE_AKTIV_MS;

/** "gerade aktiv", "vor 20 Min. aktiv", "vor 3 Std. aktiv", "gestern aktiv", "am 3. Sept. aktiv" */
export function aktivText(zuletzt: string | null, jetzt = new Date()): string {
	if (zuletzt === null) return 'länger nicht aktiv';
	const ms = jetzt.getTime() - new Date(zuletzt).getTime();
	if (ms < GERADE_AKTIV_MS) return 'gerade aktiv';
	const minuten = Math.floor(ms / 60_000);
	if (minuten < 60) return `vor ${minuten} Min. aktiv`;
	if (minuten < 12 * 60) return `vor ${Math.floor(minuten / 60)} Std. aktiv`;
	const w = wann(zuletzt, jetzt);
	if (w === 'heute') return `vor ${Math.floor(minuten / 60)} Std. aktiv`;
	return /^\d/.test(w) ? `am ${w} aktiv` : `${w} aktiv`;
}

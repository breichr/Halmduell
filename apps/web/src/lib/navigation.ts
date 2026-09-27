/** Nur interne Pfade als Rücksprungziel zulassen (kein Open Redirect) */
export function sicheresZiel(weiter: string | null | undefined): string {
	return weiter && weiter.startsWith('/') && !weiter.startsWith('//') ? weiter : '/';
}

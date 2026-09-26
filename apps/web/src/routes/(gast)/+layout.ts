import { redirect } from '@sveltejs/kit';
import { sicheresZiel } from '$lib/navigation';
import type { LayoutLoad } from './$types';

// Angemeldete brauchen die Anmeldeseite nicht. Registrieren und Zurücksetzen
// melden selbst an und zeigen danach noch den Wiederherstellungscode.
export const load: LayoutLoad = async ({ parent, url }) => {
	const { user } = await parent();
	if (user && url.pathname === '/anmelden') redirect(307, sicheresZiel(url.searchParams.get('weiter')));
};

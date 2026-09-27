import type { DuellUebersicht, UebenUebersicht } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:duelle');
	depends('app:ueben');
	const [duelle, ueben] = await Promise.all([
		api(fetch).get<DuellUebersicht[]>('/duels'),
		// nur für die Karte „Fehler üben“ – darf die Übersicht nie blockieren
		api(fetch).get<UebenUebersicht>('/ueben').catch(() => null)
	]);
	return { duelle, ueben };
};

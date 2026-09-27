import type { AdminFragenListe } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, depends }) => {
	depends('app:admin');
	// Standard: Entwürfe – die warten auf Prüfung
	const status = url.searchParams.get('status') ?? 'entwurf';
	const query = new URLSearchParams();
	if (status !== 'alle') query.set('status', status);
	for (const name of ['kategorie', 'suche']) {
		const wert = url.searchParams.get(name);
		if (wert) query.set(name, wert);
	}
	return {
		status,
		kategorie: url.searchParams.get('kategorie') ?? '',
		suche: url.searchParams.get('suche') ?? '',
		liste: await api(fetch).get<AdminFragenListe>(`/admin/fragen${query.size ? `?${query}` : ''}`)
	};
};

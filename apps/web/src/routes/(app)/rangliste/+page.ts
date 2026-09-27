import { redirect } from '@sveltejs/kit';
import type { Rangliste } from '@halmduell/shared';
import { api, ApiError } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, depends }) => {
	depends('app:freunde');
	const query = new URLSearchParams();
	for (const name of ['kategorie', 'kreis', 'saison']) {
		const wert = url.searchParams.get(name);
		if (wert) query.set(name, wert);
	}
	const suffix = query.size ? `?${query}` : '';
	try {
		return { rangliste: await api(fetch).get<Rangliste>(`/rangliste${suffix}`) };
	} catch (e) {
		// Unbekannte Kategorie/Saison (z. B. alter Link) → einfach die aktuelle Rangliste
		if (e instanceof ApiError && e.status === 400 && suffix) redirect(307, '/rangliste');
		throw e;
	}
};

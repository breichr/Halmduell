import { redirect } from '@sveltejs/kit';
import { api } from '$lib/api';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, url, fetch, depends }) => {
	const { user } = await parent();
	if (!user) redirect(307, `/anmelden?weiter=${encodeURIComponent(url.pathname + url.search)}`);
	depends('app:freunde');
	// Nur für den Punkt an „Freunde“ in der Navigation – darf die Seite nie blockieren
	const offeneAnfragen = await api(fetch)
		.get<{ anzahl: number }>('/freunde/anfragen/anzahl')
		.then((r) => r.anzahl)
		.catch(() => 0);
	return { user, offeneAnfragen };
};

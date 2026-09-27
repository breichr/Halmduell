import type { AdminFrage, AdminMeldung } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, depends }) => {
	depends('app:admin-frage');
	const [frage, meldungen] = await Promise.all([
		api(fetch).get<AdminFrage>(`/admin/fragen/${params.id}`),
		api(fetch).get<AdminMeldung[]>(`/admin/fragen/${params.id}/meldungen`)
	]);
	return { frage, meldungen };
};

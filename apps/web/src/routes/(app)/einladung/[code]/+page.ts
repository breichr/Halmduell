import type { EinladungsVorschau } from '@halmduell/shared';
import { api, ApiError } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	try {
		return { einladung: await api(fetch).get<EinladungsVorschau>(`/duels/einladung/${params.code}`), fehler: null };
	} catch (e) {
		if (e instanceof ApiError && e.status < 500) return { einladung: null, fehler: e.message };
		throw e;
	}
};

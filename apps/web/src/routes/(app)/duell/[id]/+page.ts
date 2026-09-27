import { error } from '@sveltejs/kit';
import type { DuellDetails } from '@halmduell/shared';
import { api, ApiError } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params, depends }) => {
	depends('app:duell');
	try {
		return { duel: await api(fetch).get<DuellDetails>(`/duels/${params.id}`) };
	} catch (e) {
		if (e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 400)) error(404, 'Duell nicht gefunden');
		throw e;
	}
};

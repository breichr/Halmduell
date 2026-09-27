import type { AbzeichenListe, Statistik } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:duelle');
	const [statistik, abzeichen] = await Promise.all([
		api(fetch).get<Statistik>('/statistik'),
		api(fetch).get<AbzeichenListe>('/abzeichen')
	]);
	return { statistik, abzeichen };
};

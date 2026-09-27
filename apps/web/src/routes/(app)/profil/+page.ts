import type { Statistik } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:duelle');
	return { statistik: await api(fetch).get<Statistik>('/statistik') };
};

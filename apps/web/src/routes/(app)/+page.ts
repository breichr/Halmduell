import type { DuellUebersicht } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:duelle');
	return { duelle: await api(fetch).get<DuellUebersicht[]>('/duels') };
};

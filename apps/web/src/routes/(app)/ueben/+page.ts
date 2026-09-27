import type { UebenUebersicht } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:ueben');
	return { uebersicht: await api(fetch).get<UebenUebersicht>('/ueben') };
};

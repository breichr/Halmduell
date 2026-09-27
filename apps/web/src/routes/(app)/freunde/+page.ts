import type { Freundesliste } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:freunde');
	return { liste: await api(fetch).get<Freundesliste>('/freunde') };
};

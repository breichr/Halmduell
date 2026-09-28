import type { EigeneFrage } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends, url }) => {
	depends('app:eigene-fragen');
	return {
		fragen: await api(fetch).get<EigeneFrage[]>('/fragen/eigene'),
		geradeEingereicht: url.searchParams.has('eingereicht')
	};
};

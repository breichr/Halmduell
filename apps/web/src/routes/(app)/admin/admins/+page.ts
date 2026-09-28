import type { AdminEintrag } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, depends }) => {
	depends('app:admins');
	return { admins: await api(fetch).get<AdminEintrag[]>('/admin/admins') };
};

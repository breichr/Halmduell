import type { AngemeldeterUser } from '@halmduell/shared';
import { api, ApiError } from '$lib/api';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, depends }) => {
	depends('app:user');
	try {
		return { user: await api(fetch).get<AngemeldeterUser>('/auth/me') };
	} catch (e) {
		if (e instanceof ApiError && e.status === 401) return { user: null };
		throw e;
	}
};

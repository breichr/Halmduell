import type { AdminFrage } from '@halmduell/shared';
import { api } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => ({
	frage: await api(fetch).get<AdminFrage>(`/admin/fragen/${params.id}`)
});

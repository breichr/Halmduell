import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { user } = await parent();
	if (!user) redirect(307, `/anmelden?weiter=${encodeURIComponent(url.pathname + url.search)}`);
	return { user };
};

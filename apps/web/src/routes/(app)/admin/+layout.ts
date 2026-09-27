import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
	const { user } = await parent();
	// Die API prüft selbst; hier nur, damit Nicht-Admins eine klare Meldung sehen
	if (!user.istAdmin) error(403, 'Nur für Admins');
	return {};
};

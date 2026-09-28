import { expect, test, type Browser } from '@playwright/test';
import type { AntwortErgebnis, GestellteFrage } from '@halmduell/shared';

async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

test('Zufallsgegner: erst eröffnen und auf Gegner warten, dann tritt jemand bei', async ({ browser }) => {
	const nr = Date.now() % 100000;
	const anna = await spieler(browser, `zufall_a_${nr}`);
	const ben = await spieler(browser, `zufall_b_${nr}`);

	// Anna: „Zufälliger Gegner“ ist vorausgewählt
	await anna.seite.goto('/duell/neu');
	await anna.seite.getByRole('radio', { name: 'Pflanzenbau' }).check();
	await expect(anna.seite.getByRole('radio', { name: /Zufälliger Gegner/ })).toBeChecked();
	await anna.seite.getByRole('button', { name: 'Gegner suchen & losspielen' }).click();
	await expect(anna.seite).toHaveURL(/\/duell\/\d+$/);
	await expect(anna.seite.getByRole('heading', { name: 'Du bist dran!' })).toBeVisible();
	const duelId = Number(anna.seite.url().split('/').pop());

	// Runde über die API spielen
	for (let fertig = false; !fertig; ) {
		const frage = (await (await anna.context.request.get(`/api/duels/${duelId}/frage`)).json()) as GestellteFrage;
		const e = (await (await anna.context.request.post(`/api/duels/${duelId}/antwort`, { data: { frageId: frage.frageId, antwortId: frage.antworten[0]!.id } })).json()) as AntwortErgebnis;
		fertig = e.rundeFertig;
	}
	await anna.seite.reload();
	await expect(anna.seite.getByRole('heading', { name: 'Gegner wird gesucht' })).toBeVisible();
	await expect(anna.seite.getByRole('button', { name: 'Suche abbrechen' })).toBeVisible();
	await anna.seite.goto('/');
	await expect(anna.seite.getByTestId('duell-karte').filter({ hasText: 'Zufälliger Gegner' })).toContainText('Gegner wird gesucht');

	// Ben sucht ebenfalls in Pflanzenbau und landet in Annas Duell
	await ben.seite.goto('/duell/neu?kategorie=pflanzenbau');
	await ben.seite.getByRole('button', { name: 'Gegner suchen & losspielen' }).click();
	await expect(ben.seite).toHaveURL(new RegExp(`/duell/${duelId}$`));
	await expect(ben.seite.getByRole('heading', { name: 'Du bist dran!' })).toBeVisible();
	await expect(ben.seite.locator('.kopfzeile')).toContainText(`gegen ${anna.username}`);

	// Anna sieht Ben als Gegner
	await anna.seite.reload();
	await expect(anna.seite.getByTestId('duell-karte').filter({ hasText: ben.username })).toContainText(`Wartet auf ${ben.username}`);
});

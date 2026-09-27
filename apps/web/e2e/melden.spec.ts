import { expect, test, type Browser } from '@playwright/test';
import type { GestellteFrage, AntwortErgebnis, DuellUebersicht } from '@halmduell/shared';

async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

test('Frage nach dem Duell melden, Admin arbeitet die Meldung ab', async ({ browser }) => {
	const nr = Date.now() % 100000;
	// ADMIN_USERNAMES enthält „moderation“ (playwright.config.ts)
	const admin = await spieler(browser, 'moderation');
	const anna = await spieler(browser, `melderin_${nr}`);
	await spieler(browser, `gegner_${nr}`);

	// Anna spielt ihre Runde (immer die erste Antwort) über die API
	const duel = (await (await anna.context.request.post('/api/duels', { data: { kategorie: 'pflanzenbau', gegner: `gegner_${nr}` } })).json()) as DuellUebersicht;
	for (let fertig = false; !fertig; ) {
		const frage = (await (await anna.context.request.get(`/api/duels/${duel.id}/frage`)).json()) as GestellteFrage;
		const ergebnis = (await (await anna.context.request.post(`/api/duels/${duel.id}/antwort`, { data: { frageId: frage.frageId, antwortId: frage.antworten[0]!.id } })).json()) as AntwortErgebnis;
		fertig = ergebnis.rundeFertig;
	}

	// Erste Frage aufklappen und melden
	await anna.seite.goto(`/duell/${duel.id}`);
	const erste = anna.seite.locator('.fragen > li').first();
	const frageText = (await erste.locator('summary .text').textContent())!.trim();
	await erste.locator('summary').click();
	await erste.getByRole('button', { name: 'Frage melden' }).click();
	await erste.getByLabel('Die richtige Antwort stimmt nicht').check();
	await erste.getByLabel(/Anmerkung/).fill('Laut Pflanzenschutzdienst ist es anders.');
	await erste.getByRole('button', { name: 'Melden' }).click();
	await expect(erste.getByRole('status')).toHaveText(/Danke!/);

	// bleibt nach dem Neuladen sichtbar
	await anna.seite.reload();
	await anna.seite.locator('.fragen > li').first().locator('summary').click();
	await expect(anna.seite.getByText('Du hast diese Frage gemeldet.')).toBeVisible();

	// Admin: Filter „Gemeldet“ mit Zähler, Meldung ansehen und erledigen
	await admin.seite.goto('/admin');
	const gemeldet = admin.seite.getByRole('navigation', { name: 'Status' }).getByRole('link', { name: /Gemeldet/ });
	await expect(gemeldet).toContainText('1');
	await gemeldet.click();
	await expect(admin.seite).toHaveURL(/status=gemeldet/);
	await expect(admin.seite.getByTestId('admin-frage')).toHaveCount(1);
	await expect(admin.seite.getByTestId('admin-frage')).toContainText(frageText);
	await admin.seite.getByRole('link', { name: '⚑ 1 Meldung' }).click();
	const meldung = admin.seite.getByTestId('meldung');
	await expect(meldung).toContainText('Die richtige Antwort stimmt nicht');
	await expect(meldung).toContainText('Laut Pflanzenschutzdienst ist es anders.');
	await expect(meldung).toContainText(anna.username);
	await admin.seite.getByRole('button', { name: 'Erledigt' }).click();
	await expect(admin.seite.getByTestId('meldung')).toHaveCount(0);

	await admin.seite.goto('/admin?status=gemeldet');
	await expect(admin.seite.getByText('Keine Fragen für diesen Filter.')).toBeVisible();

	// Anna kann die Frage danach erneut melden
	await anna.seite.reload();
	await anna.seite.locator('.fragen > li').first().locator('summary').click();
	await expect(anna.seite.getByRole('button', { name: 'Frage melden' })).toBeVisible();
});

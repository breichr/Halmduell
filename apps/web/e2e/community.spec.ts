import { expect, test, type Browser } from '@playwright/test';

async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

test('Community-Frage: einreichen, im Portal mit Rückmeldung freigeben, Einreicher sieht „Im Spiel“', async ({ browser }) => {
	const nr = Date.now() % 100000;
	const frage = `Wie heißt das männliche Schaf? (${nr})`;
	const anna = await spieler(browser, `einreicherin_${nr}`);
	// ADMIN_USERNAMES enthält „pruefung“ (playwright.config.ts)
	const admin = await spieler(browser, 'pruefung');

	// Über das Profil zu „Meine Fragen“, leer → einreichen
	await anna.seite.goto('/profil');
	await anna.seite.getByRole('link', { name: /Eigene Fragen/ }).click();
	await expect(anna.seite.getByRole('heading', { name: 'Meine Fragen' })).toBeVisible();
	await anna.seite.getByRole('link', { name: /Frage einreichen/ }).click();

	await anna.seite.getByLabel('Kategorie').selectOption('viehzucht');
	await anna.seite.getByLabel('Frage', { exact: true }).fill(frage);
	await anna.seite.getByLabel('Richtige Antwort').fill('Bock');
	await anna.seite.getByLabel('Falsche Antwort 1').fill('Eber');
	await anna.seite.getByLabel('Falsche Antwort 2').fill('Hengst');
	await anna.seite.getByLabel('Falsche Antwort 3').fill('Bock');
	await expect(anna.seite.getByRole('region', { name: 'Vorschau' })).toContainText(frage);
	await anna.seite.getByRole('button', { name: 'Frage einreichen' }).click();
	await expect(anna.seite.getByText('Die 4 Antworten müssen verschieden sein')).toBeVisible();
	await anna.seite.getByLabel('Falsche Antwort 3').fill('Stier');
	await anna.seite.getByRole('button', { name: 'Frage einreichen' }).click();

	await expect(anna.seite).toHaveURL(/\/fragen\/eigene\?eingereicht=1$/);
	await expect(anna.seite.getByRole('status')).toContainText('Danke!');
	const eigene = anna.seite.getByTestId('eigene-frage');
	await expect(eigene).toHaveCount(1);
	await expect(eigene).toContainText('Wird geprüft');

	// Admin: Filter „Eingereicht“, Einreicherin sichtbar, mit Rückmeldung freigeben
	await admin.seite.goto('/admin');
	await admin.seite.getByRole('navigation', { name: 'Status' }).getByRole('link', { name: /Eingereicht/ }).click();
	const karte = admin.seite.getByTestId('admin-frage').filter({ hasText: frage });
	await expect(karte).toContainText(`von ${anna.username}`);
	await karte.getByLabel(/Rückmeldung an/).fill('Super Frage, danke!');
	await karte.getByRole('button', { name: 'Freigeben' }).click();
	await expect(admin.seite.getByTestId('admin-frage').filter({ hasText: frage })).toHaveCount(0);

	// Einreicherin sieht den neuen Status und die Rückmeldung
	await anna.seite.goto('/fragen/eigene');
	await expect(eigene).toContainText('Im Spiel');
	await expect(eigene).toContainText('Super Frage, danke!');
	await expect(eigene.getByRole('button', { name: 'Zurückziehen' })).toHaveCount(0);
});

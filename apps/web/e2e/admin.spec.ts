import { expect, test, type Browser } from '@playwright/test';

async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

test('Admin-Portal: Entwürfe prüfen, bearbeiten, freigeben, neue Frage, CSV', async ({ browser }) => {
	// ADMIN_USERNAMES=redaktion (playwright.config.ts)
	const admin = await spieler(browser, 'redaktion');
	const normal = await spieler(browser, `normal_${Date.now() % 100000}`);

	// Normale Spieler kommen nicht hinein und sehen keinen Link
	await normal.seite.goto('/profil');
	await expect(normal.seite.getByRole('link', { name: /Admin-Portal/ })).toHaveCount(0);
	await normal.seite.goto('/admin');
	await expect(normal.seite.getByText('Nur für Admins')).toBeVisible();
	expect((await normal.context.request.get('/api/admin/fragen')).status()).toBe(403);

	// Admin: über das Profil ins Portal, Standardfilter „Entwürfe“
	await admin.seite.goto('/profil');
	await admin.seite.getByRole('link', { name: /Admin-Portal/ }).click();
	await expect(admin.seite.getByRole('heading', { name: 'Admin-Portal', level: 1 })).toBeVisible();
	await expect(admin.seite.getByRole('navigation', { name: 'Status' }).getByRole('link', { name: 'Entwürfe' })).toHaveAttribute('aria-current', 'page');
	await expect(admin.seite.getByTestId('admin-frage').first()).toBeVisible();

	// Bildfragen zeigen ihr Bild samt Quelle direkt in der Liste
	await admin.seite.goto('/admin?suche=schaedlinge-027');
	const bildKarte = admin.seite.getByTestId('admin-frage');
	await expect(bildKarte.getByRole('img', { name: 'Bild zu schaedlinge-027' })).toHaveAttribute('src', /upload\.wikimedia\.org\/.+Meligethes_aeneus01/);
	await expect(bildKarte.locator('figcaption')).toContainText('Wikimedia Commons');
	await admin.seite.goto('/admin');

	// Suchen und freigeben → verschwindet aus den Entwürfen
	await admin.seite.getByRole('searchbox', { name: 'Suchen' }).fill('kulturen-003');
	await admin.seite.getByRole('button', { name: 'Suchen' }).click();
	await expect(admin.seite).toHaveURL(/suche=kulturen-003/);
	const karte = admin.seite.getByTestId('admin-frage');
	await expect(karte).toHaveCount(1);
	await expect(karte).toContainText('Braumalz');
	await karte.getByRole('button', { name: 'Freigeben' }).click();
	await expect(admin.seite.getByText('Keine Fragen für diesen Filter.')).toBeVisible();
	await admin.seite.getByRole('navigation', { name: 'Status' }).getByRole('link', { name: 'Freigegeben' }).click();
	await expect(admin.seite.getByTestId('admin-frage')).toContainText('Freigegeben');

	// Bearbeiten: Text ändern, doppelte Antwort wird abgelehnt
	await admin.seite.getByRole('link', { name: 'kulturen-003 bearbeiten' }).click();
	await expect(admin.seite.getByRole('heading', { name: 'kulturen-003' })).toBeVisible();
	const frageFeld = admin.seite.getByLabel('Frage', { exact: true });
	await frageFeld.fill('Welche Getreideart wird vor allem zu Braumalz verarbeitet?');
	await admin.seite.getByLabel('Falsche Antwort 1').fill('Gerste');
	await admin.seite.getByRole('button', { name: 'Speichern' }).click();
	await expect(admin.seite.getByText('Die 4 Antworten müssen verschieden sein')).toBeVisible();
	await admin.seite.getByLabel('Falsche Antwort 1').fill('Hafer');
	await admin.seite.getByRole('button', { name: 'Speichern' }).click();
	await expect(admin.seite).toHaveURL(/\/admin\?/);
	await expect(admin.seite.getByTestId('admin-frage')).toContainText('vor allem zu Braumalz');

	// Neue Frage anlegen
	await admin.seite.goto('/admin/fragen/neu');
	await admin.seite.getByLabel('Kategorie').selectOption('landtechnik');
	await admin.seite.getByLabel('Frage', { exact: true }).fill('Wie viele Quadratmeter hat ein Ar?');
	await admin.seite.getByLabel('Richtige Antwort').fill('100 m²');
	await admin.seite.getByLabel('Falsche Antwort 1').fill('10 m²');
	await admin.seite.getByLabel('Falsche Antwort 2').fill('1.000 m²');
	await admin.seite.getByLabel('Falsche Antwort 3').fill('10.000 m²');
	await expect(admin.seite.getByRole('region', { name: 'Vorschau' })).toContainText('Wie viele Quadratmeter hat ein Ar?');
	await admin.seite.getByRole('button', { name: 'Frage anlegen' }).click();
	await expect(admin.seite).toHaveURL(/status=entwurf&suche=landtechnik-026/);
	await expect(admin.seite.getByTestId('admin-frage')).toContainText('Wie viele Quadratmeter hat ein Ar?');

	// CSV-Export
	const csv = await admin.context.request.get('/api/admin/fragen.csv');
	expect(csv.status()).toBe(200);
	const text = await csv.text();
	expect(text).toContain('code;kategorie;typ;frage;richtig');
	expect(text).toContain('landtechnik-026;landtechnik;text;Wie viele Quadratmeter hat ein Ar?');

	// Admins verwalten: normalen Spieler ernennen, er sieht das Portal, dann wieder entfernen
	await admin.seite.goto('/admin');
	await admin.seite.getByRole('link', { name: 'Admins verwalten' }).click();
	await expect(admin.seite.getByTestId('admin-eintrag').filter({ hasText: 'redaktion' })).toContainText('fest über ADMIN_USERNAMES');
	await admin.seite.getByLabel(/Spieler zum Admin machen/).fill(normal.username);
	await admin.seite.getByRole('button', { name: 'Zum Admin machen' }).click();
	await expect(admin.seite.getByRole('status')).toHaveText(`${normal.username} ist jetzt Admin.`);
	await expect(admin.seite.getByTestId('admin-eintrag').filter({ hasText: normal.username })).toContainText('im Portal ernannt');

	await normal.seite.goto('/admin');
	await expect(normal.seite.getByRole('heading', { name: 'Admin-Portal', level: 1 })).toBeVisible();

	admin.seite.once('dialog', (d) => d.accept());
	await admin.seite.getByRole('button', { name: `${normal.username} die Admin-Rechte entziehen` }).click();
	await expect(admin.seite.getByRole('status')).toHaveText(`${normal.username} ist kein Admin mehr.`);
	await expect(admin.seite.getByTestId('admin-eintrag').filter({ hasText: normal.username })).toHaveCount(0);
	expect((await normal.context.request.get('/api/admin/fragen')).status()).toBe(403);
});

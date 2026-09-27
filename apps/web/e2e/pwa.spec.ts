import { expect, test } from '@playwright/test';

/** Breite/Höhe aus dem PNG-Header (IHDR) */
function pngGroesse(daten: Buffer) {
	return { breite: daten.readUInt32BE(16), hoehe: daten.readUInt32BE(20) };
}

test('Manifest ist vollständig und alle Icons existieren', async ({ request }) => {
	const res = await request.get('/manifest.webmanifest');
	expect(res.ok()).toBe(true);
	const manifest = await res.json();
	expect(manifest).toMatchObject({ short_name: 'Halmduell', lang: 'de', start_url: '/', display: 'standalone' });
	expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);

	for (const icon of manifest.icons as { src: string; sizes: string; type: string }[]) {
		const bild = await request.get(icon.src);
		expect(bild.ok(), icon.src).toBe(true);
		if (icon.type === 'image/png') {
			const [b, h] = icon.sizes.split('x').map(Number);
			expect(pngGroesse(await bild.body()), icon.src).toEqual({ breite: b, hoehe: h });
		}
	}
	expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
});

test('Service Worker: Offline-Seite statt Browserfehler, API nie aus dem Cache', async ({ page, context }) => {
	await page.goto('/anmelden');
	// „ready“ löst schon beim Aktivieren aus – auf den fertigen Zustand warten
	await expect
		.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
		.toBe('activated');
	// Seite muss vom Service Worker kontrolliert sein, bevor wir offline gehen
	await page.reload();
	expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

	// Netz komplett kappen – auch für die Anfragen des Service Workers
	await context.route('**/*', (route) => route.abort('internetdisconnected'));
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Keine Verbindung' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'Halmi schläft' })).toBeVisible();

	// App-Shell-Dateien kommen aus dem Cache, die API nicht
	const iconOffline = await page.evaluate(async () => (await fetch('/icons/icon-192.png')).ok);
	expect(iconOffline).toBe(true);
	const apiOffline = await page.evaluate(() => fetch('/api/health').then(() => 'antwort', () => 'fehler'));
	expect(apiOffline).toBe('fehler');

	await context.unrouteAll();
});

test('Installationshinweis erscheint bei Angebot des Browsers und lässt sich ausblenden', async ({ page }) => {
	const username = `install_${Date.now() % 100000}`;
	await page.goto('/registrieren');
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill('geheim123');
	await page.getByRole('button', { name: 'Konto erstellen' }).click();
	await page.getByLabel('Ich habe den Code gespeichert').check();
	await page.getByRole('button', { name: 'Weiter' }).click();
	await expect(page.getByRole('heading', { name: /Hallo/ })).toBeVisible();

	// ohne Angebot kein Hinweis (Headless-Chromium bietet von sich aus keine Installation an)
	await expect(page.getByRole('heading', { name: 'Halmduell als App' })).toHaveCount(0);

	// Angebot simulieren, wie es Chrome auf Android schickt
	const angebot = () =>
		page.evaluate(() => {
			const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
				prompt: async () => {},
				userChoice: Promise.resolve({ outcome: 'dismissed' })
			});
			dispatchEvent(e);
		});
	await angebot();
	await expect(page.getByRole('heading', { name: 'Halmduell als App' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Installieren' })).toBeVisible();

	await page.getByRole('button', { name: 'Hinweis ausblenden' }).click();
	await expect(page.getByRole('heading', { name: 'Halmduell als App' })).toHaveCount(0);

	// bleibt ausgeblendet, im Profil aber weiter verfügbar
	await page.reload();
	await angebot();
	await expect(page.getByRole('heading', { name: 'Halmduell als App' })).toHaveCount(0);
	await page.getByRole('link', { name: 'Profil', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Halmduell als App' })).toBeVisible();
});

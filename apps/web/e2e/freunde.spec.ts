import { expect, test, type Browser } from '@playwright/test';

/** Neuer Spieler in eigenem Browser-Kontext, angemeldet per API */
async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

test('Freund anfragen, annehmen, herausfordern und Freunde-Rangliste', async ({ browser }) => {
	const lauf = Date.now() % 100000;
	const fritz = await spieler(browser, `fritz_${lauf}`);
	const greta = await spieler(browser, `greta_${lauf}`);

	// Fritz fragt Greta über die Navigation an
	await fritz.seite.goto('/');
	await fritz.seite.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Freunde' }).click();
	await expect(fritz.seite.getByRole('heading', { name: 'Freunde', level: 1 })).toBeVisible();
	await expect(fritz.seite.getByText("Zu zweit macht's mehr Spaß!")).toBeVisible();
	await fritz.seite.getByLabel('Freund per Benutzername hinzufügen').fill('gibt_es_nicht');
	await fritz.seite.getByRole('button', { name: 'Anfragen' }).click();
	await expect(fritz.seite.getByText('Diesen Benutzernamen gibt es nicht')).toBeVisible();
	await fritz.seite.getByLabel('Freund per Benutzername hinzufügen').fill(greta.username);
	await fritz.seite.getByRole('button', { name: 'Anfragen' }).click();
	await expect(fritz.seite.getByRole('status')).toHaveText(`Anfrage an ${greta.username} verschickt.`);
	await expect(fritz.seite.getByRole('region', { name: 'Warten auf Antwort' })).toContainText(greta.username);

	// Greta sieht den Punkt in der Navigation und nimmt an
	await greta.seite.goto('/');
	const gretasNav = greta.seite.getByRole('navigation', { name: 'Hauptnavigation' });
	await expect(gretasNav.getByRole('link', { name: 'Freunde, 1 neue Anfrage' })).toBeVisible();
	await gretasNav.getByRole('link', { name: /^Freunde/ }).click();
	await greta.seite.getByRole('button', { name: `Anfrage von ${fritz.username} annehmen` }).click();
	const gretasFreunde = greta.seite.getByRole('region', { name: /Deine Freunde/ });
	await expect(gretasFreunde.getByRole('listitem')).toHaveCount(1);
	await expect(gretasFreunde).toContainText('Diese Saison noch nicht gespielt');
	await expect(gretasNav.getByRole('link', { name: 'Freunde', exact: true })).toBeVisible();

	// Herausfordern füllt den Gegner vor
	await gretasFreunde.getByRole('link', { name: 'Herausfordern' }).click();
	await expect(greta.seite.getByLabel('Benutzername des Gegners')).toHaveValue(fritz.username);
	await greta.seite.getByRole('button', { name: 'Herausfordern' }).click();
	await expect(greta.seite).toHaveURL(/\/duell\/\d+$/);

	// Fritz sieht das laufende Duell bei Greta
	await fritz.seite.reload();
	await expect(fritz.seite.getByRole('region', { name: /Deine Freunde/ }).getByRole('link', { name: 'Zum Duell' })).toBeVisible();

	// Rangliste unter Freunden: noch niemand hat ein Duell abgeschlossen
	await fritz.seite.getByRole('link', { name: 'Rangliste unter Freunden' }).click();
	await expect(fritz.seite).toHaveURL(/\/rangliste\?kreis=freunde$/);
	const kreis = fritz.seite.getByRole('navigation', { name: 'Wer steht in der Liste' });
	await expect(kreis.getByRole('link', { name: 'Freunde' })).toHaveAttribute('aria-current', 'page');
	await expect(fritz.seite.getByText('Noch niemand platziert.')).toBeVisible();
	await fritz.seite.getByRole('navigation', { name: 'Kategorie' }).getByRole('link', { name: 'Wissen' }).click();
	await expect(fritz.seite).toHaveURL(/\/rangliste\?kategorie=wissen&kreis=freunde$/);
	await kreis.getByRole('link', { name: 'Alle Spieler' }).click();
	await expect(fritz.seite).toHaveURL(/\/rangliste\?kategorie=wissen$/);

	// Freundschaft beenden
	await fritz.seite.goto('/freunde');
	fritz.seite.once('dialog', (d) => d.accept());
	await fritz.seite.getByRole('button', { name: `Freundschaft mit ${greta.username} beenden` }).click();
	await expect(fritz.seite.getByText("Zu zweit macht's mehr Spaß!")).toBeVisible();
	// Greta bleibt als zuletzt gespielte Gegnerin vorgeschlagen
	await expect(fritz.seite.getByRole('region', { name: 'Zuletzt gespielt gegen' })).toContainText(greta.username);
});

import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import type { DuellUebersicht, GestellteFrage } from '@halmduell/shared';

/** Neuer Spieler in eigenem Browser-Kontext, angemeldet per API */
async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

/** Spielt die eigene Runde über die API (immer die erste Antwort) */
async function rundeSpielen(request: APIRequestContext, duelId: number) {
	for (let n = 0; n < 6; n++) {
		const frage = (await (await request.get(`/api/duels/${duelId}/frage`)).json()) as GestellteFrage;
		const res = await request.post(`/api/duels/${duelId}/antwort`, { data: { frageId: frage.frageId, antwortId: frage.antworten[0]!.id } });
		expect(res.ok()).toBe(true);
	}
}

test('nach einem Duell stehen beide Spieler in der Rangliste', async ({ browser }) => {
	const lauf = Date.now() % 100000;
	const clara = await spieler(browser, `clara_${lauf}`);
	const dora = await spieler(browser, `dora_${lauf}`);
	const emil = await spieler(browser, `emil_${lauf}`);

	// Noch niemand hat gespielt
	await emil.seite.goto('/');
	await emil.seite.getByRole('link', { name: 'Rangliste' }).click();
	await expect(emil.seite.getByRole('heading', { name: 'Rangliste' })).toBeVisible();
	await expect(emil.seite.getByRole('link', { name: 'Rangliste' })).toHaveAttribute('aria-current', 'page');

	// Clara fordert Dora heraus, beide spielen ihre Runde → Duell wird gewertet
	const neu = await clara.context.request.post('/api/duels', { data: { kategorie: 'gemischt', gegner: dora.username } });
	expect(neu.status()).toBe(201);
	const duel = (await neu.json()) as DuellUebersicht;
	await rundeSpielen(clara.context.request, duel.id);
	await rundeSpielen(dora.context.request, duel.id);

	await clara.seite.goto('/rangliste');
	// Je nach vorherigen Tests auf dem Podest oder darunter
	const plaetze = clara.seite.getByRole('listitem');
	await expect(plaetze.filter({ has: clara.seite.getByText(/^Du( · \w+)?$/) })).toHaveCount(1);
	await expect(plaetze.filter({ hasText: dora.username })).toHaveCount(1);
	await expect(clara.seite.getByTestId('eigener-platz')).toContainText(/Platz \d von \d/);

	// Statistik im Profil: ein Duell, 6 beantwortete Fragen
	await clara.seite.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Profil' }).click();
	const bilanz = clara.seite.getByRole('region', { name: 'Bilanz' });
	await expect(bilanz.getByRole('listitem')).toHaveCount(1);
	await expect(clara.seite.getByRole('region', { name: 'Trefferquote' })).toContainText(/von 6 Fragen richtig/);
	await expect(clara.seite.getByRole('region', { name: /^Ratings / }).getByRole('link', { name: /Gesamt/ })).toHaveAttribute('href', '/rangliste');
	await clara.seite.goto('/rangliste');

	// Emil ist nicht platziert und wird zum Mitspielen eingeladen
	await emil.seite.reload();
	await expect(emil.seite.getByText('Du bist noch nicht platziert.')).toBeVisible();
	await expect(emil.seite.getByTestId('eigener-platz')).toHaveCount(0);

	// „Gemischt“ zählt nur für Gesamt – in Kulturen ist noch niemand
	await clara.seite.getByRole('navigation', { name: 'Kategorie' }).getByRole('link', { name: 'Kulturen' }).click();
	await expect(clara.seite).toHaveURL(/\/rangliste\?kategorie=kulturen$/);
	await expect(clara.seite.getByText('Noch niemand platziert.')).toBeVisible();

	// Kaputte Links führen zur aktuellen Rangliste
	await clara.seite.goto('/rangliste?kategorie=quatsch');
	await expect(clara.seite).toHaveURL(/\/rangliste$/);
	await expect(clara.seite.getByRole('list', { name: 'Die ersten drei' })).toBeVisible();
});

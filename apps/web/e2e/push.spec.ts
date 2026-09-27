import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import type { DuellUebersicht, GestellteFrage } from '@halmduell/shared';

async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

async function rundeSpielen(request: APIRequestContext, duelId: number) {
	for (let n = 0; n < 6; n++) {
		const frage = (await (await request.get(`/api/duels/${duelId}/frage`)).json()) as GestellteFrage;
		await request.post(`/api/duels/${duelId}/antwort`, { data: { frageId: frage.frageId, antwortId: frage.antworten[0]!.id } });
	}
}

test('Benachrichtigungen: Schalter im Profil, Hinweis auf der Übersicht, Anstupsen', async ({ browser }) => {
	const lauf = Date.now() % 100000;
	const hanna = await spieler(browser, `hanna_${lauf}`);
	const ida = await spieler(browser, `ida_${lauf}`);

	// Profil: Web Push ist eingerichtet, auf diesem Gerät noch aus
	await hanna.seite.goto('/profil');
	const schalter = hanna.seite.getByRole('switch', { name: 'Benachrichtigungen' });
	await expect(schalter).toHaveAttribute('aria-checked', 'false');

	// Übersicht: Hinweis lässt sich dauerhaft ausblenden
	await hanna.seite.goto('/');
	await expect(hanna.seite.getByRole('heading', { name: 'Nichts verpassen' })).toBeVisible();
	await hanna.seite.getByRole('button', { name: 'Hinweis zu Benachrichtigungen ausblenden' }).click();
	await expect(hanna.seite.getByRole('heading', { name: 'Nichts verpassen' })).toHaveCount(0);
	await hanna.seite.reload();
	await expect(hanna.seite.getByRole('heading', { name: /^Hallo/ })).toBeVisible();
	await expect(hanna.seite.getByRole('heading', { name: 'Nichts verpassen' })).toHaveCount(0);

	// Anstupsen: erst wenn Ida am Zug ist
	const neu = await hanna.context.request.post('/api/duels', { data: { kategorie: 'gemischt', gegner: ida.username } });
	const duel = (await neu.json()) as DuellUebersicht;
	await hanna.seite.goto(`/duell/${duel.id}`);
	await expect(hanna.seite.getByRole('button', { name: /anstupsen/ })).toHaveCount(0);

	await rundeSpielen(hanna.context.request, duel.id);
	await hanna.seite.reload();
	await hanna.seite.getByRole('button', { name: `${ida.username} anstupsen` }).click();
	await expect(hanna.seite.getByRole('status')).toHaveText(`${ida.username} hat keine Benachrichtigungen an – vielleicht kurz per Nachricht erinnern?`);
	await expect(hanna.seite.getByRole('button', { name: 'Angestupst' })).toBeDisabled();
	await hanna.seite.reload();
	await expect(hanna.seite.getByRole('button', { name: 'Angestupst' })).toBeDisabled();
	await expect(hanna.seite.getByText(/Wieder möglich in (11|12) Std\./)).toBeVisible();

	// Ida ist dran und kann Hanna nicht anstupsen
	await ida.seite.goto(`/duell/${duel.id}`);
	await expect(ida.seite.getByRole('heading', { name: 'Du bist dran!' })).toBeVisible();
	await expect(ida.seite.getByRole('button', { name: /anstupsen/ })).toHaveCount(0);
});

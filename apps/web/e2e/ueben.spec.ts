import { expect, test, type Browser } from '@playwright/test';
import type { DuellUebersicht, GestellteFrage } from '@halmduell/shared';

async function spieler(browser: Browser, username: string) {
	const context = await browser.newContext();
	const res = await context.request.post('/api/auth/register', { data: { username, password: 'geheim123' } });
	expect(res.status()).toBe(201);
	return { context, seite: await context.newPage(), username };
}

test('Fehler üben: aus dem Duell falsch beantwortete Fragen nachlernen', async ({ browser }) => {
	const lauf = Date.now() % 100000;
	const uwe = await spieler(browser, `uwe_${lauf}`);
	const vera = await spieler(browser, `vera_${lauf}`);

	// Noch nichts falsch → keine Karte, leere Übungsseite
	await uwe.seite.goto('/');
	await expect(uwe.seite.getByRole('heading', { name: /^Hallo/ })).toBeVisible();
	await expect(uwe.seite.getByRole('link', { name: /Fehler üben/ })).toHaveCount(0);
	await uwe.seite.goto('/ueben');
	await expect(uwe.seite.getByText('Keine offenen Fehler!')).toBeVisible();

	// Uwe lässt im Duell bei allen 6 Fragen die Zeit ablaufen (zählt als falsch)
	const neu = await uwe.context.request.post('/api/duels', { data: { kategorie: 'gemischt', gegner: vera.username } });
	const duel = (await neu.json()) as DuellUebersicht;
	for (let n = 0; n < 6; n++) {
		const frage = (await (await uwe.context.request.get(`/api/duels/${duel.id}/frage`)).json()) as GestellteFrage;
		await uwe.context.request.post(`/api/duels/${duel.id}/antwort`, { data: { frageId: frage.frageId, antwortId: null } });
	}

	await uwe.seite.goto('/');
	await uwe.seite.getByRole('link', { name: /Fehler üben\s*6 Fragen warten aufs Nachlernen/ }).click();
	await expect(uwe.seite).toHaveURL(/\/ueben$/);
	await uwe.seite.getByRole('link', { name: 'Alle üben (6)' }).click();
	await expect(uwe.seite).toHaveURL(/\/ueben\/spielen$/);
	await expect(uwe.seite.getByTestId('offen')).toHaveText('noch 6 offen');
	// Beim Üben keine Navigation (wie im Duell)
	await expect(uwe.seite.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);

	// Antworten per Taste 1 → Rückmeldung mit Lösung
	await expect(uwe.seite.getByTestId('antwort')).toHaveCount(4);
	await uwe.seite.keyboard.press('1');
	const feedback = uwe.seite.getByTestId('feedback');
	await expect(feedback).toBeVisible();
	await expect(feedback).toContainText(/Richtig!|Leider falsch/);
	await expect(feedback).toContainText(/Noch 1× richtig, dann ist sie gemeistert\.|Die Frage kommt später noch einmal\./);
	await expect(uwe.seite.locator('.antwort.richtig')).toHaveCount(1);

	// Weiter zur nächsten, andere Frage
	const ersteFrage = await uwe.seite.getByTestId('frage').textContent();
	await feedback.getByRole('button', { name: 'Nächste Frage' }).click();
	await expect(uwe.seite.getByTestId('feedback')).toHaveCount(0);
	await expect(uwe.seite.getByTestId('frage')).not.toHaveText(ersteFrage!);

	// Üben beenden → Übersicht
	await uwe.seite.getByRole('link', { name: 'Üben beenden' }).click();
	await expect(uwe.seite.getByRole('heading', { name: 'Fehler üben' })).toBeVisible();
	await expect(uwe.seite.getByRole('link', { name: 'Alle üben (6)' })).toBeVisible();
});

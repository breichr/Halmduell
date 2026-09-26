import { expect, test, type Page } from '@playwright/test';

const PASSWORT = 'geheim123';

async function registrieren(seite: Page, username: string) {
	await seite.getByLabel('Benutzername').fill(username);
	await seite.getByLabel('Passwort').fill(PASSWORT);
	await seite.getByRole('button', { name: 'Konto erstellen' }).click();
	await expect(seite.getByTestId('wiederherstellungscode')).toHaveText(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
	await seite.getByLabel('Ich habe den Code gespeichert').check();
	await seite.getByRole('button', { name: 'Weiter' }).click();
}

/** Beantwortet alle Fragen der Runde (jeweils die erste Antwortkachel) */
async function rundeSpielen(seite: Page) {
	for (let n = 1; n <= 6; n++) {
		await expect(seite.getByText(`Frage ${n}`, { exact: false }).first()).toBeVisible();
		await expect(seite.getByTestId('antwort')).toHaveCount(4);
		await seite.getByTestId('antwort').first().click();
		await expect(seite.getByTestId('feedback')).toBeVisible();
		await seite.getByRole('button', { name: n === 6 ? 'Zur Auswertung' : 'Nächste Frage' }).click();
	}
	await expect(seite).toHaveURL(/\/duell\/\d+$/);
}

test('zwei Spieler: Einladung per Link, beide spielen, Ergebnis', async ({ browser }) => {
	test.setTimeout(90_000);
	const lauf = Date.now() % 100000;
	const anna = await (await browser.newContext()).newPage();
	const ben = await (await browser.newContext()).newPage();

	// Anna registriert sich (ohne Anmeldung landet man auf /anmelden)
	await anna.goto('/');
	await expect(anna).toHaveURL(/\/anmelden/);
	await anna.getByRole('link', { name: 'Konto erstellen' }).click();
	await registrieren(anna, `anna_${lauf}`);
	await expect(anna.getByRole('heading', { name: `Hallo anna_${lauf}` })).toBeVisible();
	await expect(anna.getByText('Noch keine Duelle.')).toBeVisible();

	// Neues Duell mit Einladungslink
	await anna.getByRole('link', { name: /Neues Duell/ }).click();
	await anna.getByRole('radio', { name: 'Gemischt' }).check();
	await anna.getByRole('button', { name: 'Duell starten' }).click();
	const link = await anna.getByTestId('einladungslink').textContent();
	expect(link).toMatch(/\/einladung\/[A-Z2-9]{8}$/);

	// Ben öffnet den Link, muss sich erst registrieren und landet danach wieder auf der Einladung
	await ben.goto(link!);
	await expect(ben).toHaveURL(/\/anmelden\?weiter=%2Feinladung%2F/);
	await ben.getByRole('link', { name: 'Konto erstellen' }).click();
	await registrieren(ben, `ben_${lauf}`);
	await expect(ben.getByRole('heading', { name: `anna_${lauf} fordert dich heraus!` })).toBeVisible();
	await ben.getByRole('button', { name: 'Herausforderung annehmen' }).click();
	await expect(ben).toHaveURL(/\/duell\/\d+$/);
	await expect(ben.getByText(`anna_${lauf} ist dran`)).toBeVisible();
	await expect(ben.getByRole('link', { name: 'Runde spielen' })).toHaveCount(0);

	// Anna spielt ihre Runde
	await anna.reload();
	await expect(anna.getByTestId('einladungslink')).toHaveCount(0);
	await anna.getByRole('link', { name: 'Runde spielen' }).click();
	await rundeSpielen(anna);
	await expect(anna.getByText(`ben_${lauf} ist dran`)).toBeVisible();

	// Ben spielt – danach ist das Duell gewertet
	await ben.reload();
	await ben.getByRole('link', { name: 'Runde spielen' }).click();
	await rundeSpielen(ben);
	await expect(ben.getByTestId('ergebnis')).toBeVisible();
	await expect(ben.getByTestId('ergebnis')).toContainText(/Gewonnen|Verloren|Unentschieden/);
	await expect(ben.getByTestId('ergebnis')).toContainText('Rating');

	// Alle Fragen sind aufklappbar und zeigen die Lösung
	await ben.locator('details summary').first().click();
	await expect(ben.getByText('Richtig:').first()).toBeVisible();

	// Annas Übersicht zeigt das Duell unter "Beendet", mit Revanche-Möglichkeit
	await anna.goto('/');
	await expect(anna.getByRole('heading', { name: /Beendet/ })).toBeVisible();
	await anna.getByTestId('duell-karte').first().click();
	await expect(anna.getByRole('link', { name: 'Revanche' })).toBeVisible();
});

test('Anmelden, Timer läuft ab, Aufgeben', async ({ page, browser }) => {
	const lauf = Date.now() % 100000;
	// Gegner anlegen
	const gegner = await (await browser.newContext()).newPage();
	await gegner.goto('/registrieren');
	await registrieren(gegner, `gegner_${lauf}`);

	await page.goto('/registrieren');
	await registrieren(page, `timer_${lauf}`);
	// ab- und wieder anmelden
	await page.getByRole('link', { name: /Profil von/ }).click();
	await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
	await expect(page).toHaveURL(/\/anmelden/);
	await page.getByLabel('Benutzername').fill(`timer_${lauf}`);
	await page.getByLabel('Passwort').fill('falsch123');
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page.getByRole('alert')).toContainText('Benutzername oder Passwort falsch');
	await page.getByLabel('Passwort').fill(PASSWORT);
	await page.getByRole('button', { name: 'Anmelden' }).click();
	await expect(page.getByRole('heading', { name: `Hallo timer_${lauf}` })).toBeVisible();

	// Duell per Benutzername, erste Frage verstreichen lassen (Uhr vorspulen)
	await page.clock.install();
	await page.goto('/duell/neu');
	await page.getByRole('radio', { name: /^Benutzername/ }).check();
	await page.getByLabel('Benutzername des Gegners').fill(`gegner_${lauf}`);
	await page.getByRole('button', { name: 'Duell starten' }).click();
	await page.getByRole('link', { name: 'Runde spielen' }).click();
	await expect(page.getByRole('timer')).toBeVisible();
	await page.clock.runFor(16_000);
	await expect(page.getByTestId('feedback')).toContainText('Zeit abgelaufen');

	// Aufgeben
	await page.goto(page.url().replace(/\/spielen$/, ''));
	await page.getByRole('button', { name: 'Aufgeben' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Aufgeben' }).click();
	await expect(page.getByTestId('ergebnis')).toContainText('Aufgegeben');
});

test('Absenden vor dem Laden der Skripte geht nicht verloren', async ({ page }) => {
	// Langsame Verbindung: Seite ist sichtbar, die App-Skripte kommen erst nach 1,5 s.
	// Ohne Sperre schickte der Browser das Formular selbst ab – Eingaben weg, nichts passiert.
	await page.route('**/_app/immutable/**/*.js', async (route) => {
		await new Promise((r) => setTimeout(r, 1500));
		await route.continue();
	});
	const username = `langsam_${Date.now() % 100000}`;
	await page.goto('/registrieren', { waitUntil: 'commit' });
	await page.getByLabel('Benutzername').fill(username);
	await page.getByLabel('Passwort').fill(PASSWORT);
	await page.getByRole('button', { name: 'Konto erstellen' }).click();
	await expect(page.getByTestId('wiederherstellungscode')).toBeVisible();
	expect(page.url()).not.toContain(PASSWORT);
	expect(page.url()).not.toContain('password');
});

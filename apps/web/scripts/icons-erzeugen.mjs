// Rendert die App-Icons aus static/icons/*.svg zu PNGs (einmalig nach Änderungen am Icon):
//   node scripts/icons-erzeugen.mjs
// Nutzt das Chromium von Playwright; die PNGs werden eingecheckt.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const ziele = [
	{ quelle: 'icon.svg', datei: 'icon-192.png', groesse: 192, hintergrund: 'transparent' },
	{ quelle: 'icon.svg', datei: 'icon-512.png', groesse: 512, hintergrund: 'transparent' },
	{ quelle: 'icon-maskable.svg', datei: 'icon-maskable-512.png', groesse: 512, hintergrund: '#CFE9FF' },
	// iOS rundet selbst ab und mag keine Transparenz
	{ quelle: 'icon-maskable.svg', datei: 'apple-touch-icon.png', groesse: 180, hintergrund: '#CFE9FF' },
	// Symbol in der Android-Statusleiste bei Benachrichtigungen (einfarbig)
	{ quelle: 'badge.svg', datei: 'badge-96.png', groesse: 96, hintergrund: 'transparent' }
];

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const seite = await browser.newPage();
for (const z of ziele) {
	const svg = await readFile(new URL(`../static/icons/${z.quelle}`, import.meta.url), 'utf8');
	await seite.setViewportSize({ width: z.groesse, height: z.groesse });
	await seite.setContent(
		`<html><body style="margin:0;background:${z.hintergrund}">${svg.replace('width="512" height="512"', `width="${z.groesse}" height="${z.groesse}"`)}</body></html>`
	);
	await seite.screenshot({
		path: new URL(`../static/icons/${z.datei}`, import.meta.url).pathname,
		omitBackground: z.hintergrund === 'transparent'
	});
	console.log(`${z.datei} (${z.groesse}×${z.groesse})`);
}
await browser.close();

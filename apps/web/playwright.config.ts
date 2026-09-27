import { defineConfig, devices } from '@playwright/test';

// End-to-End-Tests gegen echte API + Postgres (TEST_DATABASE_URL, wird geleert).
//   TEST_DATABASE_URL=… bun run test:e2e
// Netzwerk-Anfragen des Service Workers über context.route() abfangbar machen
// (context.setOffline() wirkt in Chromium nicht auf den Service Worker)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

const API_PORT = 3100;
const WEB_PORT = 4173;
const testDb = process.env.TEST_DATABASE_URL;

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/vorbereiten.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${WEB_PORT}`,
		locale: 'de-DE',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'mobil',
			use: {
				...devices['Pixel 7'],
				// im Sandbox-/CI-Container vorinstalliertes Chromium verwenden, falls gesetzt
				launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}
			}
		}
	],
	webServer: [
		{
			command: 'bun src/index.ts',
			cwd: '../api',
			port: API_PORT,
			reuseExistingServer: false,
			env: {
				PORT: String(API_PORT),
				DATABASE_URL: testDb ?? '',
				JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234',
				TRUST_PROXY: 'true',
				NODE_ENV: 'test'
			}
		},
		{
			command: 'bun run build && bun build/index.js',
			port: WEB_PORT,
			reuseExistingServer: false,
			timeout: 120_000,
			env: { PORT: String(WEB_PORT), API_URL: `http://localhost:${API_PORT}`, ORIGIN: `http://localhost:${WEB_PORT}` }
		}
	]
});

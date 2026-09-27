import { execFileSync } from 'node:child_process';

export default function vorbereiten() {
	if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL fehlt (Test-Datenbank, wird geleert)');
	execFileSync('bun', ['test/e2e-vorbereiten.ts'], { cwd: '../api', stdio: 'inherit', env: process.env });
}

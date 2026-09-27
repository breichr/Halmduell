// Bereitet die Test-Datenbank für die Playwright-Tests (apps/web/e2e) vor:
// Migrationen, alles leeren, Fragenkatalog importieren. Nur gegen TEST_DATABASE_URL.
import { sql } from 'drizzle-orm';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('test')) {
  throw new Error('TEST_DATABASE_URL muss auf eine Test-Datenbank zeigen (Name mit "test")');
}
process.env.DATABASE_URL = url;

const { migrate } = await import('drizzle-orm/postgres-js/migrator');
const { db, sqlClient } = await import('../src/db/client');
const { leseFragenCsv } = await import('../src/fragen/csv');
const { importiereFragen, STANDARD_DATEI } = await import('../src/fragen/import');

await migrate(db, { migrationsFolder: new URL('../src/db/migrations', import.meta.url).pathname });
await db.execute(sql`truncate users, questions, answer_options, duels, duel_questions, duel_answers,
  ratings, friendships, achievements, user_achievements, push_subscriptions, uebungen, platz_verlauf restart identity`);
const { fragen, fehler } = leseFragenCsv(new Uint8Array(await Bun.file(STANDARD_DATEI).arrayBuffer()));
if (fehler.length) throw new Error(fehler.join('\n'));
await db.transaction((tx) => importiereFragen(tx, fragen));
console.log(`E2E-Datenbank bereit (${fragen.length} Fragen)`);
await sqlClient.end();

// Läuft vor allen Tests. Integrationstests brauchen TEST_DATABASE_URL und werden
// sonst übersprungen; die Test-Datenbank wird dabei geleert.
const testUrl = process.env.TEST_DATABASE_URL;

process.env.JWT_SECRET ??= 'test-secret-mindestens-32-zeichen-lang!!';

if (testUrl) {
  if (!new URL(testUrl).pathname.includes('test')) {
    throw new Error(`TEST_DATABASE_URL muss auf eine Test-Datenbank zeigen (Name mit "test"): ${testUrl}`);
  }
  // Bun lädt .env auch bei `bun test` – die Test-DB muss Vorrang haben
  process.env.DATABASE_URL = testUrl;
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { db } = await import('../src/db/client');
  await migrate(db, { migrationsFolder: new URL('../src/db/migrations', import.meta.url).pathname });
}

export {};

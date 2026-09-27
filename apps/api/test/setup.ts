// Läuft vor allen Tests. Integrationstests brauchen TEST_DATABASE_URL und werden
// sonst übersprungen; die Test-Datenbank wird dabei geleert.
const testUrl = process.env.TEST_DATABASE_URL;

process.env.JWT_SECRET ??= 'test-secret-mindestens-32-zeichen-lang!!';
// Tests setzen die Client-IP per X-Forwarded-For (siehe helpers.ts)
process.env.TRUST_PROXY = 'true';

// Web Push eingerichtet (Schlüssel frisch erzeugt), verschickt wird in Tests aber
// nur über einen Test-Sender (siehe push.test.ts)
if (!process.env.VAPID_PUBLIC_KEY) {
  const { default: webpush } = await import('web-push');
  const schluessel = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = schluessel.publicKey;
  process.env.VAPID_PRIVATE_KEY = schluessel.privateKey;
}

if (testUrl) {
  if (!new URL(testUrl).pathname.includes('test')) {
    throw new Error(`TEST_DATABASE_URL muss auf eine Test-Datenbank zeigen (Name mit "test"): ${testUrl}`);
  }
  // Bun lädt .env auch bei `bun test` – die Test-DB muss Vorrang haben
  process.env.DATABASE_URL = testUrl;
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { db } = await import('../src/db/client');
  await migrate(db, { migrationsFolder: new URL('../src/db/migrations', import.meta.url).pathname });
  (await import('../src/services/push')).setzePushSender(null);
}

export {};

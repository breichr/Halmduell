// Stammdaten (Abzeichen). Idempotent: kann beliebig oft ausgeführt werden.
// Der Katalog steht in packages/shared/src/abzeichen.ts; fehlende Zeilen legt die
// API beim Vergeben ohnehin selbst an – der Seed bringt Titel/Texte auf Stand.
// Fragen kommen aus fragen/fragen.csv (bun run fragen:import).
import { sql } from 'drizzle-orm';
import { ABZEICHEN } from '@halmduell/shared';
import { db, sqlClient } from './client';
import { achievements } from './schema';

await db.insert(achievements)
  .values(ABZEICHEN.map(({ key, titel, beschreibung, icon }) => ({ key, titel, beschreibung, icon })))
  .onConflictDoUpdate({
    target: achievements.key,
    set: { titel: sql`excluded.titel`, beschreibung: sql`excluded.beschreibung`, icon: sql`excluded.icon` },
  });
console.log(`Seed: ${ABZEICHEN.length} Abzeichen`);
await sqlClient.end();

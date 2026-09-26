// Stammdaten (Abzeichen). Idempotent: kann beliebig oft ausgeführt werden.
// Fragen kommen aus fragen/fragen.csv (bun run fragen:import).
import { db, sqlClient } from './client';
import { achievements } from './schema';

const abzeichen = [
  { key: 'schaedling_experte', titel: 'Schädlings-Experte', beschreibung: '50 Schädlingsfragen richtig beantwortet', icon: 'kaefer' },
  { key: 'zehn_duelle', titel: 'Warmgelaufen', beschreibung: '10 Duelle gespielt', icon: 'halm' },
  { key: 'saison_top10', titel: 'Saison-Top-10', beschreibung: 'Eine Saison unter den besten 10 abgeschlossen', icon: 'pokal' },
];

await db.insert(achievements).values(abzeichen).onConflictDoNothing({ target: achievements.key });
console.log(`Seed: ${abzeichen.length} Abzeichen`);
await sqlClient.end();

// Wendet alle Migrationen aus src/db/migrations an (lokal via `bun run db:migrate`,
// in Produktion automatisch beim Container-Start).
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sqlClient } from './client';

await migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname });
console.log('Migrationen angewendet');
await sqlClient.end();

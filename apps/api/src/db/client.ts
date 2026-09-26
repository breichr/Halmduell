import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ist nicht gesetzt');

// NOTICEs (z. B. "schema already exists" bei jeder Migration) sind für die App bedeutungslos
export const sqlClient = postgres(url, { onnotice: () => {} });
export const db = drizzle(sqlClient, { schema });

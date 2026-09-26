import { sql } from 'drizzle-orm';

export const mitDatenbank = !!process.env.TEST_DATABASE_URL;

// Erst nach dem Setup importieren, damit DATABASE_URL auf die Test-DB zeigt
const lade = async () => ({
  ...(await import('../src/app')),
  ...(await import('../src/db/client')),
});

export async function leereDatenbank(): Promise<void> {
  const { db } = await lade();
  await db.execute(sql`truncate users, questions, answer_options, duels, duel_questions, duel_answers,
    ratings, friendships, achievements, user_achievements restart identity`);
}

interface Optionen {
  method?: string;
  body?: unknown;
  cookie?: string;
}

export async function anfrage(pfad: string, { method = 'GET', body, cookie }: Optionen = {}) {
  const { app } = await lade();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await app.request(`/api${pfad}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  return {
    status: res.status,
    json: res.status === 204 ? null : await res.json(),
    setCookie,
    /** "name=wert" für den nächsten Request */
    cookie: setCookie.split(';')[0] ?? '',
  };
}

let zaehler = 0;
/** Registriert einen neuen User mit eindeutigem Namen und liefert Session-Cookie + ID */
export async function neuerUser(prefix = 'user') {
  const username = `${prefix}_${++zaehler}_${Date.now() % 100000}`;
  const res = await anfrage('/auth/register', { method: 'POST', body: { username, password: 'geheim123' } });
  if (res.status !== 201) throw new Error(`Registrierung fehlgeschlagen: ${JSON.stringify(res.json)}`);
  return { id: res.json.id as number, username, cookie: res.cookie };
}

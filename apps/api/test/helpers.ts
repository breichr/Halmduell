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
  /** Client-IP; ohne Angabe eine zufällige, damit sich Tests nicht gegenseitig ins Rate-Limit bringen */
  ip?: string;
}

export const zufallsIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

export async function anfrage(pfad: string, { method = 'GET', body, cookie, ip = zufallsIp() }: Optionen = {}) {
  const { app } = await lade();
  const headers: Record<string, string> = { 'x-forwarded-for': ip };
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
  return { id: res.json.id as number, username, cookie: res.cookie, code: res.json.wiederherstellungsCode as string };
}

/** Legt freigegebene Textfragen mit je 4 Antworten an (die erste ist richtig) */
export async function erstelleFragen(anzahl: number, kategorie = 'wissen'): Promise<void> {
  const { db } = await lade();
  for (let i = 0; i < anzahl; i++) {
    const [frage] = await db.execute<{ id: number }>(sql`
      insert into questions (kategorie, typ, frage_text, erklaerung)
      values (${kategorie}, 'text', ${`${kategorie} Frage ${i}`}, 'Weil es so ist.') returning id`);
    await db.execute(sql`insert into answer_options (question_id, text, ist_richtig) values
      (${frage!.id}, 'richtig', true), (${frage!.id}, 'falsch 1', false),
      (${frage!.id}, 'falsch 2', false), (${frage!.id}, 'falsch 3', false)`);
  }
}

export async function antwortIds(frageId: number): Promise<{ richtig: number; falsch: number }> {
  const { db } = await lade();
  const zeilen = await db.execute<{ id: number; ist_richtig: boolean }>(
    sql`select id, ist_richtig from answer_options where question_id = ${frageId} order by id`);
  return { richtig: zeilen.find((z) => z.ist_richtig)!.id, falsch: zeilen.find((z) => !z.ist_richtig)!.id };
}

export async function sqlAusfuehren(abfrage: ReturnType<typeof sql>) {
  const { db } = await lade();
  return db.execute(abfrage);
}

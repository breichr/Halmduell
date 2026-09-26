import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { feldFehler, zugangsdatenSchema, type AngemeldeterUser, type ApiFehler } from '@halmduell/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { hashPasswort, loescheSession, pruefeDummyPasswort, pruefePasswort, setzeSession } from '../services/auth';
import { erstelleLimiter } from '../services/rate-limit';

// 10 Fehlversuche pro Benutzername in 15 Minuten
const loginLimiter = erstelleLimiter(10, 15 * 60 * 1000);

async function leseZugangsdaten(req: Request) {
  const body = await req.json().catch(() => null);
  return zugangsdatenSchema.safeParse(body);
}

const findeUserNachName = (username: string) =>
  db.query.users.findFirst({ where: eq(sql`lower(${users.username})`, username.toLowerCase()) });

export const authRoute = new Hono();

authRoute.post('/register', async (c) => {
  const eingabe = await leseZugangsdaten(c.req.raw);
  if (!eingabe.success) {
    return c.json({ error: 'Ungültige Eingabe', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  }
  const { username, password } = eingabe.data;

  const [user] = await db.insert(users)
    .values({ username, passwortHash: await hashPasswort(password) })
    .onConflictDoNothing()
    .returning({ id: users.id, username: users.username });
  if (!user) return c.json({ error: 'Benutzername ist bereits vergeben' } satisfies ApiFehler, 409);

  await setzeSession(c, user.id);
  return c.json(user satisfies AngemeldeterUser, 201);
});

authRoute.post('/login', async (c) => {
  const eingabe = await leseZugangsdaten(c.req.raw);
  if (!eingabe.success) return c.json({ error: 'Benutzername oder Passwort falsch' } satisfies ApiFehler, 401);
  const { username, password } = eingabe.data;

  const limitSchluessel = username.toLowerCase();
  if (!loginLimiter.versuch(limitSchluessel)) {
    return c.json({ error: 'Zu viele Anmeldeversuche, bitte später erneut versuchen' } satisfies ApiFehler, 429);
  }

  const user = await findeUserNachName(username);
  const ok = user ? await pruefePasswort(password, user.passwortHash) : await pruefeDummyPasswort(password);
  if (!user || !ok) return c.json({ error: 'Benutzername oder Passwort falsch' } satisfies ApiFehler, 401);

  loginLimiter.zuruecksetzen(limitSchluessel);
  await setzeSession(c, user.id);
  return c.json({ id: user.id, username: user.username } satisfies AngemeldeterUser);
});

authRoute.post('/logout', (c) => {
  loescheSession(c);
  return c.body(null, 204);
});

authRoute.get('/me', requireAuth, async (c) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, c.var.userId),
    columns: { id: true, username: true },
  });
  if (!user) {
    loescheSession(c);
    return c.json({ error: 'Nicht angemeldet' } satisfies ApiFehler, 401);
  }
  return c.json(user satisfies AngemeldeterUser);
});

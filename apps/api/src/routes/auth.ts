import { Hono, type Context } from 'hono';
import { eq, sql } from 'drizzle-orm';
import {
  feldFehler,
  neuerWiederherstellungscodeSchema,
  passwortAendernSchema,
  zugangsdatenSchema,
  zuruecksetzenSchema,
  type AngemeldeterUser,
  type ApiFehler,
  type UserMitWiederherstellungscode,
} from '@halmduell/shared';
import type { z } from 'zod';
import { db } from '../db/client';
import { users } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import {
  hashPasswort,
  loescheSession,
  neuerWiederherstellungsCode,
  pruefeDummyPasswort,
  pruefePasswort,
  setzeSession,
} from '../services/auth';
import { clientIp } from '../services/client-ip';
import { erstelleLimiter } from '../services/rate-limit';

const FENSTER_15_MIN = 15 * 60 * 1000;
// Fehlversuche je IP + Konto: fremde IPs können so niemanden aussperren
const fehlversuche = erstelleLimiter(10, FENSTER_15_MIN);
// Fehlversuche je IP über alle Konten: bremst das Durchprobieren vieler Namen
const ipFehlversuche = erstelleLimiter(50, FENSTER_15_MIN);
// Neue Konten je IP (großzügig, damit z. B. eine Schulklasse hinter einem NAT funktioniert)
const registrierungen = erstelleLimiter(30, 60 * 60 * 1000);

const ZU_VIELE = { error: 'Zu viele Versuche, bitte später erneut versuchen' } satisfies ApiFehler;

/** Prüft Sperre, führt `pruefung` aus und zählt Fehlschläge; null = gesperrt */
async function mitLimit(c: Context, konto: string, pruefung: () => Promise<boolean>): Promise<boolean | null> {
  const ip = clientIp(c);
  const schluessel = `${ip}|${konto.toLowerCase()}`;
  if (fehlversuche.gesperrt(schluessel) || ipFehlversuche.gesperrt(ip)) return null;
  const ok = await pruefung();
  if (ok) {
    fehlversuche.zuruecksetzen(schluessel);
  } else {
    fehlversuche.fehlschlag(schluessel);
    ipFehlversuche.fehlschlag(ip);
  }
  return ok;
}

async function parse<T extends z.ZodType>(schema: T, req: Request) {
  return schema.safeParse(await req.json().catch(() => null));
}

const ungueltig = (fehler: z.ZodError): ApiFehler => ({ error: 'Ungültige Eingabe', felder: feldFehler(fehler) });

const findeUserNachName = (username: string) =>
  db.query.users.findFirst({ where: eq(sql`lower(${users.username})`, username.toLowerCase()) });

export const authRoute = new Hono<AuthEnv>();

authRoute.post('/register', async (c) => {
  const eingabe = await parse(zugangsdatenSchema, c.req.raw);
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  if (!registrierungen.versuch(clientIp(c))) return c.json(ZU_VIELE, 429);
  const { username, password } = eingabe.data;

  const wiederherstellung = await neuerWiederherstellungsCode();
  const [user] = await db.insert(users)
    .values({ username, passwortHash: await hashPasswort(password), wiederherstellungsHash: wiederherstellung.hash })
    .onConflictDoNothing()
    .returning({ id: users.id, username: users.username, sessionVersion: users.sessionVersion });
  if (!user) return c.json({ error: 'Benutzername ist bereits vergeben' } satisfies ApiFehler, 409);

  await setzeSession(c, user.id, user.sessionVersion);
  return c.json({ id: user.id, username: user.username, wiederherstellungsCode: wiederherstellung.code } satisfies UserMitWiederherstellungscode, 201);
});

authRoute.post('/login', async (c) => {
  const eingabe = await parse(zugangsdatenSchema, c.req.raw);
  if (!eingabe.success) return c.json({ error: 'Benutzername oder Passwort falsch' } satisfies ApiFehler, 401);
  const { username, password } = eingabe.data;

  const user = await findeUserNachName(username);
  const ok = await mitLimit(c, username, () =>
    user ? pruefePasswort(password, user.passwortHash) : pruefeDummyPasswort(password));
  if (ok === null) return c.json(ZU_VIELE, 429);
  if (!user || !ok) return c.json({ error: 'Benutzername oder Passwort falsch' } satisfies ApiFehler, 401);

  await setzeSession(c, user.id, user.sessionVersion);
  return c.json({ id: user.id, username: user.username } satisfies AngemeldeterUser);
});

// Passwort vergessen: mit Wiederherstellungscode ein neues Passwort setzen
authRoute.post('/zuruecksetzen', async (c) => {
  const eingabe = await parse(zuruecksetzenSchema, c.req.raw);
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const { username, code, neuesPasswort } = eingabe.data;

  const user = await findeUserNachName(username);
  const ok = await mitLimit(c, username, () =>
    user?.wiederherstellungsHash ? pruefePasswort(code, user.wiederherstellungsHash) : pruefeDummyPasswort(code));
  if (ok === null) return c.json(ZU_VIELE, 429);
  if (!user || !ok) return c.json({ error: 'Benutzername oder Wiederherstellungscode falsch' } satisfies ApiFehler, 401);

  // Code ist verbraucht → neuen ausgeben; alle bestehenden Sessions werden ungültig
  const wiederherstellung = await neuerWiederherstellungsCode();
  const [aktualisiert] = await db.update(users).set({
    passwortHash: await hashPasswort(neuesPasswort),
    wiederherstellungsHash: wiederherstellung.hash,
    sessionVersion: sql`${users.sessionVersion} + 1`,
  }).where(eq(users.id, user.id)).returning({ sessionVersion: users.sessionVersion });

  await setzeSession(c, user.id, aktualisiert!.sessionVersion);
  return c.json({ id: user.id, username: user.username, wiederherstellungsCode: wiederherstellung.code } satisfies UserMitWiederherstellungscode);
});

authRoute.post('/logout', (c) => {
  loescheSession(c);
  return c.body(null, 204);
});

// Auf allen Geräten abmelden
authRoute.post('/logout-alle', requireAuth, async (c) => {
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, c.var.userId));
  loescheSession(c);
  return c.body(null, 204);
});

authRoute.get('/me', requireAuth, async (c) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, c.var.userId),
    columns: { id: true, username: true },
  });
  return c.json(user! satisfies AngemeldeterUser);
});

// Passwort ändern; andere Geräte werden abgemeldet, dieses bekommt eine neue Session
authRoute.post('/passwort', requireAuth, async (c) => {
  const eingabe = await parse(passwortAendernSchema, c.req.raw);
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const user = (await db.query.users.findFirst({ where: eq(users.id, c.var.userId) }))!;

  const ok = await mitLimit(c, user.username, () => pruefePasswort(eingabe.data.altesPasswort, user.passwortHash));
  if (ok === null) return c.json(ZU_VIELE, 429);
  if (!ok) return c.json({ error: 'Aktuelles Passwort ist falsch' } satisfies ApiFehler, 401);

  const [aktualisiert] = await db.update(users).set({
    passwortHash: await hashPasswort(eingabe.data.neuesPasswort),
    sessionVersion: sql`${users.sessionVersion} + 1`,
  }).where(eq(users.id, user.id)).returning({ sessionVersion: users.sessionVersion });
  await setzeSession(c, user.id, aktualisiert!.sessionVersion);
  return c.body(null, 204);
});

// Neuen Wiederherstellungscode erzeugen (der alte wird ungültig)
authRoute.post('/wiederherstellungscode', requireAuth, async (c) => {
  const eingabe = await parse(neuerWiederherstellungscodeSchema, c.req.raw);
  if (!eingabe.success) return c.json(ungueltig(eingabe.error), 400);
  const user = (await db.query.users.findFirst({ where: eq(users.id, c.var.userId) }))!;

  const ok = await mitLimit(c, user.username, () => pruefePasswort(eingabe.data.passwort, user.passwortHash));
  if (ok === null) return c.json(ZU_VIELE, 429);
  if (!ok) return c.json({ error: 'Passwort ist falsch' } satisfies ApiFehler, 401);

  const wiederherstellung = await neuerWiederherstellungsCode();
  await db.update(users).set({ wiederherstellungsHash: wiederherstellung.hash }).where(eq(users.id, user.id));
  return c.json({ wiederherstellungsCode: wiederherstellung.code });
});

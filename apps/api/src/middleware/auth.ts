import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from '../db/client';
import { users } from '../db/schema';
import { leseSession, loescheSession } from '../services/auth';

export interface AuthEnv {
  Variables: { userId: number };
}

/**
 * Lässt nur angemeldete Nutzer durch und stellt c.var.userId bereit. Prüft die
 * Session-Version gegen die DB, damit Logout überall / Passwortänderung alte
 * Tokens sofort ungültig machen.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await leseSession(c);
  const [user] = session
    ? await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, session.userId))
    : [];
  if (!session || !user || user.sessionVersion !== session.sessionVersion) {
    if (session) loescheSession(c);
    return c.json({ error: 'Nicht angemeldet' }, 401);
  }
  c.set('userId', session.userId);
  await next();
});

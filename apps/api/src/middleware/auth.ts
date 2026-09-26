import { createMiddleware } from 'hono/factory';
import { leseSession } from '../services/auth';

export interface AuthEnv {
  Variables: { userId: number };
}

/** Lässt nur angemeldete Nutzer durch und stellt c.var.userId bereit */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const userId = await leseSession(c);
  if (userId === null) return c.json({ error: 'Nicht angemeldet' }, 401);
  c.set('userId', userId);
  await next();
});

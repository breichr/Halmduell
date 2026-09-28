import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import type { ApiFehler } from '@halmduell/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { AuthEnv } from '../middleware/auth';

/**
 * Feste Admins aus ADMIN_USERNAMES (kommagetrennt, Groß-/Kleinschreibung egal).
 * Sie lassen sich im Portal nicht entfernen – so kann sich niemand aussperren.
 * Bei jedem Aufruf gelesen; eine Änderung wirkt nach dem Neustart des Containers.
 */
export function istFesterAdmin(username: string): boolean {
  const namen = (process.env.ADMIN_USERNAMES ?? '').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
  return namen.includes(username.toLowerCase());
}

/** Admin: im Portal ernannt (users.ist_admin) oder fest per ADMIN_USERNAMES */
export function istAdmin(user: { username: string; istAdmin: boolean }): boolean {
  return user.istAdmin || istFesterAdmin(user.username);
}

/** Nach requireAuth: nur Admins weiter, sonst 403 */
export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const [user] = await db.select({ username: users.username, istAdmin: users.istAdmin }).from(users).where(eq(users.id, c.var.userId));
  if (!user || !istAdmin(user)) return c.json({ error: 'Nur für Admins' } satisfies ApiFehler, 403);
  await next();
});

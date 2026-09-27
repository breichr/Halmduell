import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import type { ApiFehler } from '@halmduell/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { AuthEnv } from '../middleware/auth';

/**
 * Admins stehen in ADMIN_USERNAMES (kommagetrennt, Groß-/Kleinschreibung egal).
 * Bei jedem Aufruf gelesen – eine Änderung wirkt nach dem Neustart des Containers.
 */
export function istAdmin(username: string): boolean {
  const namen = (process.env.ADMIN_USERNAMES ?? '').split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
  return namen.includes(username.toLowerCase());
}

/** Nach requireAuth: nur Admins weiter, sonst 403 */
export const requireAdmin = createMiddleware<AuthEnv>(async (c, next) => {
  const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, c.var.userId));
  if (!user || !istAdmin(user.username)) return c.json({ error: 'Nur für Admins' } satisfies ApiFehler, 403);
  await next();
});

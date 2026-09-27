import { Hono } from 'hono';
import { and, desc, eq, notInArray } from 'drizzle-orm';
import { feldFehler, pushAboSchema, pushAbmeldenSchema, type ApiFehler, type PushSchluessel } from '@halmduell/shared';
import { db } from '../db/client';
import { pushSubscriptions } from '../db/schema';
import { requireAuth, type AuthEnv } from '../middleware/auth';
import { pushOeffentlicherSchluessel } from '../services/push';

/** Mehr Geräte je Spieler braucht niemand – ältere Abos fallen dann raus */
const ABOS_JE_SPIELER = 10;

export const pushRoute = new Hono<AuthEnv>();

// Öffentlicher VAPID-Schlüssel (null = Web Push ist auf diesem Server aus)
pushRoute.get('/schluessel', (c) => c.json({ publicKey: pushOeffentlicherSchluessel() } satisfies PushSchluessel));

pushRoute.use('/abo', requireAuth);

/** Gerät anmelden (idempotent; wechselt das Gerät das Konto, gehört das Abo danach dem neuen) */
pushRoute.post('/abo', async (c) => {
  if (!pushOeffentlicherSchluessel()) return c.json({ error: 'Benachrichtigungen sind auf diesem Server nicht eingerichtet' } satisfies ApiFehler, 503);
  const eingabe = pushAboSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) {
    return c.json({ error: 'Ungültiges Abo', felder: feldFehler(eingabe.error) } satisfies ApiFehler, 400);
  }
  const ich = c.var.userId;
  const { endpoint, keys } = eingabe.data;
  await db.insert(pushSubscriptions).values({ userId: ich, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: ich, p256dh: keys.p256dh, auth: keys.auth } });

  const behalten = db.select({ id: pushSubscriptions.id }).from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, ich)).orderBy(desc(pushSubscriptions.erstelltAt), desc(pushSubscriptions.id)).limit(ABOS_JE_SPIELER);
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, ich), notInArray(pushSubscriptions.id, behalten)));
  return c.body(null, 204);
});

/** Gerät abmelden */
pushRoute.delete('/abo', async (c) => {
  const eingabe = pushAbmeldenSchema.safeParse(await c.req.json().catch(() => null));
  if (!eingabe.success) return c.json({ error: 'Ungültige Eingabe' } satisfies ApiFehler, 400);
  await db.delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, c.var.userId), eq(pushSubscriptions.endpoint, eingabe.data.endpoint)));
  return c.body(null, 204);
});

import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import type { PushNachricht } from '@halmduell/shared';
import { db } from '../db/client';
import { pushSubscriptions } from '../db/schema';

// Web Push ist optional: ohne VAPID-Schlüssel bleibt es aus (UI blendet es aus).
// Schlüssel erzeugen: bun run push:schluessel
const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@halmduell.invalid';

/** Wie lange ein Push-Dienst die Nachricht zustellen darf, wenn das Gerät offline ist */
const GUELTIG_S = 24 * 60 * 60;

export const pushOeffentlicherSchluessel = (): string | null => (publicKey && privateKey ? publicKey : null);

type Abo = typeof pushSubscriptions.$inferSelect;
/** Liefert den HTTP-Status des Push-Dienstes */
type Sender = (abo: Abo, payload: string) => Promise<number>;

// web-push übernimmt Verschlüsselung (aes128gcm) und VAPID-Signatur; gesendet wird
// mit dem fetch der Laufzeit
const webPushSender: Sender = async (abo, payload) => {
  const anfrage = webpush.generateRequestDetails(
    { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
    payload,
    { vapidDetails: { subject, publicKey, privateKey }, TTL: GUELTIG_S, urgency: 'normal' },
  );
  const res = await fetch(anfrage.endpoint, {
    method: anfrage.method,
    headers: anfrage.headers as Record<string, string>,
    body: new Uint8Array(anfrage.body as Buffer),
    signal: AbortSignal.timeout(10_000),
  });
  return res.status;
};

let sender: Sender | null = pushOeffentlicherSchluessel() ? webPushSender : null;

export const pushAktiv = () => sender !== null;

export interface Versand {
  an: number;
  nachricht: PushNachricht;
}

/** Nur für Tests: eigenen Sender einsetzen (null = Push aus) */
export function setzePushSender(neu: Sender | null): void {
  sender = neu;
}

/** Hat der Spieler mindestens ein Gerät mit Benachrichtigungen? */
export async function hatPushAbo(userId: number): Promise<boolean> {
  const [abo] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId)).limit(1);
  return !!abo;
}

/** Schickt eine Nachricht an alle Geräte des Spielers; abgelaufene Abos werden entfernt. Wirft nie. */
export async function sende(userId: number, nachricht: PushNachricht): Promise<void> {
  const s = sender;
  if (!s) return;
  try {
    const abos = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    const payload = JSON.stringify(nachricht);
    const ergebnisse = await Promise.allSettled(abos.map((abo) => s(abo, payload)));
    // 404/410: Abo existiert beim Push-Dienst nicht mehr
    const weg = abos.filter((_, i) => {
      const e = ergebnisse[i]!;
      return e.status === 'fulfilled' && (e.value === 404 || e.value === 410);
    });
    if (weg.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, weg.map((a) => a.id)));
    for (const e of ergebnisse) if (e.status === 'rejected') console.error('Push fehlgeschlagen', e.reason);
  } catch (fehler) {
    console.error('Push fehlgeschlagen', fehler);
  }
}

/** Offene Sendungen – Tests warten darauf, damit nichts in den nächsten Test hineinläuft */
const laufend = new Set<Promise<void>>();

/**
 * Verschickt Nachrichten im Hintergrund – nach dem Commit aufrufen, damit nie
 * etwas angekündigt wird, das dann zurückgerollt ist. Blockiert die Antwort nicht.
 */
export function spaeterSenden(nachrichten: Versand[]): void {
  if (!sender) return;
  for (const { an, nachricht } of nachrichten) {
    const p = sende(an, nachricht).finally(() => laufend.delete(p));
    laufend.add(p);
  }
}

export async function allePushesVersendet(): Promise<void> {
  await Promise.all([...laufend]);
}

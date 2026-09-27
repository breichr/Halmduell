import { z } from 'zod';

/** Wie lange nach dem Anstupsen erneut angestupst werden darf */
export const ANSTUPSEN_SPERRE_MS = 12 * 60 * 60 * 1000;
/** Erinnerung, wenn vom Zug nur noch so viel Zeit übrig ist */
export const ERINNERUNG_VOR_FRIST_MS = 24 * 60 * 60 * 1000;

// --- Requests ---

/** POST /api/push/abo – entspricht PushSubscription.toJSON() */
export const pushAboSchema = z.object({
  endpoint: z.string().url().max(2000).startsWith('https://'),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
export type PushAbo = z.infer<typeof pushAboSchema>;

/** DELETE /api/push/abo */
export const pushAbmeldenSchema = z.object({ endpoint: z.string().max(2000) });

// --- Responses ---

/** GET /api/push/schluessel – null, wenn der Server kein Web Push konfiguriert hat */
export interface PushSchluessel {
  publicKey: string | null;
}

/** Inhalt einer Benachrichtigung (Payload an den Service Worker) */
export interface PushNachricht {
  titel: string;
  text: string;
  /** Seite, die beim Antippen geöffnet wird */
  url: string;
  /** gleiche Tags ersetzen sich (z. B. je Duell nur die neueste Nachricht) */
  tag?: string;
}

/** POST /api/duels/:id/anstupsen */
export interface AnstupsenErgebnis {
  /** false: Gegner hat auf keinem Gerät Benachrichtigungen aktiviert */
  zugestellt: boolean;
  /** ab wann wieder angestupst werden kann */
  wiederAb: string;
}

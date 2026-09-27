import { z } from 'zod';
import type { Liga } from './konstanten';

/** Aktivität wird höchstens so oft gespeichert … */
export const AKTIVITAET_INTERVALL_MS = 5 * 60 * 1000;
/** … und so lange gilt jemand als „gerade aktiv“ */
export const GERADE_AKTIV_MS = 2 * AKTIVITAET_INTERVALL_MS;

/** Höchstens so viele unbeantwortete Anfragen darf man gleichzeitig verschickt haben */
export const OFFENE_ANFRAGEN_MAX = 30;

// --- Requests ---

/** POST /api/freunde */
export const freundHinzufuegenSchema = z.object({
  username: z.string().trim().min(1, 'Benutzername fehlt').max(50),
});
export type FreundHinzufuegen = z.infer<typeof freundHinzufuegenSchema>;

// --- Responses ---

export interface Freund {
  id: number;
  username: string;
  /** Gesamt-Rating der laufenden Saison; null = in dieser Saison noch nicht gespielt */
  rating: number | null;
  liga: Liga | null;
  /** zuletzt in der App aktiv; null = noch nie seit Einführung erfasst */
  zuletztAktiv: string | null;
  /** laufendes Duell zwischen uns beiden (das älteste), sonst null */
  laufendesDuell: { id: number; duBistDran: boolean } | null;
}

export interface FreundAnfrage {
  id: number;
  username: string;
  seit: string;
}

/** GET /api/freunde */
export interface Freundesliste {
  /** sortiert nach Name */
  freunde: Freund[];
  /** an mich gerichtet, neueste zuerst */
  anfragen: FreundAnfrage[];
  /** von mir verschickt, neueste zuerst */
  gesendet: FreundAnfrage[];
  /** zuletzt gespielte Gegner, mit denen noch keine Freundschaft oder Anfrage besteht */
  vorschlaege: { id: number; username: string }[];
}

/** POST /api/freunde: bestaetigt, wenn die andere Seite schon angefragt hatte */
export interface FreundHinzugefuegt {
  id: number;
  username: string;
  status: 'angefragt' | 'bestaetigt';
}

import { z } from 'zod';
import { FRAGEN_KATEGORIEN, type FragenKategorie, type FrageStatus } from './konstanten';

/** So viele eingereichte, noch ungeprüfte Fragen darf ein Spieler gleichzeitig haben */
export const EINGEREICHT_OFFEN_MAX = 10;

const pflicht = (max: number) => z.string().trim().min(1, 'fehlt').max(max, `höchstens ${max} Zeichen`);

// --- Requests ---

/** POST /api/fragen – Spieler reichen Textfragen ein; Admins prüfen sie im Portal */
export const frageEinreichenSchema = z.object({
  kategorie: z.enum(FRAGEN_KATEGORIEN),
  frage: pflicht(500),
  richtig: pflicht(100),
  falsch: z.tuple([pflicht(100), pflicht(100), pflicht(100)]),
  erklaerung: z.preprocess(
    (w) => (typeof w === 'string' && w.trim() === '' ? null : w),
    z.string().trim().max(1000, 'höchstens 1000 Zeichen').nullable().default(null),
  ),
}).superRefine((f, ctx) => {
  const antworten = [f.richtig, ...f.falsch].map((a) => a.toLowerCase());
  if (new Set(antworten).size !== 4) ctx.addIssue({ code: 'custom', path: ['falsch'], message: 'Die 4 Antworten müssen verschieden sein' });
});
export type FrageEinreichen = z.infer<typeof frageEinreichenSchema>;

// --- Responses ---

/** Eigene eingereichte Frage (GET /api/fragen/eigene) */
export interface EigeneFrage {
  id: number;
  kategorie: FragenKategorie;
  frage: string;
  richtig: string;
  falsch: [string, string, string];
  erklaerung: string | null;
  /** eingereicht = wartet auf Prüfung; entwurf = von einem Admin zur Überarbeitung zurückgestellt */
  status: FrageStatus;
  /** Rückmeldung des Admins beim Freigeben oder Ablehnen */
  rueckmeldung: string | null;
  eingereichtAt: string;
}

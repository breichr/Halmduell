import { z } from 'zod';
import { MELDUNG_GRUENDE, type MeldungGrund } from './konstanten';

/** Höchstens so viele Meldungen je Spieler und Tag */
export const MELDUNGEN_PRO_TAG = 20;

// --- Requests ---

/** POST /api/fragen/:id/melden */
export const meldenSchema = z.object({
  grund: z.enum(MELDUNG_GRUENDE),
  kommentar: z.preprocess(
    (w) => (typeof w === 'string' && w.trim() === '' ? null : w),
    z.string().trim().max(500, 'höchstens 500 Zeichen').nullable().default(null),
  ),
});
export type Melden = z.infer<typeof meldenSchema>;

/**
 * POST /api/admin/fragen/:id/meldungen – alle offenen Meldungen einer Frage abschließen.
 * Die Melder bekommen eine Push-Nachricht, optional mit einer kurzen Antwort.
 */
export const meldungenAbschliessenSchema = z.object({
  status: z.enum(['erledigt', 'verworfen']),
  antwort: z.preprocess(
    (w) => (typeof w === 'string' && w.trim() === '' ? null : w),
    z.string().trim().max(300, 'höchstens 300 Zeichen').nullable().default(null),
  ),
});

/** Antwort von POST /api/admin/fragen/:id/meldungen */
export interface MeldungenAbgeschlossen {
  abgeschlossen: number;
  /** so viele Melder haben eine Push-Nachricht bekommen (Gerät mit Benachrichtigungen) */
  benachrichtigt: number;
}

// --- Responses ---

/** GET /api/admin/fragen/:id/meldungen */
export interface AdminMeldung {
  id: number;
  username: string;
  grund: MeldungGrund;
  kommentar: string | null;
  /** was der Spieler im Duell geantwortet hat (zuletzt); null = Zeit abgelaufen */
  seineAntwort: string | null;
  erstelltAt: string;
}

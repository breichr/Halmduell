import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Benutzername muss mindestens 3 Zeichen haben')
  .max(20, 'Benutzername darf höchstens 20 Zeichen haben')
  .regex(/^[A-Za-z0-9_äöüÄÖÜß-]+$/, 'Nur Buchstaben, Ziffern, _ und - erlaubt');

const passwortSchema = z
  .string()
  .min(8, 'Passwort muss mindestens 8 Zeichen haben')
  .max(200, 'Passwort darf höchstens 200 Zeichen haben');

/** Wiederherstellungscode: 20 Zeichen, Anzeige in 4er-Gruppen à 5; Eingabe ohne Beachtung von Leerzeichen, Bindestrichen und Groß-/Kleinschreibung */
export const WIEDERHERSTELLUNGSCODE_LAENGE = 20;
export const normalisiereCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, '');

export const zugangsdatenSchema = z.object({
  username: usernameSchema,
  password: passwortSchema,
});
export type Zugangsdaten = z.infer<typeof zugangsdatenSchema>;

export const passwortAendernSchema = z.object({
  altesPasswort: z.string().min(1).max(200),
  neuesPasswort: passwortSchema,
});

export const neuerWiederherstellungscodeSchema = z.object({
  passwort: z.string().min(1).max(200),
});

export const zuruecksetzenSchema = z.object({
  username: z.string().trim().min(1).max(50),
  code: z.string().transform(normalisiereCode).pipe(z.string().length(WIEDERHERSTELLUNGSCODE_LAENGE, 'Ungültiger Wiederherstellungscode')),
  neuesPasswort: passwortSchema,
});

/** Antwort von /api/auth/login und /api/auth/me */
export interface AngemeldeterUser {
  id: number;
  username: string;
  /** darf das Admin-Portal nutzen (ADMIN_USERNAMES) */
  istAdmin: boolean;
}

/**
 * Antwort von /api/auth/register und /api/auth/zuruecksetzen. Der Code wird nur
 * dieses eine Mal angezeigt – der Server speichert ihn nur als Hash.
 */
export interface UserMitWiederherstellungscode extends AngemeldeterUser {
  wiederherstellungsCode: string;
}

/** Einheitliches Fehlerformat der API */
export interface ApiFehler {
  error: string;
  felder?: Record<string, string[]>;
}

/** Feldbezogene Fehlermeldungen aus einer fehlgeschlagenen Validierung */
export function feldFehler(fehler: z.ZodError): Record<string, string[]> {
  const felder: Record<string, string[] | undefined> = z.flattenError(fehler).fieldErrors;
  return Object.fromEntries(Object.entries(felder).filter((e): e is [string, string[]] => !!e[1]));
}

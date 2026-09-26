import { z } from 'zod';

export const zugangsdatenSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Benutzername muss mindestens 3 Zeichen haben')
    .max(20, 'Benutzername darf höchstens 20 Zeichen haben')
    .regex(/^[A-Za-z0-9_äöüÄÖÜß-]+$/, 'Nur Buchstaben, Ziffern, _ und - erlaubt'),
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen haben')
    .max(200, 'Passwort darf höchstens 200 Zeichen haben'),
});
export type Zugangsdaten = z.infer<typeof zugangsdatenSchema>;

/** Antwort von /api/auth/register, /api/auth/login und /api/auth/me */
export interface AngemeldeterUser {
  id: number;
  username: string;
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

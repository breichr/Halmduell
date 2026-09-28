import { z } from 'zod';
import { FRAGE_STATUS, FRAGE_TYPEN, FRAGEN_KATEGORIEN, type FragenKategorie, type FrageStatus, type FrageTyp } from './konstanten';

// --- Requests ---

const leerZuNull = (wert: unknown) => (typeof wert === 'string' && wert.trim() === '' ? null : wert);
const pflicht = (max: number) => z.string().trim().min(1, 'fehlt').max(max, `höchstens ${max} Zeichen`);
const optional = (max: number) => z.preprocess(leerZuNull, z.string().trim().max(max, `höchstens ${max} Zeichen`).nullable().default(null));

/**
 * POST/PUT /api/admin/fragen – dieselben Regeln wie beim CSV-Import
 * (apps/api/src/fragen/csv.ts), damit Portal und Datei zueinander passen.
 */
export const frageBearbeitenSchema = z.object({
  kategorie: z.enum(FRAGEN_KATEGORIEN),
  typ: z.enum(FRAGE_TYPEN).default('text'),
  frage: pflicht(1000),
  richtig: pflicht(100),
  falsch: z.tuple([pflicht(100), pflicht(100), pflicht(100)]),
  erklaerung: optional(2000),
  schwierigkeit: z.coerce.number().int().min(1, '1 bis 5').max(5, '1 bis 5').default(1),
  bildUrl: z.preprocess(leerZuNull, z.url({ protocol: /^https$/, error: 'muss eine https-URL sein' }).nullable().default(null)),
  bildQuelle: optional(500),
  status: z.enum(FRAGE_STATUS),
}).superRefine((f, ctx) => {
  if (f.typ === 'bild' && !f.bildUrl) ctx.addIssue({ code: 'custom', path: ['bildUrl'], message: 'fehlt (Bildfrage)' });
  if (f.bildUrl && !f.bildQuelle) ctx.addIssue({ code: 'custom', path: ['bildQuelle'], message: 'fehlt (Urheber + Lizenz angeben)' });
  const antworten = [f.richtig, ...f.falsch].map((a) => a.toLowerCase());
  if (new Set(antworten).size !== 4) ctx.addIssue({ code: 'custom', path: ['falsch'], message: 'Die 4 Antworten müssen verschieden sein' });
});
export type FrageBearbeiten = z.infer<typeof frageBearbeitenSchema>;

/** POST /api/admin/fragen/:id/status – bei eingereichten Fragen optional mit Rückmeldung an den Einreicher */
export const statusSetzenSchema = z.object({ status: z.enum(FRAGE_STATUS), rueckmeldung: optional(300) });

/** GET /api/admin/fragen – Filter */
export const adminFragenFilterSchema = z.object({
  status: z.enum(FRAGE_STATUS).optional(),
  kategorie: z.enum(FRAGEN_KATEGORIEN).optional(),
  suche: z.string().trim().max(100).optional(),
  /** nur Fragen mit offenen Meldungen */
  gemeldet: z.literal('1').optional(),
});

/** POST /api/admin/commons – Link zu einer Datei auf Wikimedia Commons */
export const commonsSchema = z.object({ link: z.string().trim().min(1, 'fehlt').max(1000) });

// --- Responses ---

/** Bilddaten einer Commons-Datei, fertig für bildUrl/bildQuelle */
export interface CommonsBild {
  /** verkleinertes Bild (max. 1024 px breit) auf upload.wikimedia.org */
  bildUrl: string;
  /** „Urheber, Lizenz, Wikimedia Commons“ */
  bildQuelle: string;
  urheber: string;
  lizenz: string;
  /** Beschreibungsseite der Datei (Nachweis der Lizenz) */
  seite: string;
}

export interface AdminFrage {
  id: number;
  /** fester Schlüssel (wie in fragen.csv); ändert sich nie */
  code: string | null;
  kategorie: FragenKategorie;
  typ: FrageTyp;
  frage: string;
  richtig: string;
  falsch: [string, string, string];
  erklaerung: string | null;
  schwierigkeit: number;
  bildUrl: string | null;
  bildQuelle: string | null;
  status: FrageStatus;
  /** in Duellen beantwortet (inkl. abgelaufener Zeit) bzw. davon richtig */
  statistik: { beantwortet: number; richtig: number };
  /** offene Meldungen von Spielern */
  meldungen: number;
  /** Benutzername, falls von einem Spieler eingereicht */
  eingereichtVon: string | null;
  /** Rückmeldung an den Einreicher */
  rueckmeldung: string | null;
}

export interface AdminKategorieStand {
  kategorie: FragenKategorie;
  freigegeben: number;
  entwurf: number;
  eingereicht: number;
  abgelehnt: number;
}

/** GET /api/admin/fragen */
export interface AdminFragenListe {
  fragen: AdminFrage[];
  /** immer über alle Fragen, unabhängig vom Filter */
  uebersicht: AdminKategorieStand[];
  /** Fragen mit offenen Meldungen (unabhängig vom Filter) */
  gemeldet: number;
}

// --- Admins verwalten ---

/** POST /api/admin/admins – Spieler per Benutzername zum Admin machen */
export const adminHinzufuegenSchema = z.object({ username: z.string().trim().min(1, 'fehlt').max(50) });

/** Eintrag in GET /api/admin/admins */
export interface AdminEintrag {
  id: number;
  username: string;
  /** fest per ADMIN_USERNAMES – im Portal nicht entfernbar */
  fest: boolean;
  /** das bin ich (kann sich nicht selbst entfernen) */
  ich: boolean;
}

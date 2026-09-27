import type { FragenKategorie } from './konstanten';

export const ABZEICHEN_GRUPPEN = ['meilenstein', 'kategorie', 'saison', 'besonders'] as const;
export type AbzeichenGruppe = (typeof ABZEICHEN_GRUPPEN)[number];

export const ABZEICHEN_GRUPPEN_NAMEN: Record<AbzeichenGruppe, string> = {
  meilenstein: 'Meilensteine',
  kategorie: 'Fachwissen',
  saison: 'Saison',
  besonders: 'Besondere Momente',
};

/** Symbol der Abzeichen-Plakette (Zeichnung im Frontend) */
export type AbzeichenIcon = 'halm' | 'garbe' | 'scheune' | 'aehre' | 'kulturen' | 'schaedlinge' | 'krankheiten' | 'wissen'
  | 'pokal' | 'krone' | 'blitz' | 'flamme' | 'freunde' | 'stern';

export interface AbzeichenDefinition {
  key: string;
  titel: string;
  beschreibung: string;
  gruppe: AbzeichenGruppe;
  icon: AbzeichenIcon;
  /** Zielwert für die Fortschrittsanzeige (nur bei zählbaren Abzeichen) */
  ziel?: number;
}

/** Richtige Antworten, ab denen man in einer Kategorie als Expertin/Experte gilt */
export const EXPERTEN_ZIEL = 50;

export const KATEGORIE_ABZEICHEN: Record<FragenKategorie, string> = {
  kulturen: 'kulturen_experte',
  schaedlinge: 'schaedling_experte',
  krankheiten: 'krankheiten_experte',
  wissen: 'wissen_experte',
};

/**
 * Alle Abzeichen in Anzeigereihenfolge. Die Keys sind dauerhaft (stehen in der
 * Datenbank) – Titel und Beschreibung dürfen sich ändern.
 */
export const ABZEICHEN: readonly AbzeichenDefinition[] = [
  { key: 'erstes_duell', titel: 'Erste Schritte', beschreibung: 'Das erste Duell abgeschlossen', gruppe: 'meilenstein', icon: 'halm', ziel: 1 },
  { key: 'zehn_duelle', titel: 'Warmgelaufen', beschreibung: '10 Duelle gespielt', gruppe: 'meilenstein', icon: 'garbe', ziel: 10 },
  { key: 'fuenfzig_duelle', titel: 'Alter Hase', beschreibung: '50 Duelle gespielt', gruppe: 'meilenstein', icon: 'scheune', ziel: 50 },
  { key: 'erster_sieg', titel: 'Erste Ernte', beschreibung: 'Das erste Duell gewonnen', gruppe: 'meilenstein', icon: 'aehre', ziel: 1 },

  { key: KATEGORIE_ABZEICHEN.kulturen, titel: 'Kulturen-Kenner', beschreibung: `${EXPERTEN_ZIEL} Kulturenfragen richtig beantwortet`, gruppe: 'kategorie', icon: 'kulturen', ziel: EXPERTEN_ZIEL },
  { key: KATEGORIE_ABZEICHEN.schaedlinge, titel: 'Schädlings-Experte', beschreibung: `${EXPERTEN_ZIEL} Schädlingsfragen richtig beantwortet`, gruppe: 'kategorie', icon: 'schaedlinge', ziel: EXPERTEN_ZIEL },
  { key: KATEGORIE_ABZEICHEN.krankheiten, titel: 'Pflanzendoktor', beschreibung: `${EXPERTEN_ZIEL} Krankheitsfragen richtig beantwortet`, gruppe: 'kategorie', icon: 'krankheiten', ziel: EXPERTEN_ZIEL },
  { key: KATEGORIE_ABZEICHEN.wissen, titel: 'Agrar-Professor', beschreibung: `${EXPERTEN_ZIEL} Wissensfragen richtig beantwortet`, gruppe: 'kategorie', icon: 'wissen', ziel: EXPERTEN_ZIEL },

  { key: 'liga_gold', titel: 'Goldene Ähre', beschreibung: 'In einer Saison Liga Gold erreicht (Gesamt)', gruppe: 'saison', icon: 'stern' },
  { key: 'saison_top10', titel: 'Saison-Top-10', beschreibung: 'Eine Saison unter den besten 10 abgeschlossen (Gesamt)', gruppe: 'saison', icon: 'pokal' },
  { key: 'saison_meister', titel: 'Saisonsieger', beschreibung: 'Eine Saison auf Platz 1 abgeschlossen (Gesamt)', gruppe: 'saison', icon: 'krone' },

  { key: 'volle_scheune', titel: 'Volle Scheune', beschreibung: 'In einem Duell alle 6 Fragen richtig', gruppe: 'besonders', icon: 'scheune' },
  { key: 'blitzmerker', titel: 'Blitzmerker', beschreibung: 'Eine Frage in unter 2 Sekunden richtig beantwortet', gruppe: 'besonders', icon: 'blitz' },
  { key: 'siegesserie', titel: 'Guter Lauf', beschreibung: '3 Duelle in Folge gewonnen', gruppe: 'besonders', icon: 'flamme', ziel: 3 },
  { key: 'gesellig', titel: 'Gesellig', beschreibung: '3 Freunde gefunden', gruppe: 'besonders', icon: 'freunde', ziel: 3 },
];

/** Antwortzeit für „Blitzmerker“ */
export const BLITZ_MS = 2_000;

export const abzeichenDefinition = (key: string) => ABZEICHEN.find((a) => a.key === key);

// --- Responses ---

export interface Abzeichen extends AbzeichenDefinition {
  /** Zeitpunkt, zu dem es erreicht wurde; null = noch nicht erreicht */
  erreichtAt: string | null;
  /** aktueller Stand bei zählbaren, noch nicht erreichten Abzeichen */
  stand: number | null;
}

/** GET /api/abzeichen */
export interface AbzeichenListe {
  abzeichen: Abzeichen[];
  erreicht: number;
}

/** In einem Duell neu erreichtes Abzeichen (Ergebnis-Screen) */
export interface NeuesAbzeichen {
  key: string;
  titel: string;
  icon: AbzeichenIcon;
}

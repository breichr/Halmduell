// Einfacher In-Memory-Limiter (reicht für eine einzelne API-Instanz).
// Bei mehreren Instanzen durch Postgres/Redis ersetzen.

interface Eintrag {
  anzahl: number;
  zuruecksetzenUm: number;
}

export function erstelleLimiter(maxVersuche: number, fensterMs: number) {
  const eintraege = new Map<string, Eintrag>();

  return {
    /** Zählt einen Versuch; false, wenn das Limit überschritten ist */
    versuch(schluessel: string, jetzt = Date.now()): boolean {
      const eintrag = eintraege.get(schluessel);
      if (!eintrag || eintrag.zuruecksetzenUm <= jetzt) {
        eintraege.set(schluessel, { anzahl: 1, zuruecksetzenUm: jetzt + fensterMs });
        if (eintraege.size > 10_000) {
          for (const [k, e] of eintraege) if (e.zuruecksetzenUm <= jetzt) eintraege.delete(k);
        }
        return true;
      }
      eintrag.anzahl++;
      return eintrag.anzahl <= maxVersuche;
    },
    zuruecksetzen(schluessel: string): void {
      eintraege.delete(schluessel);
    },
  };
}

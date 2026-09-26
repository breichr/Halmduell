// Einfacher In-Memory-Limiter (reicht für eine einzelne API-Instanz).
// Bei mehreren Instanzen durch Postgres/Redis ersetzen.

interface Eintrag {
  anzahl: number;
  zuruecksetzenUm: number;
}

export function erstelleLimiter(maxVersuche: number, fensterMs: number) {
  const eintraege = new Map<string, Eintrag>();

  function aktuell(schluessel: string, jetzt: number): Eintrag | undefined {
    const eintrag = eintraege.get(schluessel);
    if (eintrag && eintrag.zuruecksetzenUm <= jetzt) {
      eintraege.delete(schluessel);
      return undefined;
    }
    return eintrag;
  }

  function zaehle(schluessel: string, jetzt: number): Eintrag {
    const eintrag = aktuell(schluessel, jetzt);
    if (eintrag) {
      eintrag.anzahl++;
      return eintrag;
    }
    if (eintraege.size > 10_000) {
      for (const [k, e] of eintraege) if (e.zuruecksetzenUm <= jetzt) eintraege.delete(k);
    }
    const neu = { anzahl: 1, zuruecksetzenUm: jetzt + fensterMs };
    eintraege.set(schluessel, neu);
    return neu;
  }

  return {
    /** Zählt einen Versuch; false, wenn das Limit damit überschritten ist */
    versuch(schluessel: string, jetzt = Date.now()): boolean {
      return zaehle(schluessel, jetzt).anzahl <= maxVersuche;
    },
    /** true, wenn für den Schlüssel bereits zu viele Fehlschläge gezählt sind */
    gesperrt(schluessel: string, jetzt = Date.now()): boolean {
      return (aktuell(schluessel, jetzt)?.anzahl ?? 0) >= maxVersuche;
    },
    fehlschlag(schluessel: string, jetzt = Date.now()): void {
      zaehle(schluessel, jetzt);
    },
    zuruecksetzen(schluessel: string): void {
      eintraege.delete(schluessel);
    },
  };
}

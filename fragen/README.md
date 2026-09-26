# Fragen pflegen

Alle Quizfragen stehen in `fragen.csv` – eine Zeile pro Frage. Die Datei lässt
sich direkt in Excel oder LibreOffice Calc öffnen und bearbeiten.

Beim Start des API-Containers wird die Datei automatisch importiert. Ablauf:
Datei bearbeiten → prüfen → committen → deployen.

```sh
bun run fragen:pruefen   # Datei prüfen (ohne Datenbank), zeigt Fehler mit Zeilennummer
bun run fragen:import    # in die lokale Datenbank importieren
```

CI prüft die Datei bei jedem Push; eine ungültige Datei wird also nicht
ausgerollt. Enthält die Datei einen Fehler, wird **nichts** importiert.

## Spalten

| Spalte | Pflicht | Inhalt |
|---|---|---|
| `code` | ja | eindeutiger, fester Schlüssel, z. B. `krankheiten-012`. Nur Kleinbuchstaben, Ziffern, `-`, `_`. **Nie ändern** – daran erkennt der Import die Frage wieder. |
| `kategorie` | ja | `kulturen`, `schaedlinge`, `krankheiten` oder `wissen` |
| `typ` | nein | `text` (Standard) oder `bild` |
| `frage` | ja | Fragetext |
| `richtig` | ja | die richtige Antwort (max. 100 Zeichen) |
| `falsch1`–`falsch3` | ja | drei falsche Antworten; alle vier müssen verschieden sein |
| `erklaerung` | nein | wird nach dem Beantworten angezeigt |
| `schwierigkeit` | nein | 1–5, Standard 1 |
| `bild_url` | bei `bild` | https-Link zum Bild, z. B. von Wikimedia Commons |
| `bild_quelle` | bei Bild | Urheber + Lizenz, z. B. `Max Muster, CC BY-SA 4.0, Wikimedia Commons` – wird im Quiz angezeigt |
| `status` | nein | `freigegeben` (Standard, wird gespielt), `entwurf` (wird nicht gespielt), `abgelehnt` |

Die Antworten werden im Spiel für jeden Spieler gemischt; in der Datei steht
die richtige immer in der Spalte `richtig`.

## Ändern und Entfernen

- **Tippfehler korrigieren / Erklärung verbessern:** einfach in der Zeile
  ändern. Gespielte Duelle zeigen danach den korrigierten Text.
- **Inhaltlich andere Frage:** neue Zeile mit neuem `code` anlegen und die
  alte auf `abgelehnt` setzen – sonst passen alte Duell-Ergebnisse nicht mehr
  zur Frage.
- **Frage entfernen:** `status` auf `abgelehnt` setzen. Zeilen zu löschen
  entfernt die Frage nicht aus der Datenbank (sie könnte in Duellen vorkommen);
  der Import weist dann nur darauf hin.

## Speichern

In Excel „CSV UTF-8 (durch Trennzeichen getrennt)“ wählen. Normales „CSV“
(Windows-1252) funktioniert auch – Umlaute werden erkannt. Trennzeichen `;`
oder `,` werden beide erkannt.

## Mengen

Ein Duell braucht 6 freigegebene Fragen seiner Kategorie; mit deutlich mehr
Fragen pro Kategorie (Richtwert 50+) wiederholen sich Fragen zwischen
denselben Spielern seltener.

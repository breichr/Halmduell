# Fragen pflegen

**Gepflegt werden die Fragen im Admin-Portal** (`/admin`, siehe README) –
die Datenbank ist maßgeblich. Diese Datei dient als Startbestand und für
größere Mengen neuer Fragen:

- Beim Start des API-Containers werden Zeilen mit **neuem `code`** importiert.
  Zeilen, deren Code schon in der Datenbank steht, werden übersprungen –
  Änderungen daran wirken also nicht mehr (dafür das Portal nutzen).
- Aktuellen Stand sichern: im Portal „CSV exportieren“ – die Datei hat genau
  dieses Format und kann hier als `fragen.csv` eingecheckt werden.
- Ausnahmsweise alles aus der Datei übernehmen (überschreibt Änderungen aus dem
  Portal): `bun run fragen:import -- --ueberschreiben`.

Die Datei lässt sich direkt in Excel oder LibreOffice Calc öffnen und
bearbeiten. Ablauf für neue Fragen: Zeilen mit neuen Codes anhängen → prüfen →
committen → deployen.

```sh
bun run fragen:pruefen   # Datei prüfen (ohne Datenbank), zeigt Fehler mit Zeilennummer
bun run fragen:import    # in die lokale Datenbank importieren
```

CI prüft die Datei bei jedem Push; eine ungültige Datei wird also nicht
ausgerollt. Enthält die Datei einen Fehler, wird **nichts** importiert.

## Spalten

| Spalte | Pflicht | Inhalt |
|---|---|---|
| `code` | ja | eindeutiger, fester Schlüssel, z. B. `viehzucht-012`. Nur Kleinbuchstaben, Ziffern, `-`, `_`. **Nie ändern** – daran erkennt der Import die Frage wieder. |
| `kategorie` | ja | `landtechnik`, `pflanzenbau` oder `viehzucht` (ältere Codes wie `kulturen-003` bleiben, auch wenn die Kategorie wechselt) |
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

## Ändern und Entfernen (im Admin-Portal)

- **Tippfehler korrigieren / Erklärung verbessern:** Frage bearbeiten.
  Gespielte Duelle zeigen danach den korrigierten Text.
- **Inhaltlich andere Frage:** neue Frage anlegen und die alte ablehnen –
  sonst passen alte Duell-Ergebnisse nicht mehr zur Frage.
- **Frage entfernen:** ablehnen. Gelöscht wird nie (sie könnte in Duellen
  vorkommen).

## Bildfragen

Am einfachsten im Admin-Portal: „Bildfrage“ anhaken, Link zur Datei auf
Wikimedia Commons einfügen, „Übernehmen“ – `bild_url` und `bild_quelle`
werden aus den Commons-Angaben (Urheber, Lizenz) gefüllt.

## Speichern

In Excel „CSV UTF-8 (durch Trennzeichen getrennt)“ wählen. Normales „CSV“
(Windows-1252) funktioniert auch – Umlaute werden erkannt. Trennzeichen `;`
oder `,` werden beide erkannt.

## Mengen

Ein Duell braucht 6 freigegebene Fragen seiner Kategorie; mit deutlich mehr
Fragen pro Kategorie (Richtwert 50+) wiederholen sich Fragen zwischen
denselben Spielern seltener.

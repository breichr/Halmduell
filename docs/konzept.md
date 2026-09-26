# Konzept: Halmduell

## Spielprinzip

Asynchrones 1v1-Quizduell (wie Quizduell), aber mit landwirtschaftlichen
Fragen. Spieler A beantwortet 6 Fragen, danach Spieler B dieselben 6 Fragen,
anschließend Frage-für-Frage-Vergleich der Ergebnisse. Mehrere parallele
Duelle möglich, Push-Notification wenn der Gegner am Zug ist.

## Fragetypen

1. **Wissensfragen** (Multiple Choice, 4 Antworten): Anbau, Düngung,
   Fruchtfolge, Maschinen, Recht/Förderungen, Tierhaltung.
2. **Bilderkennung** (Multiple Choice mit Bild):
   - Kulturen bestimmen
   - Krankheiten (z. B. Septoria vs. Gelbrost bei Weizen)
   - Schädlinge (Insekten, Fraßbilder, Larven)
   - Unkräuter

Kategorien: `kulturen`, `schaedlinge`, `krankheiten`, `wissen`, `gemischt`.

## Timer

Ein moderater Timer (10–15 Sek.) dient primär dem Spieltempo und der Spannung,
nicht in erster Linie dem Cheatschutz (echtes Cheaten lässt sich bei
asynchronem Spiel ohnehin kaum verhindern). Der Timer verhindert vor allem
schnelles Nachschlagen der Antwort.

## Bilddatenbank

Bestehende, lizenzsichere Quellen nutzen (Copyright beachten):

- **Wikimedia Commons** – Start-Quelle, CC0/CC-BY-Bilder, Lizenz maschinenlesbar
  über die API abrufbar
- **GBIF / iNaturalist** – Schädlinge/Insekten, CC-Lizenzen mit Attribution
- **EPPO Global Database** – eher Textreferenz, Bildrechte separat prüfen
- Landwirtschaftskammern/Universitäten (z. B. AGES) – ggf. Bildmaterial mit
  offener Lizenz für Bildungszwecke

Attribution wird automatisch im Quiz eingeblendet ("Bild: Name, CC-BY-SA").

## Spielablauf / Screens

1. **Dashboard**: laufende Duelle (Gegner-Avatar, Status "Du bist dran" /
   "Wartet auf Gegner"), Button "Neues Duell starten", Punktestand/Liga.
2. **Duell starten**: Gegner wählen (Freund per Code/Link einladen, primärer
   Einstiegspunkt; Zufallsgegner optional später), Kategorie wählen,
   Schwierigkeitsgrad optional.
3. **Frage-Screen**: Fortschrittsanzeige, Timer-Kreis, bei Bilderfragen Bild
   groß oben + 4 Antwortkacheln, bei Wissensfragen Fragetext + 4 Kacheln.
   Sofortiges Feedback (richtig/falsch) mit kurzer Erklärung.
4. **Rundenabschluss**: Falls Gegner fertig ist, sofortiger Kachel-für-Kachel-
   Vergleich (Häkchen/Kreuz je Frage). Sonst "Warte auf [Name]..." plus
   Möglichkeit, direkt ein neues Duell zu starten.
5. **Ergebnis-Screen**: Sieger/Unentschieden, Punkte beider Seiten,
   "Nochmal herausfordern", Teilen-Option.
6. **Profil/Statistik**: Trefferquote nach Kategorie (Basis für spätere
   Lernfunktion, gezieltes Wiederholen falscher Antworten).
7. **Freundesliste**: Freund per Code/Username hinzufügen, Online-Status,
   Rating/Liga, Direkt-Duell-Button, Mini-Rangliste unter Freunden.
8. **Abzeichen**: kategoriebasiert (z. B. "Schädlings-Experte"), Meilensteine
   (z. B. "10 Duelle gespielt"), saisonale Abzeichen (bleiben nach Reset
   sichtbar). Nicht erreichte Abzeichen werden ausgegraut mit Beschreibung
   angezeigt statt komplett versteckt.

## Ranking-System

- **ELO als Kern-Rating** (Start 1000), zusätzlich sichtbare
  **Liga-Einteilung** (Bronze/Silber/Gold/Platin/Meister) für Greifbarkeit.
- **Separates Rating pro Kategorie** (`gesamt`, `kulturen`, `schaedlinge`,
  `krankheiten`, `wissen`) – passt zur Statistik-Ansicht. Jedes Duell zählt
  für `gesamt` und zusätzlich für seine Kategorie; `gemischt`-Duelle zählen
  nur für `gesamt`.
- **Saisonale Resets** (z. B. alle 3 Monate) mit Bestenlisten-Archiv; Soft-
  Reset-Formel statt hartem Reset auf 1000, damit gute Spieler nicht komplett
  bei null anfangen:
  `neues_rating = 1000 + (altes_rating - 1000) * 0.5`
- K-Faktor: 40 für Spieler mit < 20 Duellen in der jeweiligen Kategorie
  (über alle Saisons gezählt), 20 für erfahrene Spieler.

Liga-Grenzen (Vorschlag):

| Liga | Rating |
|---|---|
| Bronze | < 900 |
| Silber | 900–1099 |
| Gold | 1100–1299 |
| Platin | 1300–1499 |
| Meister | ≥ 1500 |

## Fragen-Pool

Vorerst selbst kuratiert. Später soll eine Community-Einreichung mit Review-
Prozess möglich sein (dafür ist im Datenmodell bereits ein `status`-Feld auf
`questions` vorgesehen: `entwurf`, `eingereicht`, `freigegeben`, `abgelehnt`,
plus `eingereicht_von`).

## Belohnungen / Fortschritt

- Abzeichen (siehe oben)
- Tägliche Bonusfrage (zählt nicht fürs Rating, kleiner XP-Bonus)
- Login-Streak rein kosmetisch, kein Verfall-Druck
- XP-basiertes Level, unabhängig vom ELO-Rating, schaltet kosmetische
  Avatar-Rahmen/Badges frei

## Freundesliste

Da das Spiel ohnehin asynchron ist, laufen die meisten Duelle vermutlich
gegen Freunde/Bekannte statt gegen Fremde über Matchmaking – "Freund
einladen" ist daher prominenter platziert als "Zufallsgegner suchen".

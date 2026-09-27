# Datenmodell: Halmduell

Maßgeblich ist das Drizzle-Schema in `apps/api/src/db/schema.ts`; das daraus
erzeugte SQL liegt unter `apps/api/src/db/migrations/`. Erlaubte Werte für
Kategorien und Status kommen aus `packages/shared` und werden zusätzlich per
CHECK-Constraint in der Datenbank abgesichert.

## Tabellen

| Tabelle | Schlüssel | Inhalt |
|---|---|---|
| `users` | `id` | Spieler, `username` eindeutig (ohne Groß-/Kleinschreibung), `passwort_hash`, `wiederherstellungs_hash`, `session_version` |
| `questions` | `id` | Frage mit `kategorie` (`landtechnik`, `pflanzenbau`, `viehzucht`), `typ` (`bild`/`text`), Bild-URL + Attribution, `schwierigkeit` 1–5, `erklaerung`, `status` (`entwurf`, `eingereicht`, `freigegeben`, `abgelehnt`), `eingereicht_von` |
| `answer_options` | `id` | Antwortoptionen je Frage, `ist_richtig` |
| `duels` | `id` | Duell zwischen `spieler_a_id` und `spieler_b_id` (NULL bis zum Beitritt per `einladungs_code`), `kategorie` (zusätzlich `gemischt`), `status` (`wartet_a`, `wartet_b`, `abgeschlossen`), `zug_seit` (Beginn des aktuellen Zugs, für die 3-Tage-Frist), `aufgegeben_von`, `gewertet_at` + `rating_aenderung_a/b` nach dem ELO-Update; Status zusätzlich `abgebrochen` (ohne Wertung) |
| `duel_questions` | `duel_id`, `reihenfolge` | die 6 Fragen eines Duells (für beide Spieler identisch) |
| `duel_answers` | `duel_id`, `user_id`, `question_id` | Antwort je Spieler und Frage: `gestellt_at` (Timer-Start), `beantwortet_at`, `antwortzeit_ms`, `ist_richtig` (NULL = noch offen); `answer_option_id` ist leer, wenn der Timer abgelaufen ist |
| `ratings` | `user_id`, `kategorie`, `saison` | ELO je Kategorie (`gesamt`, `landtechnik`, `pflanzenbau`, `viehzucht`) und Saison (fortlaufend, quartalsweise, Saison 1 = Q1 2026), `duelle_gespielt` |
| `friendships` | `user_id`, `friend_id` | Freundschaft, `status` (`angefragt`, `bestaetigt`) |
| `achievements` | `id` | Abzeichen, eindeutiger `key` (z. B. `schaedling_experte`) |
| `user_achievements` | `user_id`, `achievement_id` | erreichte Abzeichen mit Zeitpunkt |
| `frage_meldungen` | `id` | Meldung eines Spielers zu einer Frage: `grund` (`antwort_falsch`, `frage_unklar`, `sonstiges`), `kommentar`, `status` (`offen`, `erledigt`, `verworfen`), `abgeschlossen_at`/`_von`; je Spieler und Frage höchstens eine offene |

## Regeln in der Datenbank

- Erlaubte Werte für alle Kategorie- und Status-Spalten (CHECK)
- `schwierigkeit` 1–5, `reihenfolge` 1–6
- Bildfragen brauchen eine `bild_url`
- höchstens eine richtige Antwortoption pro Frage
- dieselbe Frage höchstens einmal pro Duell
- kein Duell und keine Freundschaft mit sich selbst
- Löschen eines Duells löscht dessen Fragen und Antworten, Löschen einer Frage
  deren Antwortoptionen; Löschen eines Users setzt `eingereicht_von` auf NULL
- Zeitstempel mit Zeitzone (`timestamptz`)

Indizes gibt es für die Hauptabfragen: laufende Duelle eines Spielers,
Fragenauswahl je Kategorie, Bestenliste je Kategorie und Saison,
Freundesliste, Trefferquote je Spieler.

## Schema ändern

```sh
# 1. apps/api/src/db/schema.ts anpassen
bun run db:generate   # neue Migration unter apps/api/src/db/migrations erzeugen
bun run db:migrate    # lokal anwenden (in Produktion beim Start des API-Containers)
```

Bestehende Migrationen nicht nachträglich ändern, sondern immer eine neue
erzeugen.

## Ablauf im Zusammenspiel

1. **Duell erstellen** (`POST /api/duels`): `duels`-Zeile + 6 zufällige
   freigegebene Fragen (bei `gemischt` aus allen Kategorien) in
   `duel_questions`. Mit Gegner-Name ist `spieler_b_id` sofort gesetzt,
   ohne Gegner bekommt das Duell einen `einladungs_code`; wer damit
   beitritt (`POST /api/duels/beitreten`), wird Spieler B und der Code wird
   gelöscht.
2. **Frage abrufen** (`GET /api/duels/:id/frage`): legt beim ersten Abruf eine
   `duel_answers`-Zeile mit `gestellt_at` an (`ist_richtig` noch NULL) – das ist
   der Start des Timers. Erneutes Abrufen liefert dieselbe Frage mit der
   Restzeit, der Timer lässt sich also nicht durch Neuladen zurücksetzen.
3. **Antworten** (`POST /api/duels/:id/antwort`): füllt die offene Zeile.
   Kommt die Antwort später als 15 s (+ 2 s Toleranz) nach `gestellt_at`,
   zählt sie als falsch und `answer_option_id` bleibt leer.
4. Nach der 6. Antwort von A wechselt der Status zu `wartet_b`; B kann erst
   dann spielen. Nach der 6. Antwort von B wird das Duell `abgeschlossen` und
   **in derselben Transaktion gewertet**: ELO-Update für `gesamt` und – außer
   bei `gemischt` – für die Duell-Kategorie, `ratings` der laufenden Saison
   upserten (`duelle_gespielt` + 1), `gewertet_at` und die Änderung des
   Gesamt-Ratings (`rating_aenderung_a/b`) am Duell speichern. Hat ein Spieler
   noch kein Rating in der laufenden Saison, startet er mit dem Soft-Reset
   seines Vorsaison-Ratings (sonst 1000).
5. **Vorzeitiges Ende**: Aufgabe (`POST /api/duels/:id/aufgeben`) oder
   Fristablauf (Zug nicht innerhalb von 3 Tagen ab `zug_seit`) setzt
   `aufgegeben_von`, das Duell wird `abgeschlossen` und gewertet – der
   Aufgebende verliert unabhängig vom Punktestand. Ohne Gegner (offene
   Einladung, bzw. nach 7 Tagen nicht angenommen) wird es `abgebrochen`,
   ohne Wertung. `zug_seit` wird beim Wechsel zu B neu gesetzt, bei offener
   Einladung erst mit dem Beitritt.
6. **Sichtbarkeit**: Frage, Lösung und die Antwort des Gegners zu einer Frage
   liefert die API erst, nachdem man sie selbst beantwortet hat – das gilt auch
   für die Gegner-Punkte im Dashboard.
7. Statistik-Screen liest `duel_answers` gruppiert nach `kategorie` (Join
   über `questions`) für die Trefferquote.

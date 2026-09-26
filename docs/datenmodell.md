# Datenmodell: Halmduell

Maßgeblich ist das Drizzle-Schema in `apps/api/src/db/schema.ts`; das daraus
erzeugte SQL liegt unter `apps/api/src/db/migrations/`. Erlaubte Werte für
Kategorien und Status kommen aus `packages/shared` und werden zusätzlich per
CHECK-Constraint in der Datenbank abgesichert.

## Tabellen

| Tabelle | Schlüssel | Inhalt |
|---|---|---|
| `users` | `id` | Spieler, `username` eindeutig |
| `questions` | `id` | Frage mit `kategorie` (`kulturen`, `schaedlinge`, `krankheiten`, `wissen`), `typ` (`bild`/`text`), Bild-URL + Attribution, `schwierigkeit` 1–5, `erklaerung`, `status` (`entwurf`, `eingereicht`, `freigegeben`, `abgelehnt`), `eingereicht_von` |
| `answer_options` | `id` | Antwortoptionen je Frage, `ist_richtig` |
| `duels` | `id` | Duell zwischen `spieler_a_id` und `spieler_b_id`, `kategorie` (zusätzlich `gemischt`), `status` (`wartet_a`, `wartet_b`, `abgeschlossen`), `gewertet_at` nach dem ELO-Update |
| `duel_questions` | `duel_id`, `reihenfolge` | die 6 Fragen eines Duells (für beide Spieler identisch) |
| `duel_answers` | `duel_id`, `user_id`, `question_id` | Antwort je Spieler und Frage, `antwortzeit_ms`, `ist_richtig`; `answer_option_id` ist leer, wenn der Timer abgelaufen ist |
| `ratings` | `user_id`, `kategorie`, `saison` | ELO je Kategorie (`gesamt`, `kulturen`, `schaedlinge`, `krankheiten`, `wissen`) und Saison (fortlaufend, quartalsweise, Saison 1 = Q1 2026), `duelle_gespielt` |
| `friendships` | `user_id`, `friend_id` | Freundschaft, `status` (`angefragt`, `bestaetigt`) |
| `achievements` | `id` | Abzeichen, eindeutiger `key` (z. B. `schaedling_experte`) |
| `user_achievements` | `user_id`, `achievement_id` | erreichte Abzeichen mit Zeitpunkt |

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

1. Duell erstellen → `duels`-Zeile + 6 (zufällige oder kategoriegefilterte)
   Fragen in `duel_questions`.
2. Spieler A beantwortet → 6 Zeilen in `duel_answers` (bei abgelaufenem
   Timer ohne `answer_option_id`), Status wechselt zu `wartet_b`.
3. Spieler B beantwortet → weitere 6 Zeilen, Status wird `abgeschlossen`.
4. Bei Abschluss (in einer Transaktion): Punkte summieren, ELO-Update für
   `gesamt` und – außer bei `gemischt` – für die Duell-Kategorie berechnen,
   `ratings` der laufenden Saison upserten (`duelle_gespielt` + 1), danach
   `duels.gewertet_at` setzen. Ein zweiter Aufruf wird abgelehnt (409).
   Hat ein Spieler noch kein Rating in der laufenden Saison, startet er mit
   dem Soft-Reset seines Vorsaison-Ratings (sonst 1000).
5. Statistik-Screen liest `duel_answers` gruppiert nach `kategorie` (Join
   über `questions`) für die Trefferquote.

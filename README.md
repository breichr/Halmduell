# Halmduell

PWA-Quizduell-Spiel mit landwirtschaftlichen Fragen – Wissensfragen und
Bilderkennung (Kulturen, Krankheiten, Schädlinge). Spielprinzip angelehnt an
Quizduell: asynchrones 1v1, 6 Fragen pro Runde, danach Frage-für-Frage-Vergleich.

## Maskottchen

Ein grüner Grashüpfer/Heuschrecke, sitzt auf einem Getreidehalm (Wortspiel:
"Halm" + "Duell"), hält für Bilderkennungs-Fragen optional eine Lupe.

## Dokumente

- `docs/konzept.md` – Spielprinzip, Spielablauf, UX/Screens, Ranking-System
- `docs/architektur.md` – Tech-Stack, Projektstruktur, Deployment
- `docs/datenmodell.md` – Tabellen, Datenbank-Regeln, Schema-Änderungen
- `apps/api/src/db/schema.ts` – Drizzle-ORM-Schema (produktionsreif einsetzbar)
- `apps/api/src/services/elo.ts` – ELO-Rating-Logik
- `apps/api/src/routes/duels.ts` – Beispiel-Route für Duell-Abschluss

## Entwicklung

Voraussetzungen: [Bun](https://bun.sh) ≥ 1.3, Docker (für PostgreSQL).

```sh
bun install
cp .env.example apps/api/.env   # DATABASE_URL, JWT_SECRET, TEST_DATABASE_URL
bun run db:up                   # PostgreSQL per docker compose starten
bun run db:migrate              # Tabellen anlegen
bun run db:seed                 # Abzeichen + Beispielfragen
bun run dev                     # API (:3000) und Web (:5173) mit Hot Reload
```

Das Frontend leitet `/api/*` im Dev-Modus an die API weiter (siehe
`apps/web/vite.config.ts`).

| Befehl | Zweck |
|---|---|
| `bun run check` | Typecheck aller Pakete (tsc / svelte-check) |
| `bun run test` | Tests in `apps/api`; Integrationstests laufen nur mit `TEST_DATABASE_URL` (Test-DB wird geleert) |
| `bun run build` | Produktions-Build des Frontends |
| `bun run db:generate` / `db:migrate` | Migration aus dem Schema erzeugen / anwenden |
| `bun run db:seed` | Abzeichen und Beispielfragen einspielen (mehrfach ausführbar) |
| `docker compose up --build` | kompletter Stack in Containern (Web :3001, API :3000) |

## API-Authentifizierung

Anmeldung mit Benutzername + Passwort (argon2id). Die Session ist ein JWT
(HS256, 30 Tage) im httpOnly-Cookie `halmduell_session` – das Frontend muss
nichts speichern, der Browser schickt das Cookie bei `/api/*` automatisch mit.

| Endpunkt | Zweck |
|---|---|
| `POST /api/auth/register` | `{ username, password }` → User anlegen, anmelden, **Wiederherstellungscode** (nur einmal angezeigt) |
| `POST /api/auth/login` | `{ username, password }` → anmelden |
| `POST /api/auth/zuruecksetzen` | `{ username, code, neuesPasswort }` → Passwort vergessen; liefert neuen Code |
| `POST /api/auth/logout` | auf diesem Gerät abmelden |
| `POST /api/auth/logout-alle` | auf allen Geräten abmelden |
| `GET /api/auth/me` | aktueller User, sonst 401 |
| `POST /api/auth/passwort` | `{ altesPasswort, neuesPasswort }` → ändern, andere Geräte werden abgemeldet |
| `POST /api/auth/wiederherstellungscode` | `{ passwort }` → neuen Code erzeugen, der alte wird ungültig |

Es gibt bewusst keine E-Mail: Wer sein Passwort vergisst, setzt es mit dem
Wiederherstellungscode zurück (gespeichert nur als Hash). Jedes Token enthält
eine Session-Version; Passwortänderung, Zurücksetzen und „überall abmelden“
erhöhen sie und machen alte Tokens sofort ungültig.

Fehlversuche werden je IP + Konto (10 / 15 min) und je IP (50 / 15 min)
begrenzt – eine fremde IP kann niemanden aussperren.

In Produktion auf Coolify setzen: `JWT_SECRET` (geheim) und `TRUST_PROXY=true`,
damit die Client-IP aus `X-Forwarded-For` des Proxys gelesen wird.

## Duell-API

Alle Endpunkte erfordern eine Anmeldung.

| Endpunkt | Zweck |
|---|---|
| `GET /api/duels` | Dashboard: laufende + letzte 20 abgeschlossene Duelle, „du bist dran“ zuerst |
| `POST /api/duels` | `{ kategorie, gegner? }` → Duell gegen User (Name) oder offen mit Einladungscode |
| `POST /api/duels/beitreten` | `{ code }` → Einladung annehmen, man wird Spieler B |
| `GET /api/duels/:id` | Details + Frage-für-Frage-Vergleich |
| `GET /api/duels/:id/frage` | aktuelle Frage (startet den 15-s-Timer, Neuladen setzt ihn nicht zurück) |
| `POST /api/duels/:id/antwort` | `{ frageId, antwortId \| null }` → Ergebnis, Lösung, Erklärung |
| `POST /api/duels/:id/aufgeben` | aufgeben: Gegner gewinnt; offene Einladung wird ohne Wertung abgebrochen |

Ablauf: A beantwortet 6 Fragen, dann B dieselben 6. Nach Bs letzter Antwort
wird das Duell automatisch gewertet (ELO). Lösungen und Antworten des Gegners
sieht man erst, nachdem man die jeweilige Frage selbst beantwortet hat.

**Fristen:** Wer seinen Zug nicht innerhalb von 3 Tagen spielt, verliert (mit
ELO-Wertung). Nicht angenommene Einladungen verfallen nach 7 Tagen ohne
Wertung. Die API prüft das alle 10 Minuten und zusätzlich bei jedem Zug.

**Fragenauswahl:** bevorzugt Fragen, die keiner der beiden Spieler schon
hatte; `gemischt` verteilt die 6 Fragen reihum auf alle Kategorien.

**K-Faktor:** 40 für die ersten 20 Duelle eines Spielers in einer Kategorie
(über alle Saisons gezählt), danach 20.
Request- und Response-Typen liegen in `packages/shared/src/duell.ts`.

## Status

Backend für den Duell-Flow steht (Schritte 1–4 in `docs/architektur.md`).
Als Nächstes: Frontend-Screens.

## Offene Punkte

Noch zu entscheiden:

- Start von Saison 1 (aktuell fest Q1 2026, `apps/api/src/services/saison.ts`)
- Fragen-Pool: wer erstellt und prüft die Fragen fachlich? (bisher 6
  Beispielfragen – Kategorie-Duelle brauchen je ≥ 6 freigegebene Fragen)
- Routing auf Coolify: eine Domain mit `/api` → API-Container oder getrennte
  Domains

Bewusst später:

- Matchmaking für Zufallsgegner (MVP: nur Freund-Einladung per Code/Link)
- Community-Fragen-Einreichung (geplant, aber erst nach MVP)
- Visuelles Gesamtkonzept fürs Maskottchen (Farbrichtung/Stil grob skizziert,
  finales Design noch offen)

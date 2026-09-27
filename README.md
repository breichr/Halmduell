# Halmduell

PWA-Quizduell-Spiel mit landwirtschaftlichen Fragen – Wissensfragen und
Bilderkennung (Kulturen, Krankheiten, Schädlinge). Spielprinzip angelehnt an
Quizduell: asynchrones 1v1, 6 Fragen pro Runde, danach Frage-für-Frage-Vergleich.

## Maskottchen und Design

**Halmi**, ein grüner Grashüpfer auf einem Getreidehalm (Wortspiel:
"Halm" + "Duell"). Er ist als Svelte-Komponente umgesetzt
(`apps/web/src/lib/components/Halmi.svelte`) mit sechs Posen: `winken`,
`lupe` (Bildfragen), `jubeln` (richtig, Sieg), `traurig` (falsch, Niederlage),
`schlafen` (Gegner am Zug), `denken` (neues Duell, leere Listen). Die Zeichnung
ist ein Entwurf – eine finale Illustration ersetzt nur diese eine Datei.

Design „Heuschreck“: verspielt, dicke Konturen, „drückbare“ Knöpfe,
Himmel-und-Wiesen-Landschaft, Schriften Baloo 2 + Nunito (selbst gehostet,
nur lateinisch, 3 Schnitte ≈ 60 KB). Farben und Hell/Dunkel stehen als Tokens in
`apps/web/src/app.css`. Antwortkacheln unterscheiden sich zusätzlich zur Farbe
durch Formen (Kreis, Dreieck, Quadrat, Raute).

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
bun run db:seed                 # Abzeichen
bun run fragen:import           # Fragen aus fragen/fragen.csv
bun run dev                     # API (:3000) und Web (:5173) mit Hot Reload
```

Der Web-Server reicht `/api/*` an die API weiter (`apps/web/src/hooks.server.ts`,
Ziel über `API_URL`, Standard `http://localhost:3000`) – im Dev-Modus wie in
Produktion. Der Browser spricht also immer nur mit einer Domain.

| Befehl | Zweck |
|---|---|
| `bun run check` | Typecheck aller Pakete (tsc / svelte-check) |
| `bun run test` | Tests in `apps/api`; Integrationstests laufen nur mit `TEST_DATABASE_URL` (Test-DB wird geleert) |
| `bun run build` | Produktions-Build des Frontends |
| `bun run test:e2e` | Playwright-Tests: zwei Spieler spielen ein Duell durch die echte Oberfläche (braucht `TEST_DATABASE_URL`, startet API + Web selbst) |
| `bun run db:generate` / `db:migrate` | Migration aus dem Schema erzeugen / anwenden |
| `bun run db:seed` | Abzeichen einspielen (mehrfach ausführbar) |
| `bun run fragen:pruefen` / `fragen:import` | Fragenkatalog prüfen / importieren, siehe [`fragen/README.md`](fragen/README.md) |
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

Einrichtung in Produktion: siehe [Deployment](#deployment-coolify).

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

**Saisons:** Kalenderquartale (Q1 = 1.1.–31.3. usw.), Wechsel um Mitternacht
deutscher Zeit; Saison 1 = Q1 2026. `saisonBezeichnung()` in
`packages/shared` liefert den Anzeigenamen („Q3 2026“).

**K-Faktor:** 40 für die ersten 20 Duelle eines Spielers in einer Kategorie
(über alle Saisons gezählt), danach 20.
Request- und Response-Typen liegen in `packages/shared/src/duell.ts`.

## Rangliste

| Endpunkt | Zweck |
|---|---|
| `GET /api/rangliste?kategorie=gesamt&saison=3` | Bestenliste einer Kategorie (`gesamt`, `kulturen`, `schaedlinge`, `krankheiten`, `wissen`) und Saison; ohne `saison` die laufende |
| `GET /api/rangliste?kreis=freunde` | dasselbe nur für mich und meine bestätigten Freunde (Plätze innerhalb dieses Kreises) |

Liefert die ersten 100 Plätze, den eigenen Platz (auch wenn er weiter hinten
liegt), die Zahl der Platzierten und alle Saisons mit Ergebnissen (für das
Archiv). Platziert ist, wer in der Saison in der Kategorie mindestens ein
gewertetes Duell hat; gleiches Rating = gleicher Platz. Die Liga (Bronze bis
Meister) kommt aus `liga()` in `packages/shared`. Oberfläche: `/rangliste`
mit Umschalter „Alle Spieler / Freunde“, Podest, Kategorien und Saisonauswahl.
Typen: `packages/shared/src/rangliste.ts`.

## Freunde

| Endpunkt | Zweck |
|---|---|
| `GET /api/freunde` | Freunde (mit Gesamt-Rating der Saison und laufendem gemeinsamen Duell), Anfragen an mich, eigene offene Anfragen, Vorschläge (zuletzt gespielte Gegner) |
| `GET /api/freunde/anfragen/anzahl` | Zahl offener Anfragen an mich (Punkt in der Navigation) |
| `POST /api/freunde` | `{ username }` anfragen; hatte die andere Seite schon angefragt, seid ihr sofort befreundet |
| `POST /api/freunde/:id/annehmen` | Anfrage von `:id` annehmen |
| `DELETE /api/freunde/:id` | Anfrage ablehnen/zurückziehen oder Freundschaft beenden |

Je Paar gibt es genau eine Zeile in `friendships` (Unique-Index auf
`least/greatest`), höchstens 30 unbeantwortete Anfragen gleichzeitig.
Oberfläche: `/freunde` mit „Herausfordern“ (füllt den Gegner beim neuen Duell
vor) bzw. „Du bist dran“, wenn schon ein Duell läuft. Typen:
`packages/shared/src/freunde.ts`.

## Statistik

| Endpunkt | Zweck |
|---|---|
| `GET /api/statistik` | eigene Bilanz (Siege/Unentschieden/Niederlagen), Form der letzten 10 Duelle, aktuelle Serie, Trefferquote gesamt und je Fragenkategorie, Ø Zeit bis zur richtigen Antwort, Ratings der laufenden Saison |

Bilanz und Form zählen gewertete (abgeschlossene) Duelle – Aufgabe bzw.
Fristablauf entscheidet wie bei der Wertung unabhängig von den Punkten. Die
Trefferquote zählt jede beantwortete Frage nach ihrer eigenen Kategorie, auch
aus abgebrochenen Duellen; abgelaufene Zeit zählt als falsch. Oberfläche: oben
im Profil, mit Hinweis auf Stärke und Übungsbedarf (ab 5 Fragen je Kategorie).
Typen: `packages/shared/src/statistik.ts`.

## App & offline (PWA)

Halmduell lässt sich wie eine App installieren (Android/Chrome: Knopf
„Installieren“ auf der Übersicht bzw. im Profil; iPhone: Teilen → Zum
Home-Bildschirm).

- `apps/web/static/manifest.webmanifest`: Name, Farben, Icons, Kurzbefehl
  „Neues Duell“
- `apps/web/src/service-worker.ts`: speichert die App-Shell (JS, CSS,
  Schriften, Icons) für einen schnellen Start. **API-Antworten werden nie
  gecacht.** Ohne Netz zeigt er `static/offline.html`.
- Neue Version: die App prüft alle 5 Minuten und zeigt „Neue Version verfügbar –
  Neu laden“; der neue Service Worker übernimmt erst nach dem Tippen, nie mitten
  im Spiel.
- Icons: Quelle `apps/web/static/icons/icon*.svg`; PNGs neu erzeugen mit
  `cd apps/web && node scripts/icons-erzeugen.mjs` (nutzt das Chromium von
  Playwright; die PNGs sind eingecheckt).

Service Worker funktionieren nur über HTTPS (Coolify liefert das) oder auf
`localhost`.

## Deployment (Coolify)

Eine Domain für alles: Nur der **Web**-Service bekommt eine öffentliche
Domain; er reicht `/api/*` intern an den **API**-Service weiter. Die API
selbst braucht keine Domain.

| Service | Dockerfile | Umgebungsvariablen |
|---|---|---|
| PostgreSQL | Coolify-Datenbank | – |
| API | `Dockerfile.api` | `DATABASE_URL` (Internal URL der Datenbank), `JWT_SECRET` (geheim, `openssl rand -base64 48`), `TRUST_PROXY=true` |
| Web | `Dockerfile.web` | `API_URL=http://halmduell-api:3000`, `ORIGIN` (öffentliche URL, z. B. `https://halmduell.example`) |

Beim API-Service unter **Configuration → General** das Feld **Domains** leer
lassen und **Network Aliases** auf `halmduell-api` setzen – der generierte
Containername ändert sich mit jedem Deployment, der Alias nicht. Bei beiden
Services **Ports Exposes** = `3000`.

**Health-Check:** Ist unter **Configuration → Healthcheck** der Check im
Dashboard aktiv, verwendet Coolify diesen – nicht den `HEALTHCHECK` aus dem
Dockerfile. Dort **Host** auf `127.0.0.1` setzen, nicht `localhost`: Auf dem
Server löst `localhost` im Container vermutlich zu `::1` (IPv6) auf, die
Server lauschen aber nur auf IPv4 – der Check schlägt dann mit „Connection
refused“ fehl und Coolify rollt das Deployment zurück.

| Service | Host | Port | Pfad |
|---|---|---|---|
| API | `127.0.0.1` | `3000` | `/api/health` |
| Web | `127.0.0.1` | `3000` | `/` |

Alternativ den Dashboard-Check deaktivieren; dann greift der `HEALTHCHECK`
aus dem Dockerfile, der bereits `127.0.0.1` verwendet.

Beim Start wendet die API ausstehende Migrationen an und importiert
`fragen/fragen.csv`. `TRUST_PROXY=true` ist richtig, solange die API nur über
den Web-Service erreichbar ist (keine eigene öffentliche Domain) – sonst
könnten Clients ihre IP für die Rate-Limits fälschen.

## Status

Duell-Flow steht Ende-zu-Ende, Backend und Oberfläche, installierbar als
App (Schritte 1–6 in `docs/architektur.md`). Screens: Anmelden/Registrieren/Passwort vergessen,
Übersicht, neues Duell (Benutzername oder Einladungslink), Einladung annehmen,
Frage mit Timer, Frage-für-Frage-Vergleich, Rangliste (je Kategorie und
Saison, mit Archiv und Freunde-Ansicht), Freunde, Profil mit Statistik. Als
Nächstes: Abzeichen.

## Offene Punkte

- Fragenkatalog füllen (`fragen/fragen.csv`, kuratiert): bisher 6
  Beispielfragen – Kategorie-Duelle brauchen je ≥ 6 freigegebene Fragen

Bewusst später:

- Matchmaking für Zufallsgegner (MVP: nur Freund-Einladung per Code/Link)
- Community-Fragen-Einreichung (geplant, aber erst nach MVP)
- Visuelles Gesamtkonzept fürs Maskottchen (Farbrichtung/Stil grob skizziert,
  finales Design noch offen)

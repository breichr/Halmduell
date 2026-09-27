# Halmduell

PWA-Quizduell-Spiel mit landwirtschaftlichen Fragen aus Landtechnik,
Pflanzenbau und Viehzucht – Wissensfragen und Bilderkennung. Spielprinzip angelehnt an
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
| `GET /api/rangliste?kategorie=gesamt&saison=3` | Bestenliste einer Kategorie (`gesamt`, `landtechnik`, `pflanzenbau`, `viehzucht`) und Saison; ohne `saison` die laufende |
| `GET /api/rangliste?kreis=freunde` | dasselbe nur für mich und meine bestätigten Freunde (Plätze innerhalb dieses Kreises) |

Liefert die ersten 100 Plätze, den eigenen Platz (auch wenn er weiter hinten
liegt), die Zahl der Platzierten und alle Saisons mit Ergebnissen (für das
Archiv). Platziert ist, wer in der Saison in der Kategorie mindestens ein
gewertetes Duell hat; gleiches Rating = gleicher Platz. Die Liga (Bronze bis
Meister) kommt aus `liga()` in `packages/shared`. Oberfläche: `/rangliste`
mit Umschalter „Alle Spieler / Freunde“, Podest, Kategorien und Saisonauswahl.
**Veränderung seit gestern** (▲ 2 / ▼ 1): Der Fristen-Job hält einmal am Tag
(kurz nach Mitternacht, deutsche Zeit) die Plätze der laufenden Saison in
`platz_verlauf` fest (30 Tage aufbewahrt); verglichen wird nur in „Alle
Spieler“ der laufenden Saison (`veraenderung` je Eintrag).
Typen: `packages/shared/src/rangliste.ts`.

## Freunde

| Endpunkt | Zweck |
|---|---|
| `GET /api/freunde` | Freunde (mit Gesamt-Rating der Saison und laufendem gemeinsamen Duell), Anfragen an mich, eigene offene Anfragen, Vorschläge (zuletzt gespielte Gegner) |
| `GET /api/freunde/anfragen/anzahl` | Zahl offener Anfragen an mich (Punkt in der Navigation) |
| `POST /api/freunde` | `{ username }` anfragen; hatte die andere Seite schon angefragt, seid ihr sofort befreundet |
| `POST /api/freunde/:id/annehmen` | Anfrage von `:id` annehmen |
| `DELETE /api/freunde/:id` | Anfrage ablehnen/zurückziehen oder Freundschaft beenden |

Freunde sehen, wann jemand zuletzt aktiv war („gerade aktiv“ mit grünem
Punkt, „vor 3 Std. aktiv“, „gestern aktiv“): `users.zuletzt_aktiv_at` wird bei
angemeldeten Anfragen gesetzt, höchstens alle 5 Minuten.

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

## Abzeichen

| Endpunkt | Zweck |
|---|---|
| `GET /api/abzeichen` | alle Abzeichen mit „erreicht am“ bzw. Fortschritt (z. B. 23 / 50) |

Katalog: `packages/shared/src/abzeichen.ts` (Meilensteine, Fachwissen je
Kategorie, Saison, besondere Momente). Die `key`s sind dauerhaft, Titel und
Texte dürfen sich ändern. Vergeben wird automatisch nach jedem gewerteten Duell
(für beide Spieler) und beim Annehmen einer Freundschaft; Saison-Abzeichen
(Top 10 / Platz 1 Gesamt einer abgeschlossenen Saison) beim nächsten Abruf der
Liste. Durch ein Duell erreichte Abzeichen erscheinen im Ergebnis
(„Neues Abzeichen!“, `neueAbzeichen` in `GET /api/duels/:id`). Oberfläche: im
Profil, nicht erreichte ausgegraut mit Beschreibung und Fortschritt.
`bun run db:seed` bringt Titel/Texte in der Tabelle auf Stand (fehlende Zeilen
legt die API beim Vergeben selbst an).

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

## Fehler üben

Fragen, die man im Duell falsch beantwortet hat (auch „Zeit abgelaufen“),
landen zum Nachlernen unter `/ueben` – ohne Timer und ohne Wertung, alle oder
je Kategorie. Nach **2× richtig in Folge** gilt eine Frage als gemeistert; ein
neuer Fehler im Duell holt sie zurück. Einstieg: Karte auf der Übersicht,
„Übungsbedarf“ in der Statistik; Abzeichen „Nachgelernt“ für 10 gemeisterte.

| Endpunkt | Zweck |
|---|---|
| `GET /api/ueben` | offene Fragen gesamt und je Kategorie, bisher gemeistert |
| `GET /api/ueben/frage?kategorie=&ohne=` | nächste Frage (am längsten nicht geübt zuerst, `ohne` = zuletzt geübte) oder `frage: null` |
| `POST /api/ueben/antwort` | `{ frageId, antwortId }` → richtig?, Lösung, Erklärung, gemeistert?, noch offen |

Beantworten lassen sich nur Fragen, die gerade zum Üben offen sind – so
lässt sich über das Üben keine Lösung einer laufenden Duell-Frage nachschlagen.
Stand je Frage: Tabelle `uebungen`.

## Admin-Portal (Fragen pflegen)

Unter `/admin` (Link im Profil) prüfen, bearbeiten und freigeben Admins die
Fragen: Übersicht je Kategorie (Warnung unter 6 freigegebenen), Filter
Entwürfe/Freigegeben/Abgelehnt, Suche in Frage, Antworten und Code,
Freigeben/Ablehnen mit einem Tipp, Bearbeiten mit Vorschau wie im Spiel,
neue Fragen (Code wird je Kategorie vergeben) und **CSV-Export** im Format
von `fragen/fragen.csv`.

- **Die Datenbank ist maßgeblich.** Beim Deploy kommen aus `fragen.csv` nur
  Fragen mit neuem `code` hinzu; vorhandene bleiben, wie sie im Portal
  gepflegt sind. Zum Sichern oder Versionieren den Export herunterladen und
  bei Bedarf als `fragen/fragen.csv` committen. Einmalig alles aus der Datei
  übernehmen: `bun run fragen:import -- --ueberschreiben`.
- **Admins:** `ADMIN_USERNAMES=anna,ben` beim API-Service (Groß-/Kleinschreibung
  egal); wirkt nach dem Neustart. Alle `/api/admin/*`-Endpunkte antworten
  sonst mit 403.
- Bearbeiten ändert die Antwortoptionen an Ort und Stelle (gespielte Duelle
  bleiben gültig); bei inhaltlich anderer Frage besser eine neue anlegen und
  die alte ablehnen.

| Endpunkt | Zweck |
|---|---|
| `GET /api/admin/fragen?status=&kategorie=&suche=` | Fragen mit Antworten und Duell-Statistik, Übersicht je Kategorie |
| `GET /api/admin/fragen/:id` / `PUT …` | eine Frage lesen / bearbeiten |
| `POST /api/admin/fragen` | neue Frage |
| `POST /api/admin/fragen/:id/status` | `{ status }` freigeben, ablehnen, Entwurf |
| `GET /api/admin/fragen.csv` | Export aller Fragen |
| `POST /api/admin/commons` | `{ link }` zu einer Datei auf Wikimedia Commons → Bild-URL (1024 px), Urheber, Lizenz, Dateiseite |

**Bildfragen:** Im Formular „Bildfrage“ anhaken und den Link zur Datei auf
Wikimedia Commons einfügen (Dateiseite, Wikipedia-Medienansicht oder direkter
Bildlink) – Bild-URL und „Urheber, Lizenz, Wikimedia Commons“ werden
übernommen. Die Lizenz auf der verlinkten Dateiseite kurz prüfen. Die API
braucht dafür Zugang zu `commons.wikimedia.org`, die Spieler laden das Bild von
`upload.wikimedia.org`.

## Benachrichtigungen (Web Push)

Push-Nachrichten, wenn jemand herausfordert bzw. man dran ist, ein Duell
endet (Ergebnis, Aufgabe, verpasste Frist), der eigene Zug nur noch 24 Stunden
läuft, bei Freundschaftsanfragen – und beim **Anstupsen**: Wer auf den Gegner
wartet, kann ihn höchstens alle 12 Stunden erinnern.

Einrichten (einmalig, danach nicht mehr ändern – neue Schlüssel machen alle
Abos ungültig; die App meldet Geräte dann beim nächsten Öffnen neu an):

```sh
cd apps/api && bun run push:schluessel
# VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY und VAPID_SUBJECT (mailto:…) beim API-Service setzen
```

Ohne diese Variablen ist Web Push aus und die Oberfläche blendet es aus.
Eingeschaltet wird je Gerät im Profil (oder über den Hinweis auf der
Übersicht). Auf dem iPhone geht das nur in der installierten App (iOS 16.4+).

| Endpunkt | Zweck |
|---|---|
| `GET /api/push/schluessel` | öffentlicher VAPID-Schlüssel (`null` = aus) |
| `POST /api/push/abo` / `DELETE /api/push/abo` | Gerät an-/abmelden (`PushSubscription.toJSON()` bzw. `{ endpoint }`) |
| `POST /api/duels/:id/anstupsen` | Gegner am Zug erinnern; `zugestellt: false`, wenn er keine Benachrichtigungen an hat |

Nachrichten gehen erst nach dem Commit raus und blockieren keine Anfrage;
vom Push-Dienst abgelehnte Abos (404/410) werden gelöscht. Texte:
`apps/api/src/services/benachrichtigungen.ts`.

## Deployment (Coolify)

Eine Domain für alles: Nur der **Web**-Service bekommt eine öffentliche
Domain; er reicht `/api/*` intern an den **API**-Service weiter. Die API
selbst braucht keine Domain.

| Service | Dockerfile | Umgebungsvariablen |
|---|---|---|
| PostgreSQL | Coolify-Datenbank | – |
| API | `Dockerfile.api` | `DATABASE_URL` (Internal URL der Datenbank), `JWT_SECRET` (geheim, `openssl rand -base64 48`), `TRUST_PROXY=true`, `ADMIN_USERNAMES` (Admin-Portal, kommagetrennt), optional `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (Web Push, siehe unten) |
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

Beim Start wendet die API ausstehende Migrationen an und importiert aus
`fragen/fragen.csv` die Fragen mit neuem `code` (vorhandene pflegt das
Admin-Portal). `TRUST_PROXY=true` ist richtig, solange die API nur über
den Web-Service erreichbar ist (keine eigene öffentliche Domain) – sonst
könnten Clients ihre IP für die Rate-Limits fälschen.

## Status

Duell-Flow steht Ende-zu-Ende, Backend und Oberfläche, installierbar als
App (Schritte 1–6 in `docs/architektur.md`). Screens: Anmelden/Registrieren/Passwort vergessen,
Übersicht, neues Duell (Benutzername oder Einladungslink), Einladung annehmen,
Frage mit Timer, Frage-für-Frage-Vergleich, Rangliste (je Kategorie und
Saison, mit Archiv und Freunde-Ansicht), Freunde, Profil mit Statistik und
Abzeichen, Fehler üben, Benachrichtigungen, Admin-Portal für Fragen.

## Offene Punkte

- Fragenkatalog prüfen und freigeben (im Admin-Portal unter „Entwürfe“): 6
  freigegebene Beispielfragen, dazu 134 Entwürfe (davon 34 Bildfragen).
  Kategorie-Duelle brauchen je ≥ 6 freigegebene Fragen
- Fragen für **Landtechnik** (bisher 3) und **Viehzucht** (bisher 1) schreiben –
  nach der Umstellung stammen fast alle Fragen aus Pflanzenbau
- Admin-Portal erweitern: eingereichte Community-Fragen moderieren,
  Admins im Portal verwalten statt per `ADMIN_USERNAMES`

- Fragen melden: nach dem Duell eine Frage melden können, wenn die als richtig
  gewertete Antwort falsch erscheint (optional mit Begründung); Meldungen im
  Admin-Portal sichten, Frage korrigieren oder zurückziehen

Bewusst später:

- Matchmaking für Zufallsgegner (MVP: nur Freund-Einladung per Code/Link)
- Community-Fragen-Einreichung (geplant, aber erst nach MVP)
- Visuelles Gesamtkonzept fürs Maskottchen (Farbrichtung/Stil grob skizziert,
  finales Design noch offen)

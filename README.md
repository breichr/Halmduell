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
cp .env.example apps/api/.env   # DATABASE_URL für API und drizzle-kit
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
| `bun run test` | Unit-Tests (`bun test` in `apps/api`) |
| `bun run build` | Produktions-Build des Frontends |
| `bun run db:generate` / `db:migrate` | Migration aus dem Schema erzeugen / anwenden |
| `bun run db:seed` | Abzeichen und Beispielfragen einspielen (mehrfach ausführbar) |
| `docker compose up --build` | kompletter Stack in Containern (Web :3001, API :3000) |

## Status

Monorepo-Grundgerüst und Datenbank-Migrationen stehen (Schritte 1–2 in
`docs/architektur.md`). Als Nächstes: Auth, Duell-Flow.

## Offene Punkte (bewusst noch nicht entschieden)

- Matchmaking für Zufallsgegner (MVP: nur Freund-Einladung per Code/Link)
- Community-Fragen-Einreichung (geplant, aber erst nach MVP)
- Visuelles Gesamtkonzept fürs Maskottchen (Farbrichtung/Stil grob skizziert,
  finales Design noch offen)

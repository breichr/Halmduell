# Architektur: Halmduell

## Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Frontend | SvelteKit (Svelte 5 Runes) | kleinste Bundles, beste PWA-Performance auf Mobilgeräten |
| Runtime | Bun | schnell, natives TypeScript ohne Build-Schritt |
| Backend/API | Hono.js | modern, minimal, TypeScript-first, läuft auf Bun |
| ORM/DB | Drizzle ORM + PostgreSQL | typsicher, kein separater Codegen-Schritt |
| PWA-Tooling | vite-plugin-pwa | Standard für Svelte/Vite, Service Worker + Manifest |
| Auth | JWT (z. B. via Lucia oder eigene Middleware) | leichtgewichtig, kein Vendor-Lock-in |
| Notifications | Web Push | reicht für asynchrones Spiel, kein WebSocket-Server nötig |
| Bilder-Storage | Wikimedia-Referenzen (extern), später ggf. MinIO für Community-Uploads | spart initialen Storage-Aufwand |
| Deployment | Coolify (Docker-Container) | bereits vorhandene Infrastruktur |

## Projektstruktur (Monorepo, Bun-Workspaces)

```
halmduell/
├── apps/
│   ├── web/                      # SvelteKit-Frontend (PWA)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── +layout.svelte
│   │   │   │   ├── +page.svelte           # Dashboard
│   │   │   │   ├── duell/
│   │   │   │   │   ├── neu/+page.svelte    # Kategorie-Auswahl
│   │   │   │   │   └── [id]/+page.svelte   # Frage-Screen / Vergleich
│   │   │   │   ├── profil/+page.svelte
│   │   │   │   ├── freunde/+page.svelte
│   │   │   │   └── ranking/+page.svelte
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── QuestionCard.svelte
│   │   │   │   │   ├── AnswerTile.svelte
│   │   │   │   │   ├── DuelResultRow.svelte
│   │   │   │   │   └── Badge.svelte
│   │   │   │   ├── stores/            # Svelte-Stores (z. B. aktuelles Duell)
│   │   │   │   └── api.ts             # Fetch-Wrapper für Hono-Backend
│   │   │   └── app.html
│   │   ├── static/
│   │   │   ├── manifest.json           # PWA-Manifest
│   │   │   └── icons/
│   │   └── vite.config.ts              # inkl. vite-plugin-pwa
│   │
│   └── api/                      # Hono-Backend
│       ├── src/
│       │   ├── index.ts                # Hono-App-Einstieg
│       │   ├── routes/
│       │   │   ├── duels.ts
│       │   │   ├── questions.ts
│       │   │   ├── ratings.ts
│       │   │   ├── friends.ts
│       │   │   └── auth.ts
│       │   ├── services/
│       │   │   ├── elo.ts              # ELO-Update-Logik
│       │   │   └── matchmaking.ts
│       │   ├── db/
│       │   │   ├── schema.ts           # Drizzle-Schema
│       │   │   ├── client.ts
│       │   │   └── migrations/
│       │   └── middleware/
│       │       └── auth.ts
│       └── package.json
│
├── packages/
│   └── shared/                   # geteilte Types zwischen Frontend/Backend
│       └── src/index.ts           # Kategorien, Status-Typen, API-Antworten
│
├── docker-compose.yml             # lokale Entwicklung (Postgres + beide Apps)
├── Dockerfile.web
├── Dockerfile.api
└── package.json                   # Workspace-Root (Bun-Workspaces)
```

## Deployment auf Coolify

Zwei separate Container: Frontend (SvelteKit-Adapter, statisch oder Node-
Adapter) und Backend (Bun-Prozess mit Hono), plus PostgreSQL als eigener
Coolify-Service. Beide unabhängig deploybar.

## Nächste Implementierungsschritte

1. ~~Monorepo-Grundgerüst anlegen (Bun-Workspaces, siehe Struktur oben)~~ ✓
2. ~~`apps/api/src/db/schema.ts` einspielen, Migrationen generieren
   (`bunx drizzle-kit generate` / `migrate`)~~ ✓
3. Basis-Auth (JWT) implementieren
4. Duell-Flow (Erstellen → Beantworten → Abschluss inkl. ELO-Update) als
   erste vertikale Funktionsscheibe umsetzen
5. Frontend-Screens gemäß `konzept.md` (Dashboard, Frage-Screen,
   Ergebnisvergleich) aufbauen
6. PWA-Manifest + Service Worker einrichten

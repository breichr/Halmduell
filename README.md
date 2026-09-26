# Halmduell

PWA-Quizduell-Spiel mit landwirtschaftlichen Fragen – Wissensfragen und
Bilderkennung (Kulturen, Krankheiten, Schädlinge). Spielprinzip angelehnt an
Quizduell: asynchrones 1v1, 6 Fragen pro Runde, danach Frage-für-Frage-Vergleich.

## Maskottchen

Ein grüner Grashüpfer/Heuschrecke, sitzt auf einem Getreidehalm (Wortspiel:
"Halm" + "Duell"), hält für Bilderkennungs-Fragen optional eine Lupe.

## Dokumente in diesem Ordner

- `docs/konzept.md` – Spielprinzip, Spielablauf, UX/Screens, Ranking-System
- `docs/architektur.md` – Tech-Stack, Projektstruktur, Deployment
- `docs/datenmodell.md` – Entitäten und Beziehungen (Überblick zum Schema)
- `apps/api/src/db/schema.ts` – Drizzle-ORM-Schema (produktionsreif einsetzbar)
- `apps/api/src/services/elo.ts` – ELO-Rating-Logik
- `apps/api/src/routes/duels.ts` – Beispiel-Route für Duell-Abschluss

## Status

Konzeptphase abgeschlossen. Bereit für Implementierungsstart (Projekt-Setup,
Datenbank-Migrationen, erste Screens).

## Offene Punkte (bewusst noch nicht entschieden)

- Matchmaking für Zufallsgegner (MVP: nur Freund-Einladung per Code/Link)
- Community-Fragen-Einreichung (geplant, aber erst nach MVP)
- Visuelles Gesamtkonzept fürs Maskottchen (Farbrichtung/Stil grob skizziert,
  finales Design noch offen)

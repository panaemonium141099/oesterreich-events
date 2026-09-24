# Ortsdaten: ein System

## Goal & Context
Falsche Orte (2026-09-24) kamen aus vier Gemeindelisten mit eigenen PLZ-/Bezirks-/Koordinaten-Kopien (verrutschter Vorarlberg-Block, 40 geteilte Websites), aus Schreibwegen am Resolver vorbei und aus Alt-Skripten. Ziel: genau ein Stammdaten-Satz, genau ein Schreibweg, keine Pflaster-Skripte.

## Architecture & Data Models
- Stammdaten: `data/plz-at.json` (RTR/Post) + `data/gemeinden-registry/*` (Gemeinden), Zugriff nur über `src/lib/location/gemeinde-index.ts`. CI prüft Registry gegen Post-Tabelle.
- Scraper-Gemeindelisten tragen nur Identität (Name, Bundesland, Website/URL); `gemeindeContextFor()` liefert PLZ/Bezirk/Koordinaten aus den Stammdaten.
- Schreibweg: `supabase-sync` (buildEventRow + resolveEventLocation). Einreichungen, Nutzer-Events, Lineup-Events laufen darüber.
- Bezirk = aus belegter Gemeinde/PLZ, Scraper-Bezirk nur Hinweis.
- URL-Ort = Post-Ort der PLZ (PR #246).

## Edge Cases & Constraints
Geteilte PLZ (4040 Linz/Lichtenberg), Statutarstädte, Wiener Bezirke, Gemeinden ohne eigenes Postamt. PostgREST-Chunks ≤200.

## Acceptance Criteria
- [ ] Keine Gemeindeliste enthält eigene PLZ/Bezirk/Koordinaten
- [ ] Registry-vs-Post-Test grün
- [ ] Kein Event-Schreibweg am Resolver vorbei
- [ ] Legacy-Normalizer, GeoNames, Fix-/Backfill-Skripte gelöscht
- [ ] Bestehende Events mit neuer Bezirksregel neu entschieden; 48 Waisen gelöscht

## Boundaries
Scraper-Parsing selbst, Karten-/UI-Darstellung.

## Decision Context
Pflaster pro Fehler haben die Drift nicht verhindert; nur eine Quelle je Fakt verhindert sie.

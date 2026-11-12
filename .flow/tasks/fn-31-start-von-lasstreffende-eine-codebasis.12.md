# fn-31-start-von-lasstreffende-eine-codebasis.12 Startseite, /entdecken und Karte auf .de

## Description
Startseite, /entdecken und Karte auf .de: nur Sektionen mit DE-Datenquelle, Karte mit dem Snapshot des Landes.

**Size:** M
**Files:** `src/lib/v4/get-landing-data.ts`, `src/lib/v4/landing-picks.ts`, `src/lib/v4/map-static-url.ts`, `src/lib/landing/weekend-weather.ts`, `src/app/[locale]/page.tsx`, Komponenten unter `src/components/Landing/v4/`, Karten-Startausschnitt, `src/lib/hubs/shelf-pool.ts`

## Approach
- Sektionen je Site: Programm heute, Wochenende, Regionen, Karte bleiben; Tipp des Tages bezahlt, Saison-Karte, Künstler live, Festivals und Blog, Aktivitäten, Newsletter, Veranstalter-Zeile entfallen auf .de (kein leerer Platz).
- `landing_features` hat keine Länderspalte: auf .de nicht gelesen.
- Wetter und Kartenmittelpunkt: Standardort je Site (Wien bzw. ein Ort für DE als Wert in der Site, Entscheidung im PR begründen). `vienna-day.ts` bleibt, die Regeln der Zeitzonen sind gleich.
- Regionen-Regal: Länder der Site.
- Karte: Startausschnitt und Grenzen je Site; Snapshot aus Task 8.
- Build-Geduld (`LANDING_RETRY_DELAYS_MS.build`) und Warm-on-Start gelten je Container unverändert.

## Key context
- Kein `cookies()` und kein `headers()` im RSC-Pfad der Startseite.
- Der Build rendert Sektionen still leer, wenn eine Abfrage in den Statement-Timeout läuft: DE-Abfragen brauchen einen `EXPLAIN`-Beleg.
## Acceptance
- [ ] `SITE_COUNTRY=DE`: Startseite zeigt nur DE-Events und nur Sektionen mit Quelle; kein Verweis auf abgeschaltete Bereiche
- [ ] `SITE_COUNTRY=AT`: Startseite unverändert (bestehende Tests, Vergleichsskript)
- [ ] Karte auf .de startet über Deutschland und lädt den DE-Snapshot
- [ ] `EXPLAIN` der DE-Startseiten-Abfragen im PR, keine über der Zeitgrenze
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

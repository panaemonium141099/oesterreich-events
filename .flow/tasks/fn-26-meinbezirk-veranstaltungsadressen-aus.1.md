# MeinBezirk: Event-Ortsdaten

## Description
Event.location aus JSON-LD und die sichtbare Event-Ortszeile auswerten. Venue, Adresse, PLZ und city getrennt uebernehmen. Explizite Listing-Ortschaft als Fallback behalten. Alle Events mit drei Workern anreichern und Laufzeitbudget anpassen.

## Acceptance
- [x] Strukturierte Adresse und sichtbare Ortszeile fuer Hauptplatz/Amstetten, Bruck und Pfarrhof/Gansbach abgedeckt.
- [x] Keine PLZ aus Footer, Organizer oder Jahreszahl.
- [x] Detailfehler lassen Listingdaten bestehen; Events nach Nummer 500 werden angereichert.
- [x] Regressionstests und gezielter TypeScript-Check erfolgreich; externe Testfehler dokumentiert.

## Done summary
MeinBezirk location extraction now reads Event.location JSON-LD (arrays/graphs), falls back to the event location row, and passes venue/address/postcode/city to ScrapedEvent. Listing locality preserved. Removed unsafe body postcode matching and 500-event cap; three workers and adjusted runtime budget.
Verified on three downloaded source pages: Feuerwehrfest Amstetten (Anzengruberstrasse 1, 3300), Genussmeile Amstetten (Hauptplatz, 3300), Vortrag Gansbach (Marktplatz 1, 3122).
11 new regression tests pass. Combined relevant suite: 85 passed, four pre-existing category-image regex failures (single digit pattern vs image 29). Scoped TypeScript diagnostics: zero. Global tsc reports stale .next route types and unrelated existing test type errors. No production scrape/deployment performed.
## Evidence
- Commits:
- Tests: 11 MeinBezirk regression tests passed, 3 real source pages parsed successfully, Scoped TypeScript check: zero diagnostics, Combined suite: 85 passed; 4 unrelated category-image regex failures, Global tsc blocked by stale .next and existing test errors
- PRs:
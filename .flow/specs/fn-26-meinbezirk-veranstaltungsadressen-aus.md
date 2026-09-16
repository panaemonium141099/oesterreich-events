# MeinBezirk: Veranstaltungsadressen

## Goal & Context
MeinBezirk liefert genaue Event-Adressen in JSON-LD und in der sichtbaren Ortszeile. Der bisherige Adapter ignoriert diese Daten und reichert nur die ersten 500 Events an.

## Approach
Event.location aus JSON-LD bevorzugen, sichtbare Event-Ortszeile als Fallback auswerten. Venue, Strasse/Adresse, PLZ und city getrennt speichern. Keine PLZ-Suche im gesamten Dokument. Alle Events mit maximal drei parallelen Detailabrufen und Pause je Worker anreichern. Listing-Ortsangaben bei Detailfehlern erhalten.

## Acceptance
- Strukturierte Event-Adresse wird ohne Organizer-/Footer-Kontamination gelesen.
- Hauptplatz/Amstetten, Hauptplatz/Bruck und Pfarrhof/Gansbach sind abgedeckt.
- Mehr als 500 Events werden angereichert, Fehler lassen andere Events bestehen.
- Regressionstests und TypeScript-Pruefung sind dokumentiert.

## Boundaries
Kein Produktions-Backfill oder Deployment in dieser Aenderung; bestehende Daten profitieren nach Ausrollen und erneutem Scrapen.

## Quick commands
- npx vitest run src/__tests__/scrapers/meinbezirk-location.test.ts

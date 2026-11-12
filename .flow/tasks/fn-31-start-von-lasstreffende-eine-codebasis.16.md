# fn-31-start-von-lasstreffende-eine-codebasis.16 Abnahme vor dem Start und Dokumentation

## Description
Abnahme vor dem Start und Dokumentation.

**Size:** M
**Files:** `src/scripts/de-abnahme.ts` (neu), `CLAUDE.md`, `docs/MASTERPLAN.md`, `.flow/specs/fn-31-…md`

## Approach
- DE-Build gegen Prod-Daten in einem Staging-Container oder lokal; Abnahmeskript prüft über die erzeugten Seiten und Sitemaps: kein AT- oder CH-Event in Liste, Karte, Suche, Hubs, Detailseiten, Sitemaps; keine URL mit `0000` oder `-at/`; kein Canonical auf .at; abgeschaltete Routen 404; jede Detailseite der Stichprobe zeigt Quelle und Link.
- Stichprobe von 30 DE-Event-Seiten von Hand gegen die Quelle (Titel, Datum, Ort), wie im Prüfstand von fn-29.
- AT-Vergleich (Skript aus Task 3) ein letztes Mal gegen Prod.
- `CLAUDE.md`: Abschnitte „Nur Österreich“, Ortsdaten, Betrieb, Deployment (dort steht noch Vercel), Wichtige Pfade. `docs/MASTERPLAN.md`: Abschnitt Deutschland mit Zahlen, Entscheidungen, Betrieb.
- Indexierungsstufe 1 freischalten erst nach dem Ja des Nutzers.

## Key context
- Lokales Browser-Streaming hängt unter Windows und Node 24: HTML per fetch prüfen.
## Acceptance
- [ ] Abnahmeskript grün gegen den DE-Build mit Prod-Daten (Ausgabe im PR)
- [ ] 30er-Stichprobe dokumentiert, kein falscher Ort sichtbar
- [ ] AT-Vergleich ohne Abweichung
- [ ] `npm test` grün für beide Länder
- [ ] `CLAUDE.md` und `docs/MASTERPLAN.md` nachgezogen
- [ ] Alle Akzeptanzkriterien des Epics abgehakt oder mit Grund offen
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

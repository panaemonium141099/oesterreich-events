# fn-29-de-gemeinde-registry-gemeindekalender.3 DE-Prüfstand und AT-Referenzwerte

## Description
Prüfstand nach der Methode aus PR #301: Listen- und Detailseiten einmal laden und cachen, Parser vorher/nachher, Diff nach `source_id` (unverändert, übernommen, weg, neu), Metriken je Schwelle des Qualitätsvertrags, Stichprobe von 30 Events als abhakbare Liste mit Quell-Link. Dazu die AT-Referenzwerte aus Prod messen (gem2go, gemeinde-registry, gemeinden-generic): Müll-Titel-Quote, Platzhalter-Uhrzeit-Quote, Platzhalter-Koordinaten, sichtbare Gemeinde-Dienste, Dedup-Audit. Kommando `npm run pruefstand:de -- --adapter <name> [--sample 30]`.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Prüfstand läuft offline auf gecachten Seiten, Bericht als Markdown
- [ ] AT-Referenzwerte gemessen und in `docs/research/de-gemeinden/` dokumentiert (mit Abfrage)
- [ ] Schwellen als Konstanten, gegen die der Bericht prüft

## Done summary
DE-Prüfstand und AT-Referenzwerte (PR #361): npm run pruefstand:de -- --adapter <name> [--offline] [--fresh] [--mit-belegen] mit fetch-Cache (.pruefstand/), Schreibweg des Syncs ohne Schreiben (toSupabaseRow(...).row), Kennzahlen, Schwellen (src/lib/pruefstand/schwellen.ts), Diff nach source_id, deterministische 30er-Stichprobe, Exit 1 bei Riss. AT-Referenz (npm run pruefstand:at-referenz, nur lesend) aus 37.817 Zeilen: Müll-Titel 0,1 %, ohne Uhrzeit 60,9 %, ohne Koordinaten 0,3 %, sichtbare Gemeinde-Dienste 0, Dubletten je Quelle 1,7 % (data/pruefstand/at-referenz.json, docs/research/de-gemeinden/02-at-referenzwerte.md). Probelauf gemeinden-wp-burgenland bestanden, offline deterministisch.
## Evidence
- Commits: fec94cfd1504bad473873d99919751201d664ea4
- Tests: npx vitest run src/__tests__/lib/pruefstand/
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/361
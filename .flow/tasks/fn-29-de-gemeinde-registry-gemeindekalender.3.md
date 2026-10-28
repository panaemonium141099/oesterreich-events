# fn-29-de-gemeinde-registry-gemeindekalender.3 DE-Prüfstand und AT-Referenzwerte

## Description
Prüfstand nach der Methode aus PR #301: Listen- und Detailseiten einmal laden und cachen, Parser vorher/nachher, Diff nach `source_id` (unverändert, übernommen, weg, neu), Metriken je Schwelle des Qualitätsvertrags, Stichprobe von 30 Events als abhakbare Liste mit Quell-Link. Dazu die AT-Referenzwerte aus Prod messen (gem2go, gemeinde-registry, gemeinden-generic): Müll-Titel-Quote, Platzhalter-Uhrzeit-Quote, Platzhalter-Koordinaten, sichtbare Gemeinde-Dienste, Dedup-Audit. Kommando `npm run pruefstand:de -- --adapter <name> [--sample 30]`.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Prüfstand läuft offline auf gecachten Seiten, Bericht als Markdown
- [ ] AT-Referenzwerte gemessen und in `docs/research/de-gemeinden/` dokumentiert (mit Abfrage)
- [ ] Schwellen als Konstanten, gegen die der Bericht prüft

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

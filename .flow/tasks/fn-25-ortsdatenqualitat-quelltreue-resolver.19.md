# fn-25-ortsdatenqualitat-quelltreue-resolver.19 O1 Betrieb: Kennzahlen im Pipeline-Report, Prüfansicht für ungeklärte Fälle, Alarm mit Ursache

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
O1 im Betrieb: Schritt `location_metrics` im Nachtlauf schreibt `workflow_runs.location-audit` (heute 06:06, 08:41, 11:07, 12:00), Alarme bei Konflikten (Statuswechsel-Zeitpunkt statt updated_at, #215) und Wiederholbarkeit < 100 %, Konflikt-Gruppen mit Quelle und Rohname. Prüfansicht `/admin/ortsdaten` mit Korrekturformular (Korrekturen mit Quellenbezug, #206). Präzisions-Stichprobe `location-precision-sample.ts` (38/40 und 37/40 PLZ passend nach E1).
## Evidence
- Commits:
- Tests:
- PRs:
# fn-25-ortsdatenqualitat-quelltreue-resolver.18 F1 Gestufte Freigabe, Folgewirkungen (Caches, MVs, Hubs, Suchindex, Übersetzungen, URLs) und Wiederholungslauf

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
F1 live: `NEXT_PUBLIC_LOCATION_GATING=1` (Deploy 34841237458, 12:04 UTC), MV und Payload neu gebaut (67.378 Punkte, 37.180 ungefähr). Sichtprüfung: Sammelmarker mit Hinweis, Detailseite „Ortsangabe ungefähr" ohne Anreise, JSON-LD ohne geo bei Gemeinde-Ebene, Unterkünfte-Box ohne Kilometer (#214). URLs unverändert (Auflösung über slug+Datum, §11). Wiederholungslauf über zwei Nachtläufe (15./16.09.) ist die dokumentierte Folgeprüfung; Rückweg: Variable entfernen + Deploy.
## Evidence
- Commits:
- Tests:
- PRs:
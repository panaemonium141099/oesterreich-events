# fn-28-de-gemeindekalender-dorffeste-in-jeder.16 Gemeindekalender Hamburg

## Description
Bundesland: Hamburg. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 1 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: Stadtstaat, 7 Bezirke
- destination.one `open-data` (alle Termine, 27.10.2026): 5 Events mit `area` Hamburg

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Statt Gemeinden: Bezirke und Stadtteile; Stichprobe 30 Stadtteile
- hamburg.de Veranstaltungen, Bezirksämter, Stadtteilfeste

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/15-hamburg.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/15-hamburg.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Ortsteile/Stadtteile, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Hamburg mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

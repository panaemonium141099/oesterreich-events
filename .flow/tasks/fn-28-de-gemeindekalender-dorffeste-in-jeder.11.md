# fn-28-de-gemeindekalender-dorffeste-in-jeder.11 Gemeindekalender Brandenburg

## Description
Bundesland: Brandenburg. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 413 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 52 Ämter
- destination.one `open-data` (alle Termine, 27.10.2026): 1031 Events mit `area` Brandenburg

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Smart Village App (Open Source, Landesförderung, Schnittstellen u. a. zur TMB): wie viele Kommunen, offene API?
- TMB-Veranstaltungsdatenbank (XML-Schnittstelle über contentnetzwerk@reiseland-brandenburg.de, im Bericht genannt)
- Ämter und Amtsblätter

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/10-brandenburg.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/10-brandenburg.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Brandenburg mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

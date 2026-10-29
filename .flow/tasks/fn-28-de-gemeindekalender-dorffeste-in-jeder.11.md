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
- [x] `docs/research/de-gemeinden/10-brandenburg.md` nach dem Format im Epic-Spec
- [x] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [x] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [x] Dorffest-Test mit belegtem Beispiel je Quelle
- [x] Priorisierte Integrationsliste für Brandenburg mit nächstem Schritt, Lücken benannt
- [x] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Ergebnis `docs/research/de-gemeinden/10-brandenburg.md` (PR #382). Stichprobe 30 Gemeinden unter 10.000 EW (Destatis 30.09.2026, Seed 281112) gegen die Vollerhebung geprüft (26/30 bestätigt). verwaltungsportal.de ist der Generic (17/30; 215 Gemeinden auf 128 Websites), das Amt ist die Kalenderebene (17 von 24 amtsangehörigen nur über den Amtskalender). TMB-Veranstaltungsdatenbank nimmt nicht-touristische Termine für Ämter und Gemeinden auf, XML-Schnittstelle nur auf Anfrage; reiseland-brandenburg.de 5.590 Veranstaltungsseiten gegenüber 494 TMB-Terminen in destination.one open-data. Dorffest-Test 16/30, destination.one 7/30, TMB 7/30. Priorisierte Liste, Lücken und zwei Anfragen (TMB, Förderverein) im Bericht.
## Evidence
- Commits: b3f6dcd059692eb1ea7e56c6035b57c877b32761
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/382
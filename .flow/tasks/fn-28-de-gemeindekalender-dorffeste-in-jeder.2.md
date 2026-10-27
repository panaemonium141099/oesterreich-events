# fn-28-de-gemeindekalender-dorffeste-in-jeder.2 Gemeindekalender Rheinland-Pfalz

## Description
Bundesland: Rheinland-Pfalz. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 2300 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 129 Verbandsgemeinden
- destination.one `open-data` (alle Termine, 27.10.2026): 14275 Events mit `area` Rheinland-Pfalz

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Verbandsgemeinden als Kalenderebene (eine Integration je VG statt je Ortsgemeinde?)
- Amtsblätter der Verbandsgemeinden (Verlag, z. B. LINUS WITTICH: Online-Kalender, Export?)
- Digitale Dörfer (DorfFunk/DorfPages, Fraunhofer IESE): Veranstaltungen, Schnittstelle?
- rlpDirekt: offen, dl-zero-de/2.0, 577 kommende Termine (im Bericht belegt)
- Feratel Deskline Linkkeys `mosel` (1.929 Events) und `neustadt` (im Bericht belegt)

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/01-rheinland-pfalz.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/01-rheinland-pfalz.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Rheinland-Pfalz mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

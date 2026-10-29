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
Ergebnis `docs/research/de-gemeinden/01-rheinland-pfalz.md` (PR #372, gemergt), Anfragen im Anhang `01-rheinland-pfalz-anfragen.md`, Scan aller 170 Verwaltungen in `data/rp-verwaltungen-2026-10.csv`.

* Stichprobe 30 Gemeinden unter 10.000 EW aus dem Destatis-Auszug 30.09.2026, Seed 20261027, je Gemeinde Fundort mit Link, Plattform, destination.one-Treffer, meinOrt, Fest.
* ionas (Chamaeleon GmbH, Montabaur) ist der RP-Generic: 106 von 123 VG-Startseiten, 31 von 41 verbandsfreien, 1.857 von 2.300 Gemeinden über ihre Verwaltung. TVM-Feeds offen (events.json, event.ics); in 39 Feeds 9.423 künftige Termine, davon 79,5 % Deskline RPT (UUID), 1.932 eigene. Hinweis für `de-ionas`: Deskline-Termine abgrenzen.
* Fest belegt bei 11 von 30 (mit Vereinsfesten 15), über Feed/API 9; destination.one 5 von 30, rlpDirekt 0 von 30; WITTICH-Amtsblatt 24 von 30, meinOrt-Liste 17 von 30.
* Deskline `mosel`: 1.926 Termine, 77 Festtitel, Dorffeste, die destination.one fehlen.
* Abgleich mit der Vollerhebung: 15 von 30 bestätigt, 5 formal, 9 abweichend, 1 nicht prüfbar.
* Priorisierte Liste: ionas TVM, WITTICH, Deskline RPT, destination.one, Tribe, VG-PDF, Kleinere.
## Evidence
- Commits: 3a59ac20
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/372
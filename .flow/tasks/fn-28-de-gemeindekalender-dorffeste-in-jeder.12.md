# fn-28-de-gemeindekalender-dorffeste-in-jeder.12 Gemeindekalender Nordrhein-Westfalen

## Description
Bundesland: Nordrhein-Westfalen. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 396 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: keine (alle Gemeinden verbandsfrei, oft mit vielen Ortsteilen)
- destination.one `open-data` (alle Termine, 27.10.2026): 9426 Events mit `area` Nordrhein-Westfalen

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Kommunale IT-Dienstleister (z. B. regio iT, krz, citeq) und deren CMS
- Data Hub NRW / Open Data Finder NRW
- Schützenfeste, Kirmes; termine.ekir.de als Nebenquelle; Open Data Neuss/Köln (im Bericht)

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/11-nordrhein-westfalen.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/11-nordrhein-westfalen.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Nordrhein-Westfalen mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Bericht docs/research/de-gemeinden/11-nordrhein-westfalen.md (PR #391, gemergt). Stichprobe 30 von 52 NRW-Gemeinden unter 10.000 EW (Destatis 30.09.2026, Seed 28012) plus Ergänzung 10 aus 10.000 bis unter 50.000 EW. Generics: ionas TVM, NOLIS (Münsterland), Heimat-Info (22 Kommunen, Kreis Düren 14 von 15, nur mit WITTICH-Lizenz), Weblication, active-City, Datenportal Münsterland (Basic-Auth, CC-BY-SA), evangelische Kalender EKiR und neu veranstaltungen-ekvw.de. Dorffest in der Hauptquelle 19 von 30 (mit destination.one 23), destination.one-Treffer 18 von 30. Offene Daten: aktuelle Festdaten nur Grevenbroich (CC0), robots sperrt /api/ bei Rhein-Kreis Neuss und Open.NRW. Priorisierte Liste mit 12 Integrationen, Lücken und vier Anfragen für den User. Sechs Abrufe gesperrter Pfade vor robots-Auswertung offengelegt.
## Evidence
- Commits: a3621a721895ab85f17fc94430094941510babe8
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/391
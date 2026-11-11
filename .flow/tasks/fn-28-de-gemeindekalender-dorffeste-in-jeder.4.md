# fn-28-de-gemeindekalender-dorffeste-in-jeder.4 Gemeindekalender Schleswig-Holstein

## Description
Bundesland: Schleswig-Holstein. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 1104 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 83 Ämter
- destination.one `open-data` (alle Termine, 27.10.2026): 2982 Events mit `area` Schleswig-Holstein

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Ämter als Kalenderebene für amtsangehörige Gemeinden
- Touristische Landesdatenbank SH (TA.SH): Zugang für Dritte?
- Amtsblätter/Bekanntmachungsblätter der Ämter und Kreise

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/03-schleswig-holstein.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/03-schleswig-holstein.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Schleswig-Holstein mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Ergebnis in docs/research/de-gemeinden/03-schleswig-holstein.md (PR #350). Stichprobe 30 Gemeinden unter 10.000 EW (Destatis 30.09.2026, Seed 20261027) mit 25 Ämtern. Ämter sind meist keine Kalenderebene (4 von 25 mit Dorfterminen). Stärkster Hebel termine-regional.de der NetzWerkstatt Rendsburg (291 SH-Gemeinden im Ortsfilter, 10 von 30; Export entgeltlich, Anfrage nötig). TA.SH-Landesdatenbank offen auf opendata.schleswig-holstein.de (4.350 Termine, Lizenz je Eintrag), aber nur 4 von 30 kleinen Gemeinden. communice (inixmedia) mit offenem Atom-Feed in 6 von 25 Ämtern, iKISS in 7 von 25 ohne Dorftermine. destination.one 3 von 30. Ringreiten und Vogelschießen in keiner strukturierten Quelle; 8 von 30 Gemeinden ohne auffindbare Termine.
## Evidence
- Commits: 4881399e
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/350
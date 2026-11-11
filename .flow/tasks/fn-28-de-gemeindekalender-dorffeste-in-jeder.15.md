# fn-28-de-gemeindekalender-dorffeste-in-jeder.15 Gemeindekalender Berlin

## Description
Bundesland: Berlin. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 1 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: Stadtstaat, 12 Bezirke
- destination.one `open-data` (alle Termine, 27.10.2026): 1 Events mit `area` Berlin

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Statt Gemeinden: Bezirke und Ortsteile; Stichprobe 30 Ortsteile
- kulturdaten.berlin (Bezirkskalender, 12.594 kommende Termine, Lizenz offen)
- berlin.de Straßen- und Volksfeste (CC BY), Kiezfeste

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/14-berlin.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/14-berlin.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Ortsteile/Stadtteile, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Berlin mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Berlin-Bericht docs/research/de-gemeinden/14-berlin.md (PR #394). Stichprobe 30 von 97 Ortsteilen (ALKIS, Seed 28015). kulturdaten.berlin ist eine Kopie des offenen Landeskalenders berlin.de/land/kalender/json.php (1.749 Veranstaltungen, Lizenz nicht belegt, kaum Kiezfeste). Einzige offen lizenzierte Festliste: Senatsliste Straßen- und Volksfeste (CC BY, 10 von 30 Ortsteilen). destination.one 0 von 30. Kiezfeste verteilt auf Stadtteilzentren (10), Vereine (8), Bezirksamtsseiten (5), QM/BENN (4), Kiezblog/Ortsportal (2), nirgends (1). Priorität: Senatsliste, Landeskalender nach Erlaubnis, Registry mit Plugin-Detektor. Lücke: Feuerwehr-Tage der offenen Tür ohne Quelle.
## Evidence
- Commits: fc25a2db
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/394
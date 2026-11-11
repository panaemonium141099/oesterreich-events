# fn-28-de-gemeindekalender-dorffeste-in-jeder.6 Gemeindekalender Niedersachsen

## Description
Bundesland: Niedersachsen. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 941 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 114 Samtgemeinden
- destination.one `open-data` (alle Termine, 27.10.2026): 9332 Events mit `area` Niedersachsen

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Samtgemeinden als Kalenderebene
- Niedersachsen Hub (TMN, destination.one): Anteil Gemeinde- und Vereinsfeste?
- Kommunale IT-Dienstleister und CMS, Schützenfeste

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/05-niedersachsen.md`.
## Acceptance
- [x] `docs/research/de-gemeinden/05-niedersachsen.md` nach dem Format im Epic-Spec
- [x] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [x] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [x] Dorffest-Test mit belegtem Beispiel je Quelle
- [x] Priorisierte Integrationsliste für Niedersachsen mit nächstem Schritt, Lücken benannt
- [x] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Niedersachsen recherchiert: docs/research/de-gemeinden/05-niedersachsen.md (+ -anfragen.md), PR #373.
Stichprobe 30 von 734 Gemeinden unter 10.000 EW (Destatis 30.09.2026, Seed 280603). NOLIS ist der Landes-Generic (Vollerhebung 343 Gemeinden), aber nur 5 von 10 NOLIS-Gemeinden der Stichprobe haben Termine im Kalender; der NOLIS-iCal mit selected_kommune=0 liefert einen regionalen Pool (Mittelweser: 473 Termine aus 17 Kommunen). Samtgemeinden bündeln selten (4 von 20 ja, 4 teilweise), Einheitsgemeinden haben alle eigene Kalender. destination.one open-data: 8 von 30 mit Treffer, Fest 1 von 30; TMN: 42 % der Hub-Veranstaltungen Open Data. 8 von 30 ohne online datierten Termin, 5 von 30 Feste nur auf Vereinsseiten. Priorisierte Liste: NOLIS-Pools je Landkreis, destination.one, Vollerhebung-Adapter, HTML-Registry, infomax, Vereine.
## Evidence
- Commits: 1eac6318
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/373
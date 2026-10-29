# fn-28-de-gemeindekalender-dorffeste-in-jeder.3 Gemeindekalender Bayern

## Description
Bundesland: Bayern. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 2056 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 311 Verwaltungsgemeinschaften
- destination.one `open-data` (alle Termine, 27.10.2026): 9128 Events mit `area` Bayern

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- AKDB (kommunaler IT-Dienstleister) und deren Gemeinde-Webangebote
- Gemeinde-Apps (z. B. Heimat-Info) mit Veranstaltungsmodul
- BayernCloud Tourismus (dataCycle): wie viele Gemeinden liefern Events ein?
- Landkreis-Veranstaltungskalender
- Kirchweih/Kerwa, Feuerwehrfeste; evangelische-termine.de (ELKB) als Nebenquelle

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/02-bayern.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/02-bayern.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Bayern mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
`docs/research/de-gemeinden/02-bayern.md` plus Anhang `02-bayern-anfragen.md` (PR #369).
Stichprobe 30 Gemeinden unter 10.000 EW (Destatis 30.09.2026, `random.Random(20261027)`):
Hauptfundort 18 × eigene Website, 3 × VGem, 7 × PDF, 2 × Tourismus, 2 × Heimat-Info, 1 × nirgends;
20 von 30 maschinenlesbar, Dorffest bei 24 belegt. Generics: Heimat-Info (5/30 mit Terminen,
507 bayerische Einträge), communice web/inixmedia (5/30, Eigenangabe 500 Installationen),
RCE-Event (4/30), The Events Calendar (3/30), open2c. destination.one 6/30, BayernCloud steckt
dort als DataCycleProxy. Abgleich mit der Vollerhebung: 18 von 30 abweichend, Zuordnung heißt
nicht Termine. Offen für den User: Anfragen inixmedia und RCE Medien, Bayern-Zahl ins WITTICH-Gespräch.
## Evidence
- Commits: 3913e0a2
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/369
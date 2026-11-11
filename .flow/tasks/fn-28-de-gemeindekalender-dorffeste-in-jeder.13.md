# fn-28-de-gemeindekalender-dorffeste-in-jeder.13 Gemeindekalender Sachsen-Anhalt

## Description
Bundesland: Sachsen-Anhalt. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 218 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 18 Verbandsgemeinden
- destination.one `open-data` (alle Termine, 27.10.2026): 725 Events mit `area` Sachsen-Anhalt

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Verbandsgemeinden und Amtsblätter
- SAiNT (IMG): Zugang für Dritte?

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/12-sachsen-anhalt.md`.
## Acceptance
- [x] `docs/research/de-gemeinden/12-sachsen-anhalt.md` nach dem Format im Epic-Spec
- [x] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [x] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [x] Dorffest-Test mit belegtem Beispiel je Quelle
- [x] Priorisierte Integrationsliste für Sachsen-Anhalt mit nächstem Schritt, Lücken benannt
- [x] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Sachsen-Anhalt recherchiert: docs/research/de-gemeinden/12-sachsen-anhalt.md (PR #380).
Stichprobe 30 Gemeinden < 10.000 EW (Seed 28013), Vollerhebung nachgeprüft (19 bestätigt, 8 korrigiert, 3 nicht erreichbar).
Einheitsgemeinden 11/11 mit Fest im eigenen Kalender (9/11 mit Ortsteil-Terminen), VG-Mitgliedsgemeinden 2/19.
Generics: verwaltungsportal.de 12/30 (JSON-LD addressLocality "Gemeinde OT Ortsteil"), GeoCMS brain-SCC (43 der 63 bundesweit in ST), iKISS.
SAiNT (IMG): Daten CC, API-Bedingungen 3.1 a verbieten Erlöse, Quellen laut Schema Outdooractive und BrainSCC; schriftliche Anfrage durch User nötig.
destination.one: 544 Termine im Land, 2/30 Gemeinden mit Treffer.
## Evidence
- Commits: cd962bc8f18241b4760ab8205ef507a8d85937d2
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/380
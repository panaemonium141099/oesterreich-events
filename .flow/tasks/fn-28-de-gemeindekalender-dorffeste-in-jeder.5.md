# fn-28-de-gemeindekalender-dorffeste-in-jeder.5 Gemeindekalender Baden-Württemberg

## Description
Bundesland: Baden-Württemberg. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 1101 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 270 Verwaltungsverbände/vereinbarte Verwaltungsgemeinschaften
- destination.one `open-data` (alle Termine, 27.10.2026): 539 Events mit `area` Baden-Württemberg

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Komm.ONE (kommunaler IT-Dienstleister) und deren Gemeinde-CMS
- Amtsblätter/Mitteilungsblätter (Verlag, z. B. Nussbaum Medien) mit Online-Veranstaltungen
- mein.toubiz / TMBW: welche Gemeinde-Events sind offen lizenziert?
- Hocketse, Feuerwehrfeste, Weinfeste

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/04-baden-wuerttemberg.md`.
## Acceptance
- [x] `docs/research/de-gemeinden/04-baden-wuerttemberg.md` nach dem Format im Epic-Spec
- [x] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [x] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [x] Dorffest-Test mit belegtem Beispiel je Quelle
- [x] Priorisierte Integrationsliste für Baden-Württemberg mit nächstem Schritt, Lücken benannt
- [x] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Baden-Württemberg recherchiert, Ergebnis in docs/research/de-gemeinden/04-baden-wuerttemberg.md (PR #371).

- Stichprobe 40 Gemeinden unter 10.000 EW aus dem Destatis-Auszug 30.09.2026 (839 Kandidaten, random.Random(20261027).sample), je Gemeinde Fundort mit Link, Hersteller, Feed, Amtsblatt-Verlag, Tourismus-Widget, destination.one-Treffer und Abgleich mit der Vollerhebung (28 von 40 gleich, 7 abweichend mit Grund).
- 34 von 40 veröffentlichen auf der eigenen Website mit Vereinsterminen, 5 über toubiz-Tourismusportale, 1 über ein Ortsportal, keine nirgends.
- Generics: Hirsch & Wölfl hwveranstaltung (neu, 15/40, Vollerhebung 345 BW), Cross7 (120), Komm.ONE RSS (137), cEasy (92), verwaltungsportal.de (34), toubiz (Token je Kunde, Lizenz je Datensatz), NUSSBAUM (10/40 belegt, Lizenz offen); je Zugriffsweg, echte Felder, robots/Lizenz.
- destination.one: 0 von 40; BW im Fenster 400 Events, 18 Weihnachtsmärkte, 1 Weinfest, kein Feuerwehrfest/Hocketse/Dorffest/Kirbe.
- Dorffest-Test mit belegtem Beispiel je Quelle; priorisierte Integrationsliste, Lücken, Anfragenliste im Anhang (ein robots.txt-Verstoß offen benannt).
## Evidence
- Commits: fbcc4ec72059ee12b1e8d963aec419e9dfa759b7
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/371
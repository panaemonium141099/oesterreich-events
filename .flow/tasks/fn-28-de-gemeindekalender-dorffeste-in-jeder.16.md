# fn-28-de-gemeindekalender-dorffeste-in-jeder.16 Gemeindekalender Hamburg

## Description
Bundesland: Hamburg. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 1 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: Stadtstaat, 7 Bezirke
- destination.one `open-data` (alle Termine, 27.10.2026): 5 Events mit `area` Hamburg

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Statt Gemeinden: Bezirke und Stadtteile; Stichprobe 30 Stadtteile
- hamburg.de Veranstaltungen, Bezirksämter, Stadtteilfeste

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/15-hamburg.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/15-hamburg.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Ortsteile/Stadtteile, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Hamburg mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Bericht docs/research/de-gemeinden/15-hamburg.md plus 15-hamburg-anfragen.md (PR #390, gemergt).
Stichprobe 30 Stadtteile aus 99 Einheiten der Statistikamt-Nord-Daten (Seed 28016).
Zentraler Weg: Veranstaltungsdatenbank Hamburg & Metropolregion (Hamburg Tourismus, imx), täglicher XML-Feed laut Betreiber kostenfrei mit Nutzungsvereinbarung, 9.038 Veranstaltungen mit Ort Hamburg, aber kaum Stadtteilfeste.
Stadtteilfeste verstreut: Hauptfundort FF 5, Bürger-/Heimatverein 6, Stadtteilkultur 5, Portal 3, Kirche 3, Marketing 2, Schützenverein 1, nirgends 5 von 30; Terminfeed nur 4 von 30 (Tribe 3, MEC 1).
feuerwehr-hamburg.de bündelt alle 86 Wehren (1.423 Terminbeiträge, 5 kommende), lückenhaft; hamburg.de-Redaktionsliste 13 Laternenumzüge.
destination.one 0 von 30; Transparenzportal nur Sondermittel-Beschlüsse; Bezirksämter ohne Kalender; Abendblatt sperrt Claude-Bots.
Nächster Schritt: Nutzungsvereinbarung mit Hamburg Tourismus anfragen.
## Evidence
- Commits: b1e598e80d30ed930e8f3767d9e4113da8189dd2
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/390
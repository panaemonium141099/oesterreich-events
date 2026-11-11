# fn-28-de-gemeindekalender-dorffeste-in-jeder.10 Gemeindekalender Sachsen

## Description
Bundesland: Sachsen. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 418 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: 70 Verwaltungsverbände/-gemeinschaften
- destination.one `open-data` (alle Termine, 27.10.2026): 2189 Events mit `area` Sachsen

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Amtsblätter (Verlage) mit Online-Veranstaltungskalender
- SaTourN / TMGS: Gemeinde-Events offen?
- kalender.evlks.de als Nebenquelle

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/09-sachsen.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/09-sachsen.md` nach dem Format im Epic-Spec
- [ ] Stichprobe: 30 Gemeinden unter 10.000 Einwohnern, reproduzierbar gezogen, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [ ] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Dorffest-Test mit belegtem Beispiel je Quelle
- [ ] Priorisierte Integrationsliste für Sachsen mit nächstem Schritt, Lücken benannt
- [ ] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Sachsen recherchiert, Ergebnis in docs/research/de-gemeinden/09-sachsen.md (PR #384, gemergt).

- Stichprobe 30 von 352 Gemeinden unter 10.000 EW (Destatis 30.09.2026, random.Random(281014)), je Gemeinde Fundort, Plattform, Link, destination.one-Treffer und Dorffest-Test; Vollerhebung nachgeprüft (Stufe weicht bei 4 von 30 ab).
- Generics: verwaltungsportal.de mit "Sachsen vernetzt" (11/30, 84 Gemeinden laut Vollerhebung), NOLIS-iCal (20 Gemeinden in den Kreisen Leipzig, Nordsachsen, Mittelsachsen), SaTourN = destination.one open-data (1.089 Termine, 7/30, nur CC-lizenzierter Teil), Riedel-Verlag (117 Titel, nur per Mail), Tribe/MEC (MEC-Feed unter /feed/?post_type=mec-events), Freizeitkalender Vogtlandkreis (Vertrag), kalender.evlks.de (offenes XML/JSON, Nebenquelle), Munipolis (API per robots gesperrt).
- Landesbefund: 29 Gemeindeseiten im Landesnetz V4SN sperren alle Crawler per robots.txt.
- Dorffest-Test: 21/30 mit Fest in greifbarer Quelle, 2 nur PDF/Bild, 7 ohne.
- Priorisierte Liste, Lücken und Anfrageliste in der Datei.
## Evidence
- Commits: 89643b2b
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/384
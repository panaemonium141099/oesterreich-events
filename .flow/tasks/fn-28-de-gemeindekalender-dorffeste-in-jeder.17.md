# fn-28-de-gemeindekalender-dorffeste-in-jeder.17 Gemeindekalender Bremen

## Description
Bundesland: Bremen. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 2 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: Stadtstaat (Bremen, Bremerhaven)
- destination.one `open-data` (alle Termine, 27.10.2026): 199 Events mit `area` Bremen

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- Statt Gemeinden: Stadtteile beider Städte; Stichprobe 30 Stadtteile
- Stadtteilfeste, Beiräte, Bürgerhäuser

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/16-bremen.md`.
## Acceptance
- [x] `docs/research/de-gemeinden/16-bremen.md` nach dem Format im Epic-Spec
- [x] Stichprobe: 30 Ortsteile/Stadtteile, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [x] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [x] Dorffest-Test mit belegtem Beispiel je Quelle
- [x] Priorisierte Integrationsliste für Bremen mit nächstem Schritt, Lücken benannt
- [x] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Bremen und Bremerhaven recherchiert, Ergebnis docs/research/de-gemeinden/16-bremen.md (+ 16-bremen-anfragen.md), PR #388.

- Stichprobe 30 von 112 amtlichen Ortsteilen (WFS Landesamt GeoInformation, CC BY 4.0), Seed 28017, Blockland und Borgfeld als Zusatz.
- Stadt Bremen: bremen.de-Kalender der WFB, mindestens 928 Termine in 46 von 88 Ortsteilen; § 6 Abs. 2 der Nutzungsbedingungen erlaubt Weitergabe an Kooperationspartner, kein offener Feed (Cloudflare, iCal per robots gesperrt). Nächster Schritt Kooperationsanfrage WFB (inkl. der-bremer-norden.de).
- Bremerhaven: destination.one open-data 172 Events in 18 von 24 Ortsteilen, Lizenzmix CC0/CC BY/CC BY-SA.
- Ortsämter: SixCMS, CC BY-NC-ND, nur Sitzungen und PDF-Newsletter. Dorffeste der Bremer Dörfer in keiner offenen Sammelquelle.
- Stichprobenabdeckung: bremen.de 12/30, + destination.one 17/30, + Stadtteilportale 22/30, + Ortsamt-PDF 24/30.
- Dorffest-Test: belegt für alle priorisierten Quellen; kirche-bremen.de (nicht priorisiert) ohne Beispiel.
## Evidence
- Commits: 7ce137ec
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/388
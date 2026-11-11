# fn-28-de-gemeindekalender-dorffeste-in-jeder.14 Gemeindekalender Saarland

## Description
Bundesland: Saarland. Ziel: jede Gemeinde mit ihren lokalen Festen
(Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützen-, Mai-, Wein-
feste, Weihnachtsmärkte) über möglichst wenige Integrationen abdecken.

Belegte Ausgangszahlen:
- Gemeinden: 52 (Destatis GV-ISys, 30.09.2026)
- Gemeindeverbände: keine
- destination.one `open-data` (alle Termine, 27.10.2026): 452 Events mit `area` Saarland

Kandidaten (Hypothesen, nicht belegt, zu prüfen):
- 52 Gemeinden: Vollerhebung statt Stichprobe möglich
- Kirmes, Feuerwehrfeste

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/13-saarland.md`.
## Acceptance
- [x] `docs/research/de-gemeinden/13-saarland.md` nach dem Format im Epic-Spec
- [x] Stichprobe: alle 52 Gemeinden, je Eintrag Fundort der Veranstaltungen mit Link, Plattform/CMS und destination.one-Treffer
- [x] Jeder Generic (mehrfach in der Stichprobe oder laut Betreiber viele Gemeinden): Zugriffsweg, echte Felder aus Probe, Lizenz/AGB/robots, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [x] Dorffest-Test mit belegtem Beispiel je Quelle
- [x] Priorisierte Integrationsliste für Saarland mit nächstem Schritt, Lücken benannt
- [x] Keine Konten/Formulare/Mails, wenige GETs je Host, ohne Gedankenstriche, PR auf master


## Done summary
Saarland komplett geprüft (alle 52 Gemeinden statt Stichprobe), Ergebnis in docs/research/de-gemeinden/13-saarland.md (PR #386), Anfragen in 13-saarland-anfragen.md.

- mein.toubiz der Tourismus Zentrale Saarland ist laut Präsentation der Landeshauptstadt die zentrale Landesdatenbank, gepflegt von allen Landkreisen und einzelnen Kommunen. destination.one open-data führt davon 382 Saarland-Termine (import_source_tta-toubiz, CC-BY 271, CC-BY-SA 111), aber nur eine Teilmenge (Weiskirchen 29 gegen 5). Nächster Schritt: Zugang bei der TZS anfragen.
- WITTICH: Amts- oder Mitteilungsblatt für 43 von 52 Gemeinden (Sitemap wittich.de), meinOrt 29 von 52; für 5 Gemeinden einziger Weg.
- Saarland-Generic one4vision (TYPO3, *14v): 14 Gemeinde-Websites, 7 mit terminplaner14v.
- 31 von 52 Gemeinden mit lesbarem Kalender und kommenden Terminen (6 Feeds: ionas, Tribe-REST; 25 HTML), 6 nur toubiz, 15 ohne lesbaren Kalender.
- Dorffest-Test je Quelle belegt (Kerb Niederbexbach, Adventsfest Löschbezirk Rappweiler-Zwalbach, Kirmes Limbach, Berschweiler Kerb, Amtsblatt Oberthal).
- Vollerhebung nachgeprüft und korrigiert (Großrosseln, Mettlach, Bous, Nohfelden, Lebach, Wadern, Losheim, Saarlouis, Homburg).
## Evidence
- Commits: f233ef66564e3ec149e4aeaa890c8ff38b7f5d56
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/386
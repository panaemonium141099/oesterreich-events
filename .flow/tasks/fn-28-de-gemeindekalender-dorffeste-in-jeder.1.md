# fn-28-de-gemeindekalender-dorffeste-in-jeder.1 Bundesweite Gemeinde-Plattformen und Verlage (Querschnitt)

## Description
Querschnitt: bundesweite und länderübergreifende Anbieter, über die viele
kleine Gemeinden ihre Veranstaltungen veröffentlichen. Das deutsche
Gegenstück zu gem2go in Österreich.

Zu prüfen (Kandidaten, nicht belegt):
- Amtsblatt- und Mitteilungsblatt-Verlage mit Online-Veranstaltungskalendern
  (z. B. LINUS WITTICH, Nussbaum Medien, Primo-Verlag, Riedel): Zahl der
  Gemeinden, Online-Plattform, Export/Feed, Nutzungsbedingungen
- Gemeinde-Apps und Dorfplattformen mit Veranstaltungsmodul (z. B.
  Heimat-Info, Digitale Dörfer/DorfFunk, Smart Village App, Crossiety):
  Zahl der Kommunen, offene API, Lizenz
- Kommunale IT-Dienstleister und CMS-Hersteller für Gemeinde-Websites (z. B.
  Komm.ONE, AKDB, ekom21, KDO, ITEOS, Sitepark/Government Site Builder,
  Advantic/IKISS, NOLIS, regio iT): Kalendermodul, Standard-Exporte
- Kalender-Erweiterungen in TYPO3/WordPress/Contao/Joomla mit iCal/RSS/JSON
  (z. B. calendarize, sf_event_mgt, The Events Calendar): Feed-Pfade
- Landkreis- und Regionalkalender als Sammelpunkt
- Zeitungs-Veranstaltungsdatenbanken mit Feed oder Partner-Schnittstelle
- Vereins- und Feuerwehrplattformen, falls mit offenem Kalender

Vorgehen und Ergebnisformat stehen verbindlich im Epic-Spec
(`.flow/bin/flowctl cat fn-28-de-gemeindekalender-dorffeste-in-jeder`), Ausgangslage in
`docs/research/deutschland-event-quellen-2026-10.md`. Vor dem Start
`git fetch` und `docs/research/de-gemeinden/` auf origin/master lesen
(parallel laufende Tickets), bekannte Anbieter verlinken statt neu
recherchieren. Ergebnis als eigener Branch mit PR auf master.

Ergebnisdatei: `docs/research/de-gemeinden/00-bundesweit.md`.
## Acceptance
- [ ] `docs/research/de-gemeinden/00-bundesweit.md` mit je Anbieter: Betreiber, Zahl der bedienten Gemeinden (belegt), Länder, Zugriffsweg (API/Feed/Export/HTML), echte Felder aus einer Probe, Lizenz/AGB, nächster Schritt
- [ ] Je Anbieterklasse mindestens drei echte Gemeinde-Beispiele mit Link
- [ ] Kalender-Erweiterungen (TYPO3, WordPress, Contao, Joomla) mit Standard-Feed-URLs (iCal/RSS/JSON) und Erkennungsmerkmalen an einer Gemeinde-Website
- [ ] Alle Aussagen mit Beleg, keine Konten/Formulare/Mails, ohne Gedankenstriche
- [ ] PR auf master


## Done summary
Ergebnis docs/research/de-gemeinden/00-bundesweit.md (+ Anhang 00-bundesweit-anfragen.md), PR #342 gemergt.
Generics mit zentraler Schnittstelle: Heimat-Info (JSON-API, 648 Kommunen selbst gezählt, v. a. BY), Cross7 (JSON-API, Eigenangabe über 450 Kunden), NOLIS (iCal, Eigenangabe über 450 Kommunen). WITTICH-Gruppe (meinOrt 2.197 Orte) nur per Vereinbarung. Verlage fast nur PDF, NUSSBAUM strukturiert aber KI-Crawler gesperrt. Kalender-Plugins mit Feed-Pfaden und Erkennungsregeln (D5) für die Länder-Stichproben; 12 von 181 Startseiten mit offenem Plugin-Feed. destination.one: 5 von 20 Beispielgemeinden mit Treffer, wenige Dorffeste im Titel.
## Evidence
- Commits: f46f4c83e5a44510309d17c14fbf6d9f2dbb41de
- Tests:
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/342
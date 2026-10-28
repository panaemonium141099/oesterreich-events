# fn-29-de-gemeinde-registry-gemeindekalender.2 Qualitätsvertrag länderfähig: Freigabevertrag, Resolver, Gemeinde-Dienste, Zeit für DE

## Description
Heute prüfen `admission.ts` (u. a. `isOutsideAtBox`), `location/evidence.ts` und `location/resolver.ts` Orte nur für `country === 'AT'`; DE-Zeilen (auch Eventim DE, Eventfrog DE) laufen ungeprüft durch. Länderfähig machen: Landesbox und Länderpolygone DE, PLZ fünfstellig, Fremdort-Signal, Bundesland-Ableitung für DE. Gemeinde-Dienste-Vokabular (`municipal-service.ts`) um deutsche Begriffe aus echten Proben erweitern (Ortsgemeinderat, Gelber Sack, Bürgersprechstunde u. a.). Zeitregeln Europe/Berlin prüfen. Keine Sonderregeln je Quelle.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Freigabevertrag und Resolver liefern für DE dieselben Gründe wie für AT (reject/quarantine), Golden-Tests mit echten DE-Fällen
- [ ] Bestand: Dry-Run `admission_recheck` über vorhandene DE-Zeilen (Eventim, Eventfrog), Bericht im PR, kein Schreiben ohne Freigabe
- [ ] Gemeinde-Dienste DE: Golden-Tests aus Proben der Vollerhebung
- [ ] AT-Verhalten unverändert (Tests grün)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

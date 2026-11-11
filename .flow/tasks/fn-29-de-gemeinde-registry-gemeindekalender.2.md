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
Qualitätsvertrag länderfähig (PR #363): Ortsdaten je Land (src/lib/location/ortsdaten.ts), Gemeinde-Index als Fabrik (AT unverändert), Resolver/Freigabevertrag/Sync/Re-Resolve wählen das Land; DE bekommt PLZ, Gemeinde, Mittelpunkt, Landesrahmen und Länder-Gegenprobe nach AT-Regeln. Spalten bundesland/district nur für AT (CHECK/FK). Gemeinde-Dienste um DE-Entsprechungen ergänzt. Altzeilen ohne Rohwerte außerhalb AT leiten nichts aus Anzeige-PLZ ab. Trockenläufe Prod: admission_recheck +4 echte AT-Abfuhrtermine; 8.218 DE-Zeilen: PLZ neu 8.014, Gemeinde neu 8.132, 1.262 ungeklärt → Gemeinde-Mittelpunkt, 5 Wien-Zeilen ohne Position.
## Evidence
- Commits: e0dcbb2c638e9284368ac723c34bfd8a0ab6628c
- Tests: npx vitest run src/__tests__/lib/qualitaetsvertrag-de.test.ts src/__tests__/lib/location-conservative-resolution.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/363
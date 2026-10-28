# fn-29-de-gemeinde-registry-gemeindekalender.1 DE-Stammdaten im Ein-System (Gemeinden, Kreise, Länder, PLZ)

## Description
Amtliche Gemeindeliste Destatis GV-ISys (Stichtag 30.09.2026: 10.749 Gemeinden mit ARS/AGS, Verband, Kreis, Land, Mittelpunkt) und eine PLZ-Zuordnung mit belegter Lizenz als Dateien unter `data/` aufbauen, Zugriff nur über `src/lib/gemeinden/` bzw. `src/lib/location/` mit Länderschalter, wie fn-27 für AT. Keine Parallelwelt, keine neuen PLZ- oder Koordinaten-Tabellen. Länderpolygone für die Gegenprobe des Freigabevertrags. Quelle und Lizenz jeder Datei im Kopf dokumentieren; PLZ-Quelle vorher recherchieren (Destatis führt nur eine PLZ je Gemeinde).

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Dateien unter `data/` mit Quelle, Stichtag, Lizenz
- [ ] Zugriff nur über bestehende Module mit Länderschalter, AT unverändert (alle AT-Tests grün)
- [ ] Wächter-Tests analog `gemeinde-config.test.ts` für DE
- [ ] Stammdaten-Build reproduzierbar per npm-Skript

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

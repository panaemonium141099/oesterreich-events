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
Deutsche Ortsstammdaten im Ein-System (PR #360): data/gemeinden-de.json (10.749 Gemeinden, Destatis), data/plz-de.json (10.845 PLZ als Mengen, GeoNames CC BY 4.0 + Amts-PLZ, 989 Großkunden markiert), data/stammdaten-de/laender-de.geojson (BKG VG250, 25 m vereinfacht; alle Gemeindemittelpunkte im eigenen Land), meta.json mit Quellen/Lizenzen/SHA-256. Builder npm run build:stammdaten:de ohne neue Abhängigkeit. Zugriff über src/lib/gemeinden/de.ts, laender-de.ts, location/plz-reference-de.ts, location/land-de-from-geo.ts. Wächter stammdaten-de.test.ts 13/13. OpenPLZ (ODbL) bewusst nicht verwendet.
## Evidence
- Commits: ffcfca3255291e25976ed7ae781f0f501ccf0bcb
- Tests: npx vitest run src/__tests__/lib/gemeinden/stammdaten-de.test.ts
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/360
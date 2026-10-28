# fn-29-de-gemeinde-registry-gemeindekalender.4 Registry-Datei data/de-gemeinde-registry.json aus der Vollerhebung

## Description
Aus `docs/research/de-gemeinden/data/vollerhebung-2026-10.csv` die Registry erzeugen: je Gemeinde AGS, Integration, Kalender- bzw. Feed-URL (bei ionas aus `data-source`), Fallback (Amt/VG-Host, meinOrt-ID), Prüfdatum. Erhebungsskripte (`docs/research/de-gemeinden/vollerhebung/`) so ergänzen, dass die Registry reproduzierbar neu entsteht und Änderungen als Diff sichtbar sind.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Je Gemeinde genau ein Eintrag, AGS gegen Stammdaten geprüft (Wächter-Test)
- [ ] Integrationen nur aus der bekannten Liste
- [ ] Neubau-Skript mit Diff-Ausgabe

## Done summary
DE-Gemeinde-Registry (PR #365): data/de-gemeinde-registry.json mit 10.749 Einträgen (Stufe, Integration, Kalender-URL, geprüfter Feed, Ausweichweg Amt/VG bzw. meinOrt, Heimat-Info-ID). Builder npm run build:registry:de [-- --feeds] mit AGS-/Integrations-/Stufenprüfung, Diff, Feed-Lauf (robots.txt, Standardseiten je Hersteller, Abruf mit Formatprüfung); Terminbuchung und Abfallkalender nie Kalender-URL. Stufe A: 2.135 von 3.203 Gemeinden mit geprüftem Feed (67 %), 251 VG-Ausweichwege mit Feed. Wächter registry-de.test.ts 20/20.
## Evidence
- Commits: e6e8abd565c628cfe8385dad966e4d5504e79be1
- Tests: npx vitest run src/__tests__/lib/registry-de
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/365
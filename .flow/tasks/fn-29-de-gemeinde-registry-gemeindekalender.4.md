# fn-29-de-gemeinde-registry-gemeindekalender.4 Registry-Datei data/de-gemeinde-registry.json aus der Vollerhebung

## Description
Aus `docs/research/de-gemeinden/data/vollerhebung-2026-10.csv` die Registry erzeugen: je Gemeinde AGS, Integration, Kalender- bzw. Feed-URL (bei ionas aus `data-source`), Fallback (Amt/VG-Host, meinOrt-ID), Prüfdatum. Erhebungsskripte (`docs/research/de-gemeinden/vollerhebung/`) so ergänzen, dass die Registry reproduzierbar neu entsteht und Änderungen als Diff sichtbar sind.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Je Gemeinde genau ein Eintrag, AGS gegen Stammdaten geprüft (Wächter-Test)
- [ ] Integrationen nur aus der bekannten Liste
- [ ] Neubau-Skript mit Diff-Ausgabe

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

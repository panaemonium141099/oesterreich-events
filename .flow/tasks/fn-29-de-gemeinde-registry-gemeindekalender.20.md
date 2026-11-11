# fn-29-de-gemeinde-registry-gemeindekalender.20 Abnahme: Dorffest-Stichprobe je Land und Quartals-Erhebung

## Description
Je Land mindestens 5 echte Dorffeste (Feuerwehrfest, Kirchweih/Kerwe/Kirmes, Schützenfest, Maifest, Weinfest, Weihnachtsmarkt, Dorffest) aus der Pipeline in der DB, jeweils gegen die Quellseite geprüft (Titel, Datum, Uhrzeit, Ort). Vollerhebung als Quartalslauf einrichten und Stufen-Matrix in `01-vollerhebung.md` fortschreiben.

Rahmenbedingungen: Der Qualitätsvertrag DE im Epic-Spec (`flowctl cat fn-29-de-gemeinde-registry-gemeindekalender`) gilt verbindlich. Belege und Zugriffswege: `docs/research/de-gemeinden/01-vollerhebung.md` und `00-bundesweit.md`.
## Acceptance
- [ ] Stichprobe je Land mit Links im PR
- [ ] Quartalslauf dokumentiert, erste Wiederholung mit Diff

## Done summary
Abnahme fn-29 (Bericht docs/research/de-gemeinden/abnahme-fn29.md, PR #438):
- Dorffest-Stichprobe: 67 Feste aus 14 Ländern gegen die Quellseite (Links je Termin), Titel 66, Datum 66, Uhrzeit 65, Ort 66 von 67, Bild 34 von 35. Behoben mit Golden-Tests in PR #435 (MEC Uhrzeit und Dublette, ionas Anlagezeit, Platzhalterbilder und Seite als Bild, coverage-report per id-Keyset). Offen: berlin.de mit Brandenburger Terminen (Cottbus unter Berlin), Heede-Titel (Verein ohne Trenner). Hamburg und Bremen ohne Dorffest im Gemeindekalender, begründet.
- Abdeckung: 2.773 von 10.749 Gemeinden (25,8 %) mit sichtbarem Termin, Ziel 7.503 nicht erreicht; im Nachtlauf 7.168 zugeordnet, 2.217 mit Termin aus dem eigenen Adapter; Ursachen belegt (verwaltungsportal-Cursor, 456 ionas ohne Feed davon 112 ekom21 nicht erreichbar, Skript-Kalender, Amtskalender, leere Kalender), Lizenz 1.845, ohne Adapter 549, Rest 1.187.
- Quartalslauf: .github/workflows/vollerhebung-de.yml + vollerhebung/run.sh (sites.py, lists_from_prev.py, diff.py, drossel.py). Erste Wiederholung 03.11. (data/vollerhebung-2026-11.csv), Matrix und Diff in 01-vollerhebung.md Abschnitt 9.
## Evidence
- Commits: 0fea092922182dd773ab887534838850f18ded92, 528f1f80f86a8a8984e085c9d7706b76f989d364
- Tests: vitest de-bild, mec-de, ionas-de, amt-vg-de, postgrest-row-cap, date-timezone-guard, site-country-guard grün, coverage-report lokal gegen Prod: 210.440 Termine in 60 s, run.sh Probelauf 25 Gemeinden + volle Wiederholung 254 min
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/435, https://github.com/panaemonium141099/oesterreich-events/pull/438
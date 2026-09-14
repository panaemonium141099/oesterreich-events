# fn-25-ortsdatenqualitat-quelltreue-resolver.17 E1 Bestand kontrolliert bereinigen (Batches, Hash-/Versionsprüfung, alle Felder, ungeklärt sichtbar, Dedup-Prüfung)

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
E1 ausgeführt (Ops-Doku §14): Un-Merge 149 Paare anderer PLZ-Region; Backfill `--with-raw` in drei Läufen (44.624 / 68.196 Zeilen, 0 Fehler, updated_at-Schutz griff bei 38 parallelen Zeilen); Stale-Schritt 6.607 Zeilen (Beleg: sauberer Lauf der Quelle laut scrape_runs/source_runs); DB-Checks validiert. Rest 9.186 Zeilen ohne Entscheidung aus Quellen ohne sauberen Lauf am 14.09. Nebenbefunde behoben: Feed-Platzhalter (#207/#208), Konflikt mit Position (#210), Deskline-Ländernamen (#212), Detailseiten-Heuristik (#209), geteilte Stadt-PLZ (#206), Vertrag im Backfill (#216).
## Evidence
- Commits:
- Tests:
- PRs:
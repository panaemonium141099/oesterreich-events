# fn-25-ortsdatenqualitat-quelltreue-resolver.7 B1 Rohdatensicherung im echten Importpfad (scrape_runs, raw_events, events.raw_event_id, Hash-Dedup, parser_version)

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Rohschicht im echten Importpfad: src/lib/db/raw-persist.ts + supabase-sync (scrape_runs je Aufruf/Lauf, raw_events mit content_hash + parser_version, events.raw_event_id, Hash-Wiederverwendung, needs_review bei Sicherungsfehler); Eventim buendelt Batches in einem Lauf. Selbsttest gegen Prod bestanden. PR #197.
## Evidence
- Commits: b4259f1
- Tests: selftest gegen Prod (fn25-selftest, geloescht)
- PRs: https://github.com/panaemonium141099/oesterreich-events/pull/197
# fn-25-ortsdatenqualitat-quelltreue-resolver.2 A2 Konsistenter Snapshot der Ortsdaten (kontaminierter Ausgangsstand) auf dem Server

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Snapshot-Schema snap_20260913 (227.721 events_location, Master, geocode_cache, venue_aliases, event_quality_scores, meta; 107 MB) plus pg_dump /var/backups/ortsdaten-snapshot-2026-09-13.dump (36 MB, sha256 a3e624d3...). Als kontaminiert gekennzeichnet (Schema-Kommentar + Doku).
## Evidence
- Commits:
- Tests:
- PRs:
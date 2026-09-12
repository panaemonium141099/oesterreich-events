# fn-17-i18n-englische-version-unter-en-next.5 OpenAI-Zugang und Übersetzungsqualität prüfen; Backfill nur nach bestandenem Vergleich migrieren

## Description
The user authorized a small billed OpenAI access check, a comparison on real German event and activity texts against the stored translations, and migration of the existing translation backfill only if access and quality pass. Gemini currently returns 403 PERMISSION_DENIED. Keep provider credentials in their existing runtime.

## Acceptance
- [ ] Record the response status and token usage of a bounded OpenAI request using the actual runtime key.
- [ ] Compare a representative sample, including title-only events, full descriptions, Austrian names/terms, numbers and activities.
- [ ] Preserve schemas, caching, source text, resumption and translation scope; stop on authentication or billing failures.
- [ ] Switch and verify the existing timer only after the comparison passes. Otherwise record the exact blocker and leave production unchanged.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

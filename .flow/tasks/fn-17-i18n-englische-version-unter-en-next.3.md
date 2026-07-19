# fn-17-i18n-englische-version-unter-en-next.3 Slice 3: Lazy-Translation Event-Beschreibungen (on-View + Supabase-Cache) + Event-hreflang/Sitemap-EN

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Lazy-Translation live (PR #81): /en-Event-Seiten uebersetzen sich beim ersten Aufruf via Gemini 2.5 Flash (DB-Cache in events.title_en/description_en, Prod-Migration angewandt). E2E auf Prod verifiziert: Gemini-Call + Write-back + uebersetzter Render (Lumpazivagabundus-Event). hreflang/Sitemap-EN nur bei vorhandener Uebersetzung.
## Evidence
- Commits:
- Tests:
- PRs:
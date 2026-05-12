# fn-15-performance-renovierung-landing-psi-45.11 Image-Proxy auf Cloudflare R2 + Workers (Follow-up, NICHT blocking)

## Description

**STATUS: Out-of-Scope für fn-15-Closure.** Siehe Epic-Spec
`## Out-of-Scope: fn-15.11` Section. Diese Task ist als Tracking-Kontext zu fn-15.1
angelegt aber blockiert NICHT die fn-15-Acceptance.

Hintergrund: Bei ~10k Events × ~5 verschiedene next/image-sizes kommt Vercel
Image Optimization Pro-Quota (5000-25000/Monat) potentiell an Limits. Diese Task
migriert auf Cloudflare R2 + Workers als Long-Tail-Lösung. Pre-Download bei
Scrape-Zeit für Top-1000 Events (sortiert nach event_score), Rest on-demand
via Worker-Proxy mit Cache-aside-Pattern.

**Size:** L (~3-5 Tage)

## Files (high-level)

- `src/lib/image-proxy/r2-uploader.ts` — Scrape-Hook-Integration
- `workers/image-proxy/` — Cloudflare Worker für /image-Route
- `src/scripts/migrate-existing-images-to-r2.ts` — One-off-Migration
- `src/components/Brand/EventImage.tsx` — Loader-Config umstellen auf R2-Worker

## Acceptance (TBD bis Task-Start)

- [ ] TBD — wird ausgefüllt sobald Task gestartet wird

## Notes

Folge-Task, kann erst sinnvoll geplant werden wenn fn-15.1 implementation
zeigt wie EventImage-Loader-Config aussieht.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

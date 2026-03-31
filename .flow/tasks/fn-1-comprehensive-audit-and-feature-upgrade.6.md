# fn-1-comprehensive-audit-and-feature-upgrade.6 Scraper Image Extraction and Validation

## Description
Fix `BaseScraper.extractImageUrl()` which currently returns `undefined` unconditionally (stub). Improve image extraction across scrapers, add URL validation, and implement a fallback strategy for events without images. Update `next.config.ts` remote patterns as needed.

**Size:** M
**Files:** src/lib/scrapers/BaseScraper.ts, src/lib/scrapers/index.ts, src/lib/categoryImages.ts, next.config.ts, selected scraper files

## Approach
- Fix `BaseScraper.extractImageUrl()` at line 97-100 — implement a generic image extraction method that looks for og:image, JSON-LD image, and large img tags
- Audit top 10 scrapers (by event count) to verify they override `extractImageUrl` or rely on the base
- Add `validateImageUrl()` method to BaseScraper — HEAD request with timeout to verify URL resolves (2xx status)
- Enhance `cleanImageUrl()` to detect and replace known placeholder/generic images
- Update `getEventImage()` in `src/lib/categoryImages.ts` — improve fallback chain: event image → category-specific fallback → generic fallback
- Add any new domains to `remotePatterns` in next.config.ts (currently 57 patterns)
- Document which scraper sources provide images and which don't

## Key context
- `cleanImageUrl()` in BaseScraper already filters some known bad patterns — extend this list
- `getEventImage()` in `src/lib/categoryImages.ts` provides category-based fallbacks — referenced but not yet audited
- Image URLs go into the `image_url` column — both SQLite and Supabase
- Next.js Image component requires domains in `remotePatterns` or images 404
## Acceptance
- [ ] `BaseScraper.extractImageUrl()` implements generic image extraction (og:image, JSON-LD, img tags)
- [ ] `validateImageUrl()` method added — HEAD request with 5s timeout
- [ ] `cleanImageUrl()` extended with additional placeholder detection patterns
- [ ] Top 10 scrapers verified for image extraction
- [ ] `next.config.ts` remotePatterns updated for any new domains
- [ ] Fallback chain documented: event image → category fallback → generic
- [ ] `npm run build` succeeds
## Done summary
Implemented BaseScraper.extractImageUrl() with multi-source extraction (og:image, twitter:image, JSON-LD, scored img tags), added validateImageUrl() HEAD-request validator, extended cleanImageUrl() with 20+ additional placeholder patterns, and consolidated next.config.ts remotePatterns under 50 entries using a broad **.at wildcard. Documented full scraper image source inventory in categoryImages.ts.
## Evidence
- Commits: b0360583a33b4b6c48ce523a303b145b3f2f65d9
- Tests: npx vitest run, npm run build
- PRs:
# Tech Debt

Living list of known issues we've decided to defer. Each entry should
have an empirical root cause (not a guess) and a concrete fix path.

---

## Scrapers — broken venue/club fetches (2026-04-27)

Empirically tested with `curl -A "<browser-UA>" --max-time 20 <url>`.
Servers were assumed "down" in scrape logs, but most are actually live —
the scrapers have specific bugs.

| Scraper | URL | Real status | Root cause | Fix |
|---|---|---|---|---|
| **postgarage.at** (graz-clubs) | `https://postgarage.at/` | HTTP **302** | scraper doesn't follow redirects | `fetch(url, { redirect: 'follow' })` or follow-Location loop in `fetchWithRetry` |
| **weekender.at** (innsbruck-clubs) | `https://weekender.at/` | HTTP **200** ✅ | server alive — scraper bug elsewhere | inspect the actual scraper module; URL is fine |
| **szenewien.com** (wien-clubs) | `https://szenewien.com/` | HTTP **200** ✅ | Windows `schannel` TLS handshake fails on this site (we run scraper on Win) | force `tls.connect` with modern protocol, or run scraper on Linux/CI, or use undici with custom dispatcher |
| **republic.at** (salzburg-clubs) | `https://republic.at/` | TLS handshake fail | server uses legacy cipher suite | same as above — Win-`schannel` issue. Try `NODE_OPTIONS=--tls-min-v1.0` or use undici |
| **grelleforelle.com** (wien-clubs) | `https://www.grelleforelle.com/programm/` | HTTP **500** | WAF/bot-detection rejects our requests even with Browser-UA | switch this scraper from cheerio to **Puppeteer** (already used for other JS-heavy sites) |
| **halfmoon.at** (salzburg-clubs) | `https://halfmoon.at/` | HTTP **403** | Cloudflare blocks — even Browser-UA doesn't pass | Puppeteer with stealth, or skip this venue entirely |
| **otbrauerei.at** (wien-clubs) | `https://www.otbrauerei.at/events` | DNS fail | domain truly not resolving (nameserver issue) | find replacement URL or remove from registry |
| **wien.gv.at vadb** (wien-vadb, wien-ogd) | `https://www.wien.gv.at/vadb/internet/AdvPrSrv.asp?...` | HTTP **500** | server returns 500 on the specific query (rate-limit, params length, or seasonal endpoint outage) | reduce date range / SrvRecCnt, exponential backoff with longer delays, or try alternative endpoint |
| **basilika-mariazell.at** | navigation fetch | HTTP **403** | CSRF protection (already known — scraper continues with month 1 data) | accept current behaviour (gets ~199 events/month, 1 month) — or implement CSRF token capture |

**Priority order if/when we tackle this:**

1. **postgarage** — trivial 1-line fix, recovers a club's events.
2. **weekender + szenewien + republic** — Windows TLS issues. Either run scraper on Linux (CI) or swap to `undici` with explicit cipher list. One change covers all three.
3. **wien-vadb / wien-ogd** — biggest data loss (Wien is the largest city). Investigate whether this is a query-params issue (try without query, with smaller date ranges) before assuming WAF.
4. **grelleforelle / halfmoon** — Puppeteer migration. Lower priority because clubs are already covered by other scrapers (wien-clubs, salzburg-clubs sources).
5. **otbrauerei** — find new URL or remove.

**Not tackled in this round.** Pipeline still ingests ~10k events without these. The scrapers fail soft (try once, log, continue), so they don't block other scrapers.

---

## Other tech debt (from session handoff 2026-04-26)

- **4 broken tests in `events.test.ts`** — outdated since cursor-pagination migration. Code is correct, tests need update.
- **Eventim / Oeticket Puppeteer scrapers** — not implemented.
- **Next 16 `middleware.ts` → `proxy.ts`** rename — deprecation warning, works without migration.
- **`is_god()` vs `admin` role on `events.delete()`** — admin can only delete events they created. Decide whether admin should be elevated. 1-line migration.
- **`indexing-api.ts` → shared `loadGoogleServiceAccount`** — cosmetic dedup.
- **Business-Profile-Onboarding** — incomplete (per CLAUDE.md).
- **6 scrapers bypass `scrape-pipeline.ts → quality-scorer.ts`** chain (gemeinde-registry, gemeinden-generic, gem2go, boudicca:*, meinbezirk, feratel-deskline) — partially mitigated by the at-ingest scoring patch in `supabase-sync.ts` (commit 1f47b68), but they still skip live-dedup and venue-matching steps. Permanent fix: route them through the pipeline.
- **`pipeline/quality-scorer.ts` + `pipeline/orchestrator.ts` + `pipeline/canonical-upsert.ts`** — Phase-2 scaffolding. `runPipeline` is never called from production. Either wire them up or delete the dead code.
- **Pre-existing test failures** (~56 in 11 files) — taxonomy v3 drift in `categories.test.ts`, `baseScraper.test.ts`, `EventImage.test.tsx`; phase-2 API drift in `normalize-date.test.ts`, `normalizer.test.ts`; network calls in `import-osm-venues.test.ts`, `backfill-venue-ids.test.ts`. Detected during the at-ingest-scoring rework.
- **`location-normalizer` log spam** — when many events from the same venue (e.g. innsbruck-clubs Treibhaus) trigger the same fuzzy reject, the same line gets logged ~90× per scrape. Needs dedup or move to debug level.

---

Last updated: 2026-04-27

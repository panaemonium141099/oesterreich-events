# Feratel Discovery — Resume the 10k Sweep

## Status (2026-05-26 ~16:24 UTC)
- 3.514 / 10.000 Slugs probed
- 10 new active hits found in 10k sweep (added to feratel-active-urls.txt with [s] flag)
- Stopped because the API's hard rate-limit was reached:
  `API calls quota exceeded! maximum admitted 3500 per 1h.`

## To continue (after 1h cool-down)
```bash
cd scripts/feratel-discovery
node probe-sweep.mjs candidates10k.txt sweep10k.jsonl
# Resumable — skips slugs already in sweep10k.jsonl (~3514)
# After ~3000 more probes, you'll hit the rate-limit again. Wait 1h, repeat.
# Roughly 3 sessions of (1h work + 1h wait) to finish the 6486 remaining slugs.
```

## After finishing the sweep
```bash
# Extract all hits
grep '"ok":true' sweep10k.jsonl | grep -v '"total":0' > sweep10k-hits.jsonl

# Final-verify them (low concurrency, browser UA — ~3 req/s)
grep -oE '"slug":"[^"]+"' sweep10k-hits.jsonl | sed -E 's/"slug":"([^"]+)"/\1/' > sweep10k-hit-slugs.txt
node probe-final.mjs sweep10k-hit-slugs.txt sweep10k-final.jsonl

# Add new hits to FeratelScraper.ts REGIONS array
```

## Hit-rate context
- 88 known codes: 100% verified
- 785 candidates (regions/Bezirke): 9 hits = 1.15%
- 1.780 candidates (expanded tourism): 7 hits = 0.39%
- 10.000 candidates (GeoNames + patterns): 10 hits so far / 3514 probed = 0.28%
- Diminishing returns — expect ~20-30 more hits in the remaining 6486 slugs.

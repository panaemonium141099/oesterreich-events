# fn-7-gemini-ai-geocoding-fallback-expanded.2 Build Gemini Flash geocoding batch script with cache and validation

## Description

New batch script that uses Gemini 2.5 Flash to achieve a CLEAN geocoding state across ALL ~96k events in Austria. Two modes:

1. **--null mode** (default): Resolve events with NULL coordinates
2. **--verify mode**: Re-verify ALL events (not just NULL) — send every unique location to Gemini, compare with existing coords. If Gemini disagrees by >5km, flag or correct. This is the "sauberer Stand" pass.
3. **--all mode**: Combines both — resolve NULLs AND verify existing coords

**Size:** M
**Files:** src/scripts/gemini-geocode.ts (new), package.json (@google/genai)

## Approach

**Install SDK**: `npm install @google/genai`

**Script flow** (src/scripts/gemini-geocode.ts):
1. Load env vars (follow pattern from scrape.ts:4-17 or use tsx --env-file)
2. Require GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY, fail fast if missing
3. Query Supabase based on mode:
   - `--null`: events with latitude IS NULL
   - `--verify`: ALL events (exclude manual/scraper confidence)
   - `--all`: ALL events (exclude manual/scraper)
4. Deduplicate by `normalizeString(location_name) + "||" + bundesland + "||" + title_city_hint` — many events share same venue. Extract city hint from title if present (e.g., "Konzert in Eisenstadt" -> "Eisenstadt") to give Gemini better context
5. For each unique location:
   a. Check SQLite geocode_cache with key `gemini::{normalized_location}||{bundesland}`
   b. If cached: use cached coords
   c. If not cached: call Gemini Flash with structured JSON output
6. Validate result: Austria bbox (lat 46.3-49.1, lng 9.5-17.2)
7. Cache in SQLite geocode_cache
8. Compare with existing coords:
   - NULL coords: write Gemini result directly
   - Existing coords: only overwrite if distance >500m AND existing confidence <= gemini rank
   - Log all corrections for audit
9. Write to Supabase with geocoding_confidence="gemini", geocoding_source="gemini"

**Gemini prompt design**: System prompt constraining to Austrian geography. Include ALL available context: location_name, title, bundesland, address, PLZ. Request JSON with lat, lng, confidence, resolved_name. Few-shot examples of Austrian locations in the system prompt.

**Structured output schema**: `{ latitude: number|null, longitude: number|null, confidence: "high"|"medium"|"low", resolved_name: string }`

**Only accept "high" and "medium" confidence** from Gemini. Reject "low" (treat as unresolvable).

**Rate limiting**: 200ms delay between API calls. Paid tier supports 150+ RPM.

**Dry-run mode**: `--dry-run` flag. Combine with any mode: `--verify --dry-run` shows what would change.

**Checkpoint/resume**: Follow fix-geocoding.ts pattern.

**Backup**: Before --verify or --all mode, create durable backup at data/coord-backup-gemini-YYYY-MM-DD.json.

## Key context

- Use `@google/genai` package (NOT deprecated `@google/generative-ai`)
- Import `GoogleGenAI, Type` from `@google/genai`
- Model: `gemini-2.5-flash`
- GEMINI_API_KEY already in .env.local
- geocode_cache in SQLite: query TEXT PRIMARY KEY, latitude REAL, longitude REAL, cached_at TEXT
- Follow fix-geocoding.ts checkpoint pattern
- Austria bbox validation at geocoding.ts:72-74
- ~96k total events, deduped by location likely <5k-10k unique locations
- Gemini Flash cost: ~$0.30/1M input tokens. 10k locations = maybe $0.05 total

## Acceptance
- [ ] @google/genai installed in package.json
- [ ] --null mode: queries only NULL-coord events
- [ ] --verify mode: queries ALL events (except manual/scraper), compares Gemini vs existing
- [ ] --all mode: combines both
- [ ] Deduplicates by location_name + bundesland
- [ ] Uses Gemini structured JSON output with responseJsonSchema
- [ ] Only accepts high/medium confidence from Gemini
- [ ] Austria bbox validation on all results
- [ ] Caches results in SQLite geocode_cache (prefixed key)
- [ ] --verify mode only overwrites when distance >500m AND confidence allows
- [ ] Creates backup before --verify/--all mode
- [ ] --dry-run mode works with all modes
- [ ] Checkpoint/resume works
- [ ] Rate-limited (200ms between calls)
- [ ] Audit log: logs every correction (old coords -> new coords, distance)
- [ ] Fails fast if GEMINI_API_KEY missing
- [ ] All existing tests pass

## Done summary
TBD
## Evidence
- Commits:
- Tests:
- PRs:

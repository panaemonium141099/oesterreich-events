# Quality System Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete event quality pipeline (Raw Layer, Normalization, Matching, Quality Scoring) with admin UI, replacing the existing direct-upsert scraper flow.

**Architecture:** Scrapers remain unchanged (return `ScrapedEvent[]`). A new batched pipeline orchestrator writes to `raw_events` -> `normalized_event_candidates` -> `events` (canonical) -> `event_quality_scores` + `quality_flags`. The admin panel is rebuilt with a new sidebar layout and 4 new pages (Overview, Scraper Runs, Quality, Sources).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase PostgreSQL, Tailwind CSS v4, Lucide Icons, Vitest

**Spec:** `docs/superpowers/specs/2026-04-07-quality-system-phase1-design.md`

---

## File Structure

### New Pipeline Files
```
src/lib/pipeline/
  types.ts                    -- Pipeline types (PipelineResult, MetricsAccumulator, NormalizedCandidate, etc.)
  raw-layer.ts                -- createScrapeRun(), writeRawEvents(), finalizeScrapeRun()
  normalize-title.ts          -- normalizeTitle(), normalizeTitleCompact()
  normalize-date.ts           -- normalizeDate() with precision tracking
  normalize-url.ts            -- normalizeUrl(), hashUrl()
  normalizer.ts               -- normalizeEvents() orchestrator combining title/date/url/location
  matcher.ts                  -- candidateSearch(), mergeDecision() using existing dedup
  canonical-upsert.ts         -- matchAndUpsert() writing to events table
  quality-scorer.ts           -- scoreAndPublish(), computeQualityScore(), generateFlags()
  orchestrator.ts             -- runPipeline() replacing runScraper()
```

### New Test Files
```
src/__tests__/pipeline/
  normalize-title.test.ts
  normalize-date.test.ts
  normalize-url.test.ts
  normalizer.test.ts
  quality-scorer.test.ts
  matcher.test.ts
  orchestrator.test.ts
```

### New Admin Files
```
src/app/admin/
  layout.tsx                  -- NEW: Sidebar layout
  page.tsx                    -- MODIFY: Redirect to /admin/overview
  overview/page.tsx           -- NEW: Dashboard
  scraper-runs/page.tsx       -- NEW: Run history + controls
  quality/page.tsx            -- NEW: Flag review
  sources/page.tsx            -- NEW: Source metrics
  events/page.tsx             -- NEW: Migrated + extended events tab
  users/page.tsx              -- NEW: Migrated users tab (existing logic)
  analytics/page.tsx          -- NEW: Migrated analytics tab (existing AnalyticsPanel)
  moderation/page.tsx         -- NEW: Migrated moderation tab (existing logic)

src/components/Admin/
  AdminSidebar.tsx            -- NEW: Navigation sidebar
  StatCard.tsx                -- NEW: Reusable stat card
  DataTable.tsx               -- NEW: Sortable/filterable table
  StatusBadge.tsx             -- NEW: Status badges
  SeverityBadge.tsx           -- NEW: Severity badges
  ScoreBar.tsx                -- NEW: Quality score bar (0-100)
```

### New Admin API Files
```
src/app/api/admin/
  scrape-runs/route.ts              -- NEW: GET scrape runs
  scrape-runs/[id]/route.ts         -- NEW: GET single run + raw events
  quality-flags/route.ts            -- NEW: GET flags
  quality-flags/[id]/resolve/route.ts -- NEW: POST resolve flag
  events/[id]/publish-status/route.ts -- NEW: PATCH publish status
  sources/route.ts                  -- NEW: GET source metrics
```

### New Script Files
```
src/scripts/backfill-quality.ts     -- Backfill scoring for existing events (dry-run + live)
```

### Modified Existing Files
```
src/lib/scrapers/index.ts           -- MODIFY: Replace runScraper() with pipeline call
src/scripts/scrape.ts               -- MODIFY: Use new pipeline
src/app/api/events/route.ts         -- MODIFY: Add publish_status filter
src/app/events/[id]/page.tsx        -- MODIFY: noindex for low_confidence, 404 for suppressed
src/app/sitemap.ts                  -- MODIFY: Only published events
src/types/events.ts                 -- MODIFY: Add publish_status, quality_score, raw_event_id to Event
```

---

## Task 1: Pipeline Types

**Files:**
- Create: `src/lib/pipeline/types.ts`
- Test: `src/__tests__/pipeline/types.test.ts` (type-only, compile check)

- [ ] **Step 1: Create pipeline types file**

```typescript
// src/lib/pipeline/types.ts
import type { ScrapedEvent } from '@/types/events';

// --- Raw Layer ---

export interface ScrapeRunRow {
  id: string;
  source_name: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'error' | 'partial';
  duration_ms: number | null;
  items_found: number;
  items_parsed: number;
  raw_written: number;
  normalized_count: number;
  matched_count: number;
  items_inserted: number;
  items_updated: number;
  items_skipped: number;
  suppressed_count: number;
  needs_review_count: number;
  successful_batches: number;
  parser_errors: number;
  http_errors: number;
  batch_errors: number;
  duplicate_candidates: number;
  events_without_date: number;
  events_without_location: number;
  events_without_coords: number;
  avg_quality_score: number | null;
  notes_json: Record<string, unknown> | null;
  error_message: string | null;
}

export interface RawEventRow {
  id: string;
  scrape_run_id: string;
  source_name: string;
  source_event_id: string | null;
  source_url: string | null;
  raw_title: string | null;
  raw_description: string | null;
  raw_start_text: string | null;
  raw_end_text: string | null;
  raw_location_name: string | null;
  raw_address: string | null;
  raw_image_url: string | null;
  raw_ticket_url: string | null;
  raw_payload_json: Record<string, unknown> | null;
  content_hash: string;
  fetched_at: string;
}

// --- Normalization ---

export type DatePrecision = 'exact' | 'day_only' | 'inferred';
export type EndDatePrecision = DatePrecision | 'missing';

export interface NormalizedDateResult {
  startAt: Date | null;
  endAt: Date | null;
  startPrecision: DatePrecision | null;
  endPrecision: EndDatePrecision;
}

export interface NormalizedCandidate {
  id?: string;
  raw_event_id: string;
  normalized_title: string | null;
  normalized_title_compact: string | null;
  normalized_start_at: string | null;
  normalized_end_at: string | null;
  start_precision: DatePrecision | null;
  end_precision: EndDatePrecision;
  normalized_location_name: string | null;
  normalized_address: string | null;
  normalized_city: string | null;
  normalized_postal_code: string | null;
  normalized_bundesland: string | null;
  normalized_category: string | null;
  normalized_organizer: string | null;
  normalized_ticket_url: string | null;
  normalized_source_url: string | null;
  normalized_image_url: string | null;
  language_code: string;
  parse_confidence: number | null;
  normalization_version: number;
}

// --- Matching ---

export interface UpsertResults {
  matched: number;
  inserted: number;
  updated: number;
  eventIds: string[];
  skipped: number;
}

// --- Quality ---

export type FlagType =
  | 'missing_time'
  | 'missing_location'
  | 'missing_description'
  | 'description_too_short'
  | 'missing_image'
  | 'outside_austria'
  | 'location_ambiguous'
  | 'dead_source_url'
  | 'dead_ticket_url'
  | 'date_in_past'
  | 'date_implausible'
  | 'duplicate_uncertain'
  | 'missing_date_context';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type PublishStatus =
  | 'draft'
  | 'published'
  | 'published_low_confidence'
  | 'suppressed'
  | 'needs_review'
  | 'expired';

export interface QualityFlag {
  event_id: string;
  flag_type: FlagType;
  severity: Severity;
  details_json: Record<string, unknown> | null;
}

export interface QualityScoreRow {
  event_id: string;
  completeness_score: number;
  date_score: number;
  location_score: number;
  image_score: number;
  link_score: number;
  dedup_confidence_score: number;
  source_trust_score: number;
  final_quality_score: number;
  scoring_version: number;
}

export interface QualityResults {
  suppressed: number;
  needsReview: number;
  published: number;
  publishedLowConfidence: number;
}

// --- Orchestrator ---

export interface MetricsAccumulator {
  items_found: number;
  items_parsed: number;
  raw_written: number;
  normalized_count: number;
  matched_count: number;
  items_inserted: number;
  items_updated: number;
  items_skipped: number;
  suppressed_count: number;
  needs_review_count: number;
  successful_batches: number;
  parser_errors: number;
  http_errors: number;
  batch_errors: number;
  duplicate_candidates: number;
  events_without_date: number;
  events_without_location: number;
  events_without_coords: number;
}

export function createMetricsAccumulator(): MetricsAccumulator {
  return {
    items_found: 0, items_parsed: 0, raw_written: 0, normalized_count: 0,
    matched_count: 0, items_inserted: 0, items_updated: 0, items_skipped: 0,
    suppressed_count: 0, needs_review_count: 0, successful_batches: 0,
    parser_errors: 0, http_errors: 0, batch_errors: 0,
    duplicate_candidates: 0, events_without_date: 0,
    events_without_location: 0, events_without_coords: 0,
  };
}

export interface PipelineResult {
  runId: string;
  metrics: MetricsAccumulator;
  status: 'success' | 'error' | 'partial';
}

/** Chunk array into batches */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/pipeline/types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/types.ts
git commit -m "feat(pipeline): add pipeline type definitions

Types for Raw Layer, Normalization, Matching, Quality Scoring,
and Orchestrator. Includes MetricsAccumulator, QualityFlag,
PublishStatus, and utility functions."
```

---

## Task 2: Supabase Migrations

**Files:**
- Uses Supabase MCP tools to apply migrations

- [ ] **Step 1: Apply migration — create scrape_runs table**

Use `mcp__supabase__apply_migration` with name `create_scrape_runs` and the SQL from spec section 1.1.

- [ ] **Step 2: Apply migration — create raw_events table**

Use `mcp__supabase__apply_migration` with name `create_raw_events` and the SQL from spec section 1.2 (including all 3 unique indexes).

- [ ] **Step 3: Apply migration — create normalized_event_candidates table**

Use `mcp__supabase__apply_migration` with name `create_normalized_event_candidates` and the SQL from spec section 1.3.

- [ ] **Step 4: Apply migration — create event_quality_scores table**

Use `mcp__supabase__apply_migration` with name `create_event_quality_scores` and the SQL from spec section 1.4.

- [ ] **Step 5: Apply migration — create quality_flags table**

Use `mcp__supabase__apply_migration` with name `create_quality_flags` and the SQL from spec section 1.5.

- [ ] **Step 6: Apply migration — extend events table**

Use `mcp__supabase__apply_migration` with name `extend_events_quality_columns` and the SQL from spec section 1.6. This adds `publish_status`, `quality_score`, and `raw_event_id` columns with indexes. The default for `publish_status` is `'published'` so existing events keep working.

- [ ] **Step 7: Verify all tables exist**

Run: `mcp__supabase__list_tables` for schema `public` with verbose=true. Verify `scrape_runs`, `raw_events`, `normalized_event_candidates`, `event_quality_scores`, `quality_flags` all exist with correct columns.

- [ ] **Step 8: Commit (no local file changes — migrations are in Supabase)**

Note: Supabase migrations are tracked server-side. No local commit needed unless migration SQL files are stored locally.

---

## Task 3: Title Normalizer

**Files:**
- Create: `src/lib/pipeline/normalize-title.ts`
- Create: `src/__tests__/pipeline/normalize-title.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/normalize-title.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeTitle, normalizeTitleCompact } from '@/lib/pipeline/normalize-title';

describe('normalizeTitle', () => {
  it('lowercases and trims', () => {
    expect(normalizeTitle('  TECHNO FRIDAY  ')).toBe('techno friday');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeTitle('techno   friday   night')).toBe('techno friday night');
  });

  it('normalizes unicode NFC', () => {
    // ä as a + combining umlaut → single ä character
    expect(normalizeTitle('M\u00FCnchen')).toBe('münchen');
  });

  it('removes emojis', () => {
    expect(normalizeTitle('Party 🎉 Night 🔥')).toBe('party night');
  });

  it('removes decorative separators', () => {
    expect(normalizeTitle('TECHNO FRIDAY | FLEX VIENNA | Official Event'))
      .toBe('techno friday flex vienna official event');
    expect(normalizeTitle('Event — Special >>> Edition'))
      .toBe('event special edition');
  });

  it('preserves hyphens in compound words', () => {
    expect(normalizeTitle('Open-Air Festival')).toBe('open-air festival');
  });
});

describe('normalizeTitleCompact', () => {
  it('removes parenthetical content', () => {
    expect(normalizeTitleCompact('Techno Night (Official Event)'))
      .toBe('techno night');
    expect(normalizeTitleCompact('Rave [LIVE]')).toBe('rave');
  });

  it('removes weekday names (German)', () => {
    expect(normalizeTitleCompact('Montag Clubnight')).toBe('clubnight');
    expect(normalizeTitleCompact('Freitag Special')).toBe('special');
  });

  it('removes weekday names (English)', () => {
    expect(normalizeTitleCompact('Friday Night Fever')).toBe('night fever');
  });

  it('removes date fragments', () => {
    expect(normalizeTitleCompact('Festival 14. Juni')).toBe('festival');
    expect(normalizeTitleCompact('Party 14.06.')).toBe('party');
    expect(normalizeTitleCompact('Event 14.06.2026')).toBe('event');
  });

  it('removes marketing words', () => {
    expect(normalizeTitleCompact('Official Presents Special Tour'))
      .toBe('');
    expect(normalizeTitleCompact('DJ Set Live Special'))
      .toBe('dj set');
  });

  it('handles complex real-world title', () => {
    expect(normalizeTitleCompact('TECHNO FRIDAY | FLEX VIENNA | Official Event'))
      .toBe('techno friday flex vienna');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/normalize-title.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement normalize-title.ts**

```typescript
// src/lib/pipeline/normalize-title.ts

const DECORATIVE_SEPARATORS = /\s*[|•—–>>>]+\s*/g;
const EMOJI_REGEX = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
const MULTI_SPACE = /\s{2,}/g;
const PARENTHETICAL = /\s*[\(\[][^\)\]]*[\)\]]\s*/g;

const WEEKDAYS_DE = /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/gi;
const WEEKDAYS_EN = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

// Matches: "14. Juni", "14.06.", "14.06.2026", "14. Juni 2026"
const DATE_FRAGMENTS = /\b\d{1,2}\.\s*(?:jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|\d{1,2}\.?\s*(?:\d{2,4})?)\b/gi;

const MARKETING_WORDS = /\b(official|presents?|live|special|tour|edition)\b/gi;

/**
 * Full normalized title: lowercase, trimmed, separators removed, emojis removed.
 * Preserves all semantic content.
 */
export function normalizeTitle(title: string): string {
  let result = title.normalize('NFC');
  result = result.toLowerCase();
  result = result.replace(EMOJI_REGEX, '');
  result = result.replace(DECORATIVE_SEPARATORS, ' ');
  result = result.replace(MULTI_SPACE, ' ');
  result = result.trim();
  return result;
}

/**
 * Compact normalized title: everything from normalizeTitle() plus removal of
 * parentheticals, weekdays, date fragments, marketing words.
 * Used for dedup candidate search only, NOT as sole merge criterion.
 */
export function normalizeTitleCompact(title: string): string {
  let result = normalizeTitle(title);
  result = result.replace(PARENTHETICAL, ' ');
  result = result.replace(WEEKDAYS_DE, '');
  result = result.replace(WEEKDAYS_EN, '');
  result = result.replace(DATE_FRAGMENTS, '');
  result = result.replace(MARKETING_WORDS, '');
  result = result.replace(MULTI_SPACE, ' ');
  result = result.trim();
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/normalize-title.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/normalize-title.ts src/__tests__/pipeline/normalize-title.test.ts
git commit -m "feat(pipeline): add title normalizer with full + compact variants

Removes emojis, decorative separators, normalizes unicode.
Compact variant strips parentheticals, weekdays, dates, marketing words."
```

---

## Task 4: Date Normalizer

**Files:**
- Create: `src/lib/pipeline/normalize-date.ts`
- Create: `src/__tests__/pipeline/normalize-date.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/normalize-date.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeDate } from '@/lib/pipeline/normalize-date';

describe('normalizeDate', () => {
  it('parses ISO 8601 datetime as exact', () => {
    const result = normalizeDate('2026-06-14T20:00:00');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('exact');
    expect(result.startAt!.toISOString()).toContain('2026-06-14');
  });

  it('parses German date format as exact', () => {
    const result = normalizeDate('Freitag, 14. Juni 2026, 20 Uhr');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('exact');
  });

  it('parses short date format DD.MM.YYYY as day_only', () => {
    const result = normalizeDate('14.06.2026');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('day_only');
  });

  it('parses date without time as day_only', () => {
    const result = normalizeDate('14. Juni 2026');
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('day_only');
  });

  it('uses Europe/Vienna midnight for day_only (not 00:00 UTC)', () => {
    const result = normalizeDate('14.06.2026');
    // CET/CEST offset: June is CEST = UTC+2, so midnight Vienna = 22:00 UTC day before
    expect(result.startAt!.getUTCHours()).toBe(22);
    expect(result.startAt!.getUTCDate()).toBe(13);
  });

  it('parses date range as multi-day event', () => {
    const result = normalizeDate('14.–16. Juni 2026');
    expect(result.startAt).not.toBeNull();
    expect(result.endAt).not.toBeNull();
    expect(result.endPrecision).not.toBe('missing');
  });

  it('returns null startAt for unparseable input', () => {
    const result = normalizeDate('TBD');
    expect(result.startAt).toBeNull();
    expect(result.startPrecision).toBeNull();
  });

  it('sets end_precision to missing when no end date', () => {
    const result = normalizeDate('14.06.2026');
    expect(result.endAt).toBeNull();
    expect(result.endPrecision).toBe('missing');
  });

  it('handles "ab 19:30" with date context', () => {
    const result = normalizeDate('ab 19:30', { dateContext: '2026-06-14' });
    expect(result.startAt).not.toBeNull();
    expect(result.startPrecision).toBe('inferred');
  });

  it('returns null for "ab 19:30" without date context', () => {
    const result = normalizeDate('ab 19:30');
    expect(result.startAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/normalize-date.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement normalize-date.ts**

```typescript
// src/lib/pipeline/normalize-date.ts
import type { NormalizedDateResult, DatePrecision, EndDatePrecision } from './types';

interface DateContext {
  dateContext?: string; // YYYY-MM-DD from URL, page title, etc.
}

const MONTHS_DE: Record<string, number> = {
  'jänner': 0, 'januar': 0, 'februar': 1, 'märz': 2, 'april': 3,
  'mai': 4, 'juni': 5, 'juli': 6, 'august': 7, 'september': 8,
  'oktober': 9, 'november': 10, 'dezember': 11,
};

const VIENNA_TZ = 'Europe/Vienna';

function toViennaMidnightUTC(year: number, month: number, day: number): Date {
  // Create date string for Vienna midnight, then parse in Vienna timezone
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
  // Use Intl to get UTC offset for Vienna at this date
  const tempDate = new Date(dateStr + 'Z');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VIENNA_TZ,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(tempDate);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value ?? '+01:00';
  const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 1;
  return new Date(dateStr + `${offsetHours >= 0 ? '+' : ''}${String(offsetHours).padStart(2, '0')}:00`);
}

function toViennaTimeUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  const tempDate = new Date(dateStr + 'Z');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: VIENNA_TZ,
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(tempDate);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value ?? '+01:00';
  const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 1;
  return new Date(dateStr + `${offsetHours >= 0 ? '+' : ''}${String(offsetHours).padStart(2, '0')}:00`);
}

// ISO 8601: 2026-06-14T20:00:00 or 2026-06-14
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;

// German: "Freitag, 14. Juni 2026, 20 Uhr" or "14. Juni 2026, 20:30"
const DE_DATETIME = /(\d{1,2})\.\s*(jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})(?:[,\s]+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i;

// Short: 14.06.2026
const SHORT_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

// Range: 14.–16. Juni 2026 or 14.-16.06.2026
const DATE_RANGE_DE = /(\d{1,2})\.?\s*[–\-]\s*(\d{1,2})\.\s*(jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})/i;
const DATE_RANGE_SHORT = /(\d{1,2})\.(\d{1,2})\.\s*[–\-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/;

// Time only: "ab 19:30" or "19:30 Uhr"
const TIME_ONLY = /(?:ab\s+)?(\d{1,2}):(\d{2})\s*(?:uhr)?/i;

export function normalizeDate(input: string, context?: DateContext): NormalizedDateResult {
  const trimmed = input.trim();
  const empty: NormalizedDateResult = { startAt: null, endAt: null, startPrecision: null, endPrecision: 'missing' };

  // 1. ISO 8601
  const isoMatch = trimmed.match(ISO_DATETIME);
  if (isoMatch) {
    const [, y, m, d, h, min] = isoMatch;
    const hasTime = h !== undefined;
    const date = hasTime
      ? toViennaTimeUTC(+y, +m - 1, +d, +h, +(min ?? '0'))
      : toViennaMidnightUTC(+y, +m - 1, +d);
    return {
      startAt: date,
      endAt: null,
      startPrecision: hasTime ? 'exact' : 'day_only',
      endPrecision: 'missing',
    };
  }

  // 2. Date range (German month names)
  const rangeDeMatch = trimmed.match(DATE_RANGE_DE);
  if (rangeDeMatch) {
    const [, startDay, endDay, monthStr, year] = rangeDeMatch;
    const month = MONTHS_DE[monthStr.toLowerCase()];
    if (month !== undefined) {
      return {
        startAt: toViennaMidnightUTC(+year, month, +startDay),
        endAt: toViennaMidnightUTC(+year, month, +endDay),
        startPrecision: 'day_only',
        endPrecision: 'day_only',
      };
    }
  }

  // 3. Date range (short format)
  const rangeShortMatch = trimmed.match(DATE_RANGE_SHORT);
  if (rangeShortMatch) {
    const [, sd, sm, ed, em, year] = rangeShortMatch;
    return {
      startAt: toViennaMidnightUTC(+year, +sm - 1, +sd),
      endAt: toViennaMidnightUTC(+year, +em - 1, +ed),
      startPrecision: 'day_only',
      endPrecision: 'day_only',
    };
  }

  // 4. German date with optional time
  const deMatch = trimmed.match(DE_DATETIME);
  if (deMatch) {
    const [, day, monthStr, year, hour, minute] = deMatch;
    const month = MONTHS_DE[monthStr.toLowerCase()];
    if (month !== undefined) {
      const hasTime = hour !== undefined;
      const date = hasTime
        ? toViennaTimeUTC(+year, month, +day, +hour, +(minute ?? '0'))
        : toViennaMidnightUTC(+year, month, +day);
      return {
        startAt: date,
        endAt: null,
        startPrecision: hasTime ? 'exact' : 'day_only',
        endPrecision: 'missing',
      };
    }
  }

  // 5. Short date DD.MM.YYYY
  const shortMatch = trimmed.match(SHORT_DATE);
  if (shortMatch) {
    const [, d, m, y] = shortMatch;
    return {
      startAt: toViennaMidnightUTC(+y, +m - 1, +d),
      endAt: null,
      startPrecision: 'day_only',
      endPrecision: 'missing',
    };
  }

  // 6. Time only with context
  const timeMatch = trimmed.match(TIME_ONLY);
  if (timeMatch && context?.dateContext) {
    const [, h, min] = timeMatch;
    const ctxMatch = context.dateContext.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (ctxMatch) {
      const [, y, m, d] = ctxMatch;
      return {
        startAt: toViennaTimeUTC(+y, +m - 1, +d, +h, +min),
        endAt: null,
        startPrecision: 'inferred',
        endPrecision: 'missing',
      };
    }
  }

  // 7. Unparseable
  return empty;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/normalize-date.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/normalize-date.ts src/__tests__/pipeline/normalize-date.test.ts
git commit -m "feat(pipeline): add date normalizer with precision tracking

Parses ISO 8601, German dates, short dates, date ranges.
Tracks precision (exact/day_only/inferred/missing).
Uses Europe/Vienna timezone for day_only midnight conversion."
```

---

## Task 5: URL Normalizer

**Files:**
- Create: `src/lib/pipeline/normalize-url.ts`
- Create: `src/__tests__/pipeline/normalize-url.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/normalize-url.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeUrl, hashUrl } from '@/lib/pipeline/normalize-url';

describe('normalizeUrl', () => {
  it('removes tracking parameters', () => {
    expect(normalizeUrl('https://example.com/event?utm_source=google&id=123'))
      .toBe('https://example.com/event?id=123');
  });

  it('removes fbclid and gclid', () => {
    expect(normalizeUrl('https://example.com/event?fbclid=abc&gclid=def'))
      .toBe('https://example.com/event');
  });

  it('upgrades http to https', () => {
    expect(normalizeUrl('http://example.com/event'))
      .toBe('https://example.com/event');
  });

  it('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/event/'))
      .toBe('https://example.com/event');
  });

  it('removes fragment', () => {
    expect(normalizeUrl('https://example.com/event#section'))
      .toBe('https://example.com/event');
  });

  it('preserves www', () => {
    expect(normalizeUrl('https://www.example.com/event'))
      .toBe('https://www.example.com/event');
  });

  it('preserves functional parameters', () => {
    expect(normalizeUrl('https://example.com/event?id=123&page=2'))
      .toBe('https://example.com/event?id=123&page=2');
  });

  it('returns null for invalid URLs', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('not-a-url')).toBeNull();
  });
});

describe('hashUrl', () => {
  it('produces consistent SHA256 hash', () => {
    const hash1 = hashUrl('https://example.com/event');
    const hash2 = hashUrl('https://example.com/event');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA256 hex
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/normalize-url.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement normalize-url.ts**

```typescript
// src/lib/pipeline/normalize-url.ts
import { createHash } from 'crypto';

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid',
  'ref', '_ga', '_gl',
]);

export function normalizeUrl(url: string): string | null {
  if (!url || url.length === 0) return null;
  try {
    let parsed: URL;
    try {
      // Upgrade http to https
      const withScheme = url.startsWith('http') ? url : `https://${url}`;
      parsed = new URL(withScheme.replace(/^http:\/\//, 'https://'));
    } catch {
      return null;
    }

    // Remove fragment
    parsed.hash = '';

    // Remove tracking params (whitelist-based)
    const params = new URLSearchParams(parsed.search);
    for (const key of [...params.keys()]) {
      if (TRACKING_PARAMS.has(key)) {
        params.delete(key);
      }
    }
    parsed.search = params.toString() ? `?${params.toString()}` : '';

    // Remove trailing slash (but not for root path)
    let result = parsed.toString();
    if (result.endsWith('/') && parsed.pathname !== '/') {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return null;
  }
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/normalize-url.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/normalize-url.ts src/__tests__/pipeline/normalize-url.test.ts
git commit -m "feat(pipeline): add URL normalizer with tracking param removal

Whitelist-based removal of utm_*, fbclid, gclid, etc.
Upgrades http to https, removes trailing slash and fragments.
Preserves functional parameters. Includes SHA256 hash utility."
```

---

## Task 6: Raw Layer

**Files:**
- Create: `src/lib/pipeline/raw-layer.ts`

- [ ] **Step 1: Implement raw-layer.ts**

```typescript
// src/lib/pipeline/raw-layer.ts
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import type { RawEventRow, ScrapeRunRow, MetricsAccumulator } from './types';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function computeContentHash(event: ScrapedEvent): string {
  const payload = JSON.stringify({
    title: event.title,
    start_date: event.start_date,
    location_name: event.location_name,
    description: event.description?.slice(0, 500),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function createScrapeRun(sourceName: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('scrape_runs')
    .insert({ source_name: sourceName, status: 'running' })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create scrape run: ${error.message}`);
  return data.id;
}

export async function writeRawEvents(
  runId: string,
  events: ScrapedEvent[],
): Promise<RawEventRow[]> {
  const supabase = getSupabaseAdmin();
  const rows = events.map((e) => ({
    scrape_run_id: runId,
    source_name: e.source_name,
    source_event_id: e.source_id || null,
    source_url: e.source_url || null,
    raw_title: e.title || null,
    raw_description: e.description || null,
    raw_start_text: e.start_date || null,
    raw_end_text: e.end_date || null,
    raw_location_name: e.location_name || null,
    raw_address: e.address || null,
    raw_image_url: e.image_url || null,
    raw_ticket_url: e.ticket_url || null,
    raw_payload_json: e as unknown as Record<string, unknown>,
    content_hash: computeContentHash(e),
  }));

  const { data, error } = await supabase
    .from('raw_events')
    .upsert(rows, { onConflict: 'source_name,source_event_id,scrape_run_id' })
    .select();

  if (error) throw new Error(`Failed to write raw events: ${error.message}`);
  return (data ?? []) as RawEventRow[];
}

export async function finalizeScrapeRun(
  runId: string,
  updates: Partial<ScrapeRunRow> & { status: string },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const finishedAt = new Date().toISOString();
  const { error } = await supabase
    .from('scrape_runs')
    .update({
      ...updates,
      finished_at: finishedAt,
    })
    .eq('id', runId);
  if (error) throw new Error(`Failed to finalize scrape run: ${error.message}`);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/pipeline/raw-layer.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/raw-layer.ts
git commit -m "feat(pipeline): add raw layer for scrape_runs and raw_events

Creates scrape runs, writes raw events with content hashing,
finalizes runs with metrics. Never overwrites existing raw data."
```

---

## Task 7: Normalizer (Orchestrator combining title/date/url/location)

**Files:**
- Create: `src/lib/pipeline/normalizer.ts`
- Create: `src/__tests__/pipeline/normalizer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/normalizer.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeRawEvent } from '@/lib/pipeline/normalizer';
import type { RawEventRow } from '@/lib/pipeline/types';

function makeRawEvent(overrides: Partial<RawEventRow> = {}): RawEventRow {
  return {
    id: 'raw-1',
    scrape_run_id: 'run-1',
    source_name: 'test',
    source_event_id: 'evt-1',
    source_url: 'https://example.com/event/1',
    raw_title: 'TECHNO FRIDAY | FLEX VIENNA',
    raw_description: 'A great party',
    raw_start_text: '14.06.2026',
    raw_end_text: null,
    raw_location_name: 'Flex Wien',
    raw_address: 'Donaukanal, 1010 Wien',
    raw_image_url: 'https://example.com/img.jpg',
    raw_ticket_url: 'https://tickets.com/buy?utm_source=scraper&id=123',
    raw_payload_json: null,
    content_hash: 'abc123',
    fetched_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('normalizeRawEvent', () => {
  it('normalizes title to full and compact versions', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate?.normalized_title).toBe('techno friday flex vienna');
    expect(result.candidate?.normalized_title_compact).toBe('techno friday flex vienna');
  });

  it('normalizes date with precision', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate?.normalized_start_at).not.toBeNull();
    expect(result.candidate?.start_precision).toBe('day_only');
  });

  it('normalizes URLs by removing tracking params', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate?.normalized_ticket_url).toBe('https://tickets.com/buy?id=123');
  });

  it('returns error for events with no title', () => {
    const result = normalizeRawEvent(makeRawEvent({ raw_title: null }));
    expect(result.error).toBeTruthy();
    expect(result.candidate).toBeNull();
  });

  it('sets normalization_version to 1', () => {
    const result = normalizeRawEvent(makeRawEvent());
    expect(result.candidate?.normalization_version).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/normalizer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement normalizer.ts**

```typescript
// src/lib/pipeline/normalizer.ts
import type { RawEventRow, NormalizedCandidate } from './types';
import { normalizeTitle, normalizeTitleCompact } from './normalize-title';
import { normalizeDate } from './normalize-date';
import { normalizeUrl } from './normalize-url';
import { normalizeLocation } from '@/lib/location-normalizer';
import { categorizeEvent } from '@/lib/categories';

const NORMALIZATION_VERSION = 1;

interface NormalizeResult {
  candidate: NormalizedCandidate | null;
  error: string | null;
}

export function normalizeRawEvent(raw: RawEventRow): NormalizeResult {
  // Title is required
  if (!raw.raw_title || raw.raw_title.trim().length === 0) {
    return { candidate: null, error: 'missing_title' };
  }

  // Normalize title
  const normalizedTitle = normalizeTitle(raw.raw_title);
  const normalizedTitleCompact = normalizeTitleCompact(raw.raw_title);

  // Normalize date
  const dateResult = normalizeDate(raw.raw_start_text ?? '');

  // Normalize URLs
  const normalizedTicketUrl = raw.raw_ticket_url ? normalizeUrl(raw.raw_ticket_url) : null;
  const normalizedSourceUrl = raw.source_url ? normalizeUrl(raw.source_url) : null;

  // Normalize location using existing location-normalizer
  const locationResult = raw.raw_location_name
    ? normalizeLocation(raw.raw_location_name)
    : null;

  // Extract city from address if available
  const cityFromAddress = raw.raw_address?.match(/\d{4}\s+(\w+)/)?.[1] ?? null;

  // Categorize
  const category = categorizeEvent(raw.raw_title, raw.raw_description ?? '');

  const candidate: NormalizedCandidate = {
    raw_event_id: raw.id,
    normalized_title: normalizedTitle,
    normalized_title_compact: normalizedTitleCompact,
    normalized_start_at: dateResult.startAt?.toISOString() ?? null,
    normalized_end_at: dateResult.endAt?.toISOString() ?? null,
    start_precision: dateResult.startPrecision,
    end_precision: dateResult.endPrecision,
    normalized_location_name: locationResult?.canonicalName ?? raw.raw_location_name ?? null,
    normalized_address: raw.raw_address ?? null,
    normalized_city: locationResult?.bundesland ? null : cityFromAddress,
    normalized_postal_code: raw.raw_address?.match(/\b(\d{4})\b/)?.[1] ?? null,
    normalized_bundesland: locationResult?.bundesland ?? null,
    normalized_category: category ?? null,
    normalized_organizer: null, // Not available from raw data in Phase 1
    normalized_ticket_url: normalizedTicketUrl,
    normalized_source_url: normalizedSourceUrl,
    normalized_image_url: raw.raw_image_url ?? null,
    language_code: 'de',
    parse_confidence: computeParseConfidence(dateResult, locationResult),
    normalization_version: NORMALIZATION_VERSION,
  };

  return { candidate, error: null };
}

function computeParseConfidence(
  dateResult: ReturnType<typeof normalizeDate>,
  locationResult: { confidence: string } | null,
): number {
  let confidence = 0.5; // base
  if (dateResult.startAt) confidence += 0.2;
  if (dateResult.startPrecision === 'exact') confidence += 0.1;
  if (locationResult?.confidence === 'exact') confidence += 0.2;
  else if (locationResult?.confidence === 'normalized') confidence += 0.1;
  return Math.min(confidence, 1.0);
}

/**
 * Normalize a batch of raw events. Returns candidates and errors separately.
 */
export async function normalizeEvents(rawEvents: RawEventRow[]): Promise<{
  candidates: NormalizedCandidate[];
  errors: Array<{ rawEventId: string; error: string }>;
}> {
  const candidates: NormalizedCandidate[] = [];
  const errors: Array<{ rawEventId: string; error: string }> = [];

  for (const raw of rawEvents) {
    const result = normalizeRawEvent(raw);
    if (result.candidate) {
      candidates.push(result.candidate);
    } else {
      errors.push({ rawEventId: raw.id, error: result.error ?? 'unknown' });
    }
  }

  return { candidates, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/normalizer.test.ts`
Expected: All PASS (may need to mock `normalizeLocation` and `categorizeEvent` — adjust imports as needed based on existing module structure)

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/normalizer.ts src/__tests__/pipeline/normalizer.test.ts
git commit -m "feat(pipeline): add event normalizer combining title/date/url/location

Orchestrates normalize-title, normalize-date, normalize-url, and
existing location-normalizer. Computes parse_confidence. Returns
candidates and errors separately for metric tracking."
```

---

## Task 8: Matcher + Canonical Upsert

**Files:**
- Create: `src/lib/pipeline/matcher.ts`
- Create: `src/lib/pipeline/canonical-upsert.ts`

- [ ] **Step 1: Implement matcher.ts**

```typescript
// src/lib/pipeline/matcher.ts
import { createClient } from '@supabase/supabase-js';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import { jaroWinkler } from '@/lib/dedup/jaro-winkler';
import type { NormalizedCandidate, UpsertResults } from './types';

const FUZZY_THRESHOLD = 0.85;
const MERGE_AUTO = 0.90;
const MERGE_MEDIUM = 0.75;
const MERGE_UNCERTAIN = 0.55;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface MatchCandidate {
  eventId: string;
  score: number;
  decision: 'merge' | 'uncertain' | 'new';
}

/**
 * For each normalized candidate, search for existing events that might be duplicates.
 * Uses fingerprint (exact) and fuzzy title + same-day matching.
 * Returns match decisions for each candidate.
 */
export async function findMatchCandidates(
  candidates: NormalizedCandidate[],
): Promise<Map<string, MatchCandidate>> {
  const supabase = getSupabaseAdmin();
  const results = new Map<string, MatchCandidate>();

  // Batch: get fingerprints for all candidates
  const fingerprints = new Map<string, string>();
  for (const c of candidates) {
    if (c.normalized_title && c.normalized_start_at) {
      const fp = generateFingerprint(c.normalized_title, c.normalized_start_at);
      if (fp) fingerprints.set(c.raw_event_id, fp);
    }
  }

  // Check fingerprint matches against existing events
  if (fingerprints.size > 0) {
    const fpValues = [...new Set(fingerprints.values())];
    const { data: fpMatches } = await supabase
      .from('events')
      .select('id, content_fingerprint')
      .in('content_fingerprint', fpValues);

    const fpToEventId = new Map<string, string>();
    for (const match of fpMatches ?? []) {
      if (match.content_fingerprint) {
        fpToEventId.set(match.content_fingerprint, match.id);
      }
    }

    for (const [rawId, fp] of fingerprints) {
      const existingId = fpToEventId.get(fp);
      if (existingId) {
        results.set(rawId, { eventId: existingId, score: 1.0, decision: 'merge' });
      }
    }
  }

  // For non-fingerprint-matched candidates: fuzzy search by date + title
  for (const c of candidates) {
    if (results.has(c.raw_event_id)) continue; // already matched
    if (!c.normalized_start_at || !c.normalized_title_compact) {
      results.set(c.raw_event_id, { eventId: '', score: 0, decision: 'new' });
      continue;
    }

    // Find events on same day
    const dayStart = c.normalized_start_at.slice(0, 10);
    const { data: sameDayEvents } = await supabase
      .from('events')
      .select('id, title, location_name, latitude, longitude')
      .gte('start_date', `${dayStart}T00:00:00`)
      .lt('start_date', `${dayStart}T23:59:59`)
      .limit(100);

    let bestMatch: MatchCandidate = { eventId: '', score: 0, decision: 'new' };
    for (const existing of sameDayEvents ?? []) {
      // Title similarity
      const titleScore = jaroWinkler(
        c.normalized_title_compact,
        existing.title?.toLowerCase() ?? '',
      );
      // Geo proximity bonus (if both have coords)
      let geoBonus = 0;
      // URL match would add more signal but we keep it simple for Phase 1

      const overall = titleScore + geoBonus;
      if (overall > bestMatch.score) {
        const decision = overall >= MERGE_AUTO ? 'merge'
          : overall >= MERGE_UNCERTAIN ? 'uncertain'
          : 'new';
        bestMatch = { eventId: existing.id, score: overall, decision };
      }
    }
    results.set(c.raw_event_id, bestMatch);
  }

  return results;
}
```

- [ ] **Step 2: Implement canonical-upsert.ts**

```typescript
// src/lib/pipeline/canonical-upsert.ts
import { createClient } from '@supabase/supabase-js';
import type { NormalizedCandidate, UpsertResults } from './types';
import { findMatchCandidates } from './matcher';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import { normalizeEventLocation } from '@/lib/location-normalizer';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Match normalized candidates against existing events and upsert.
 * Sets publish_status = 'draft' (final status set by quality scorer).
 */
export async function matchAndUpsert(
  candidates: NormalizedCandidate[],
): Promise<UpsertResults> {
  const supabase = getSupabaseAdmin();
  const matches = await findMatchCandidates(candidates);
  let inserted = 0;
  let updated = 0;
  let matched = 0;
  let skipped = 0;
  const eventIds: string[] = [];

  for (const candidate of candidates) {
    const match = matches.get(candidate.raw_event_id);

    if (match?.decision === 'merge' && match.eventId) {
      // Update existing event
      matched++;
      const { data, error } = await supabase
        .from('events')
        .update({
          title: candidate.normalized_title ?? undefined,
          start_date: candidate.normalized_start_at ?? undefined,
          end_date: candidate.normalized_end_at ?? undefined,
          location_name: candidate.normalized_location_name ?? undefined,
          address: candidate.normalized_address ?? undefined,
          postal_code: candidate.normalized_postal_code ?? undefined,
          bundesland: candidate.normalized_bundesland ?? undefined,
          category: candidate.normalized_category ?? undefined,
          ticket_url: candidate.normalized_ticket_url ?? undefined,
          source_url: candidate.normalized_source_url ?? undefined,
          image_url: candidate.normalized_image_url ?? undefined,
          raw_event_id: candidate.raw_event_id,
          publish_status: 'draft',
          content_fingerprint: candidate.normalized_title && candidate.normalized_start_at
            ? generateFingerprint(candidate.normalized_title, candidate.normalized_start_at)
            : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.eventId)
        .select('id')
        .single();

      if (data) {
        updated++;
        eventIds.push(data.id);
      }
    } else {
      // Insert new event
      const { data, error } = await supabase
        .from('events')
        .insert({
          source_type: 'scraped',
          source_name: candidate.normalized_source_url
            ? new URL(candidate.normalized_source_url).hostname
            : 'unknown',
          source_id: candidate.raw_event_id,
          title: candidate.normalized_title ?? 'Untitled',
          start_date: candidate.normalized_start_at ?? new Date().toISOString(),
          end_date: candidate.normalized_end_at,
          location_name: candidate.normalized_location_name,
          address: candidate.normalized_address,
          postal_code: candidate.normalized_postal_code,
          bundesland: candidate.normalized_bundesland,
          category: candidate.normalized_category,
          ticket_url: candidate.normalized_ticket_url,
          source_url: candidate.normalized_source_url,
          image_url: candidate.normalized_image_url,
          raw_event_id: candidate.raw_event_id,
          publish_status: 'draft',
          content_fingerprint: candidate.normalized_title && candidate.normalized_start_at
            ? generateFingerprint(candidate.normalized_title, candidate.normalized_start_at)
            : null,
        })
        .select('id')
        .single();

      if (data) {
        inserted++;
        eventIds.push(data.id);
      } else {
        skipped++;
      }
    }
  }

  return { matched, inserted, updated, eventIds, skipped };
}
```

- [ ] **Step 3: Verify both compile**

Run: `npx tsc --noEmit src/lib/pipeline/matcher.ts src/lib/pipeline/canonical-upsert.ts`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/pipeline/matcher.ts src/lib/pipeline/canonical-upsert.ts
git commit -m "feat(pipeline): add matcher and canonical upsert

Matcher uses fingerprint (exact) + Jaro-Winkler (fuzzy) on same-day events.
Canonical upsert merges or inserts events, sets publish_status=draft.
Decisions based on title + date + geo signals."
```

---

## Task 9: Quality Scorer

**Files:**
- Create: `src/lib/pipeline/quality-scorer.ts`
- Create: `src/__tests__/pipeline/quality-scorer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/quality-scorer.test.ts
import { describe, it, expect } from 'vitest';
import {
  computeCompletenessScore,
  computeDateScore,
  computeLocationScore,
  computeImageScore,
  computeLinkScore,
  isOutsideAustria,
  scoreToPublishStatus,
} from '@/lib/pipeline/quality-scorer';

describe('computeCompletenessScore', () => {
  it('gives max score for complete event', () => {
    const score = computeCompletenessScore({
      title: 'Great Festival',
      startDate: '2026-06-14',
      locationName: 'Flex Wien',
      category: 'Musik',
      description: 'A'.repeat(201),
    });
    expect(score).toBe(25);
  });

  it('gives 0 for empty event', () => {
    const score = computeCompletenessScore({});
    expect(score).toBe(0);
  });
});

describe('isOutsideAustria', () => {
  it('returns true for Berlin coordinates', () => {
    expect(isOutsideAustria(52.52, 13.405)).toBe(true);
  });

  it('returns false for Vienna coordinates', () => {
    expect(isOutsideAustria(48.2082, 16.3738)).toBe(false);
  });

  it('returns false when no coordinates', () => {
    expect(isOutsideAustria(null, null)).toBe(false);
  });
});

describe('scoreToPublishStatus', () => {
  it('returns published for score >= 60', () => {
    expect(scoreToPublishStatus(75)).toBe('published');
  });

  it('returns published_low_confidence for 40-59', () => {
    expect(scoreToPublishStatus(45)).toBe('published_low_confidence');
  });

  it('returns needs_review for 20-39', () => {
    expect(scoreToPublishStatus(25)).toBe('needs_review');
  });

  it('returns suppressed for < 20', () => {
    expect(scoreToPublishStatus(10)).toBe('suppressed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/quality-scorer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement quality-scorer.ts**

```typescript
// src/lib/pipeline/quality-scorer.ts
import { createClient } from '@supabase/supabase-js';
import type {
  QualityFlag, QualityScoreRow, QualityResults,
  PublishStatus, FlagType, Severity,
} from './types';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Austria bounding box
const AT_LAT_MIN = 46.3;
const AT_LAT_MAX = 49.1;
const AT_LNG_MIN = 9.5;
const AT_LNG_MAX = 17.2;

export function isOutsideAustria(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  return lat < AT_LAT_MIN || lat > AT_LAT_MAX || lng < AT_LNG_MIN || lng > AT_LNG_MAX;
}

export function scoreToPublishStatus(score: number): PublishStatus {
  if (score >= 60) return 'published';
  if (score >= 40) return 'published_low_confidence';
  if (score >= 20) return 'needs_review';
  return 'suppressed';
}

// --- Individual Score Dimensions ---

interface CompletenessInput {
  title?: string | null;
  startDate?: string | null;
  locationName?: string | null;
  category?: string | null;
  description?: string | null;
}

export function computeCompletenessScore(input: CompletenessInput): number {
  let score = 0;
  if (input.title && input.title.length > 5) score += 5;
  if (input.startDate) score += 5;
  if (input.locationName) score += 5;
  if (input.category) score += 3;
  if (input.description && input.description.length > 50) score += 4;
  if (input.description && input.description.length > 200) score += 3;
  return score;
}

export function computeDateScore(event: {
  start_date?: string | null;
  start_precision?: string | null;
  end_date?: string | null;
}): number {
  let score = 0;
  if (event.start_date) score += 5;
  if (event.start_precision === 'exact') score += 5;
  // Plausibility: not in past, not > 2 years out
  if (event.start_date) {
    const start = new Date(event.start_date);
    const now = new Date();
    const twoYearsOut = new Date();
    twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);
    if (start >= now && start <= twoYearsOut) score += 3;
  }
  if (event.end_date) score += 2;
  return score;
}

export function computeLocationScore(event: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  location_name?: string | null;
  bundesland?: string | null;
  postal_code?: string | null;
}): number {
  let score = 0;
  if (event.latitude && event.longitude) score += 7;
  if (event.address) score += 5;
  if (event.location_name) score += 3;
  // Austria check (only if coords exist)
  if (event.latitude && event.longitude && !isOutsideAustria(event.latitude, event.longitude)) {
    score += 5;
  }
  // Consistency check (simplified for Phase 1)
  if (event.bundesland && event.postal_code) score += 5;
  return score;
}

export function computeImageScore(event: {
  image_url?: string | null;
}): number {
  let score = 0;
  if (event.image_url) score += 5;
  // Reachability check is a batch job, not inline. Give 5 points if URL exists (conservative).
  // Batch job will update this later.
  if (event.image_url) score += 5;
  return score;
}

export function computeLinkScore(event: {
  source_url?: string | null;
  ticket_url?: string | null;
}): number {
  let score = 0;
  if (event.source_url) score += 3;
  if (event.ticket_url) score += 3;
  // Reachability check is a batch job. Give partial points.
  if (event.source_url || event.ticket_url) score += 4;
  return score;
}

function computeDedupConfidenceScore(dedupScore: number | null): number {
  if (dedupScore === null) return 10; // unique, no duplicate candidate
  if (dedupScore >= 0.90) return 8;
  if (dedupScore >= 0.75) return 5;
  if (dedupScore >= 0.55) return 2;
  return 0;
}

async function computeSourceTrustScore(sourceName: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: runs } = await supabase
    .from('scrape_runs')
    .select('status, avg_quality_score, parser_errors, items_parsed')
    .eq('source_name', sourceName)
    .order('started_at', { ascending: false })
    .limit(10);

  if (!runs || runs.length === 0) return 2; // unknown source, neutral

  let score = 0;
  const successRate = runs.filter(r => r.status === 'success').length / runs.length;
  if (successRate > 0.95) score += 2;

  const avgQuality = runs.reduce((sum, r) => sum + (r.avg_quality_score ?? 0), 0) / runs.length;
  if (avgQuality > 60) score += 2;

  const totalParsed = runs.reduce((sum, r) => sum + (r.items_parsed ?? 0), 0);
  const totalErrors = runs.reduce((sum, r) => sum + (r.parser_errors ?? 0), 0);
  if (totalParsed > 0 && totalErrors / totalParsed < 0.05) score += 1;

  return score;
}

function generateQualityFlags(event: Record<string, unknown>): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const addFlag = (type: FlagType, severity: Severity, details?: Record<string, unknown>) => {
    flags.push({ event_id: event.id as string, flag_type: type, severity, details_json: details ?? null });
  };

  if (event.start_precision === 'day_only') addFlag('missing_time', 'medium');
  if (!event.location_name && !event.latitude) addFlag('missing_location', 'high');
  if (!event.description || (event.description as string).length < 20) addFlag('missing_description', 'low');
  else if ((event.description as string).length < 50) addFlag('description_too_short', 'low');
  if (!event.image_url) addFlag('missing_image', 'low');
  if (isOutsideAustria(event.latitude as number | null, event.longitude as number | null)) {
    addFlag('outside_austria', 'critical', {
      latitude: event.latitude,
      longitude: event.longitude,
    });
  }
  if (event.start_date) {
    const start = new Date(event.start_date as string);
    const now = new Date();
    if (start < now) addFlag('date_in_past', 'high');
    const twoYears = new Date();
    twoYears.setFullYear(twoYears.getFullYear() + 2);
    if (start > twoYears) addFlag('date_implausible', 'high');
  }
  return flags;
}

/**
 * Score events and set publish_status.
 * Blocking rules (outside_austria) are checked FIRST.
 */
export async function scoreAndPublish(eventIds: string[]): Promise<QualityResults> {
  const supabase = getSupabaseAdmin();
  const results: QualityResults = {
    suppressed: 0, needsReview: 0, published: 0, publishedLowConfidence: 0,
  };

  // Fetch full event data
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds);

  if (!events) return results;

  for (const event of events) {
    // Generate flags
    const flags = generateQualityFlags(event);

    // Write flags (clear old ones first for this event)
    await supabase.from('quality_flags').delete().eq('event_id', event.id);
    if (flags.length > 0) {
      await supabase.from('quality_flags').insert(flags);
    }

    // Check hard blocking rules FIRST
    const isBlocked = flags.some(f => f.flag_type === 'outside_austria');

    if (isBlocked) {
      // Score row with 0, permanent suppress
      const scoreRow: Omit<QualityScoreRow, 'id'> = {
        event_id: event.id,
        completeness_score: 0, date_score: 0, location_score: 0,
        image_score: 0, link_score: 0, dedup_confidence_score: 0,
        source_trust_score: 0, final_quality_score: 0, scoring_version: 1,
      };
      await supabase.from('event_quality_scores').upsert(scoreRow, {
        onConflict: 'event_id,scoring_version',
      });
      await supabase.from('events').update({
        publish_status: 'suppressed',
        quality_score: 0,
      }).eq('id', event.id);
      results.suppressed++;
      continue;
    }

    // Compute score dimensions
    const completeness = computeCompletenessScore({
      title: event.title,
      startDate: event.start_date,
      locationName: event.location_name,
      category: event.category,
      description: event.description,
    });
    const dateScore = computeDateScore(event);
    const locationScore = computeLocationScore(event);
    const imageScore = computeImageScore(event);
    const linkScore = computeLinkScore(event);
    const dedupScore = computeDedupConfidenceScore(null); // Phase 1: no cluster system
    const sourceTrust = await computeSourceTrustScore(event.source_name ?? '');

    const finalScore = completeness + dateScore + locationScore +
      imageScore + linkScore + dedupScore + sourceTrust;

    // Write score
    const scoreRow: Omit<QualityScoreRow, 'id'> = {
      event_id: event.id,
      completeness_score: completeness,
      date_score: dateScore,
      location_score: locationScore,
      image_score: imageScore,
      link_score: linkScore,
      dedup_confidence_score: dedupScore,
      source_trust_score: sourceTrust,
      final_quality_score: finalScore,
      scoring_version: 1,
    };
    await supabase.from('event_quality_scores').upsert(scoreRow, {
      onConflict: 'event_id,scoring_version',
    });

    // Set publish_status
    const status = scoreToPublishStatus(finalScore);
    await supabase.from('events').update({
      publish_status: status,
      quality_score: finalScore,
    }).eq('id', event.id);

    if (status === 'suppressed') results.suppressed++;
    else if (status === 'needs_review') results.needsReview++;
    else if (status === 'published_low_confidence') results.publishedLowConfidence++;
    else results.published++;
  }

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/quality-scorer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/quality-scorer.ts src/__tests__/pipeline/quality-scorer.test.ts
git commit -m "feat(pipeline): add quality scorer with 7 dimensions and blocking rules

Computes completeness, date, location, image, link, dedup confidence,
and source trust scores. outside_austria is hard blocking rule
(permanent suppress with score=0). Generates quality flags."
```

---

## Task 10: Pipeline Orchestrator

**Files:**
- Create: `src/lib/pipeline/orchestrator.ts`
- Modify: `src/lib/scrapers/index.ts` (replace `runScraper()`)
- Modify: `src/scripts/scrape.ts` (use new pipeline)

- [ ] **Step 1: Implement orchestrator.ts**

Implement the orchestrator following the exact pseudocode from spec section 2.4. Uses `chunk()` from types.ts, calls raw-layer, normalizer, canonical-upsert, and quality-scorer in batched sequence. Tracks all metrics. Determines status (success/partial/error) based on successful_batches vs batch_errors.

- [ ] **Step 2: Update src/lib/scrapers/index.ts**

Replace the existing `runScraper()` function (lines 324-393) to call `runPipeline()` from the orchestrator instead of directly upserting events. Keep `runAllScrapers()`, `getScraperByName()`, and `getAvailableScrapers()` unchanged.

- [ ] **Step 3: Update src/scripts/scrape.ts**

Ensure the CLI script uses the updated `runScraper()` which now calls the pipeline.

- [ ] **Step 4: Run existing tests to verify nothing breaks**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/orchestrator.ts src/lib/scrapers/index.ts src/scripts/scrape.ts
git commit -m "feat(pipeline): add orchestrator replacing runScraper()

Batched pipeline: Raw Layer -> Normalization -> Matching + Upsert ->
Quality Scoring. Status determination: all fail=error, mixed=partial,
none=success. Scraper compatibility preserved."
```

---

## Task 11: Events API — publish_status Filter

**Files:**
- Modify: `src/app/api/events/route.ts`
- Modify: `src/types/events.ts`

- [ ] **Step 1: Add publish_status and quality_score to Event type**

In `src/types/events.ts`, add to the `Event` interface:
```typescript
publish_status?: 'draft' | 'published' | 'published_low_confidence' | 'suppressed' | 'needs_review' | 'expired';
quality_score?: number | null;
raw_event_id?: string | null;
```

- [ ] **Step 2: Add publish_status filter to events API**

In `src/app/api/events/route.ts`, after building the base query, add:
```typescript
// publish_status filter: only show published events to public
const includeAll = searchParams.get('includeAll') === 'true';
if (!includeAll) {
  query = query.in('publish_status', ['published', 'published_low_confidence']);
} else {
  // Admin access: check role
  // (role check already exists in the route)
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/route.ts src/types/events.ts
git commit -m "feat(api): add publish_status filter to events API

Public API shows only published + published_low_confidence.
Admin API with includeAll=true shows all statuses."
```

---

## Task 12: Event Detail Page — noindex + 404

**Files:**
- Modify: `src/app/events/[id]/page.tsx`

- [ ] **Step 1: Add publish_status logic to event detail page**

In `src/app/events/[id]/page.tsx`:

1. In `getEvent()`: also select `publish_status`
2. In `generateMetadata()`: if `publish_status === 'published_low_confidence'`, add `robots: { index: false }` and skip JSON-LD
3. If `publish_status` is `needs_review` or `suppressed`: call `notFound()`

- [ ] **Step 2: Commit**

```bash
git add src/app/events/[id]/page.tsx
git commit -m "feat(seo): noindex for low_confidence events, 404 for suppressed

published_low_confidence: reachable via direct link, noindex meta tag,
no JSON-LD. needs_review/suppressed: 404 for non-admin users."
```

---

## Task 13: Sitemap — Only Published Events

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Filter sitemap to published events only**

In `src/app/sitemap.ts`, add `.eq('publish_status', 'published')` to the event query in both `generateSitemaps()` (count) and the default sitemap function (fetch).

- [ ] **Step 2: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): sitemap only includes published events

Excludes published_low_confidence, needs_review, suppressed.
Only quality_score >= 60 events appear in XML sitemap."
```

---

## Task 14: Backfill Quality Script

**Files:**
- Create: `src/scripts/backfill-quality.ts`

- [ ] **Step 1: Implement backfill script with dry-run support**

```typescript
// src/scripts/backfill-quality.ts
// Usage:
//   npx tsx src/scripts/backfill-quality.ts --dry-run   (analyze only)
//   npx tsx src/scripts/backfill-quality.ts              (write scores + status)
```

The script:
1. Fetches all events in batches of 1000
2. For each event: computes quality score, generates flags, determines publish_status
3. In dry-run mode: prints histogram (score distribution, status counts, outside_austria count, top-10 worst sources)
4. In live mode: writes event_quality_scores, quality_flags, updates events.quality_score and events.publish_status

- [ ] **Step 2: Test dry-run mode**

Run: `npx tsx src/scripts/backfill-quality.ts --dry-run`
Expected: Prints score distribution without writing

- [ ] **Step 3: Commit**

```bash
git add src/scripts/backfill-quality.ts
git commit -m "feat(pipeline): add backfill quality scoring script

Dry-run mode shows score distribution and simulated status changes.
Live mode writes quality scores, flags, and publish_status.
Processes in 1000-event batches."
```

---

## Task 15: Admin Layout + Sidebar

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/Admin/AdminSidebar.tsx`
- Modify: `src/app/admin/page.tsx` (redirect to /admin/overview)

- [ ] **Step 1: Create AdminSidebar component**

Sidebar with Lucide icons, 8 navigation items (Overview, Scraper Runs, Quality, Sources, Events, Users, Analytics, Moderation). Dark theme, collapsible on mobile. No emojis.

- [ ] **Step 2: Create admin layout.tsx**

Server component layout wrapping all admin pages with the sidebar. Auth check (redirect if not god/admin).

- [ ] **Step 3: Update admin/page.tsx to redirect**

Replace the monolithic 691-line page with a simple redirect to `/admin/overview`.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/components/Admin/AdminSidebar.tsx src/app/admin/page.tsx
git commit -m "feat(admin): add sidebar layout with Lucide icons

New admin layout with collapsible sidebar navigation.
No emojis. Dark theme with glass card design language.
Old monolithic page.tsx replaced with redirect."
```

---

## Task 16: Admin Shared Components

**Files:**
- Create: `src/components/Admin/StatCard.tsx`
- Create: `src/components/Admin/DataTable.tsx`
- Create: `src/components/Admin/StatusBadge.tsx`
- Create: `src/components/Admin/SeverityBadge.tsx`
- Create: `src/components/Admin/ScoreBar.tsx`

- [ ] **Step 1: Create StatCard** — Reusable metric card with title, value, optional trend/icon
- [ ] **Step 2: Create DataTable** — Sortable, filterable table with pagination
- [ ] **Step 3: Create StatusBadge** — Color-coded badge for publish_status and scrape run status
- [ ] **Step 4: Create SeverityBadge** — Color-coded badge for quality flag severity
- [ ] **Step 5: Create ScoreBar** — 0-100 horizontal bar visualization with color gradient

- [ ] **Step 6: Commit**

```bash
git add src/components/Admin/
git commit -m "feat(admin): add shared components (StatCard, DataTable, badges, ScoreBar)

Reusable admin UI components with dark theme, no emojis,
Lucide icons. Glass card design language."
```

---

## Task 17: Admin API Routes

**Files:**
- Create: `src/app/api/admin/scrape-runs/route.ts`
- Create: `src/app/api/admin/scrape-runs/[id]/route.ts`
- Create: `src/app/api/admin/quality-flags/route.ts`
- Create: `src/app/api/admin/quality-flags/[id]/resolve/route.ts`
- Create: `src/app/api/admin/events/[id]/publish-status/route.ts`
- Create: `src/app/api/admin/sources/route.ts`

- [ ] **Step 1: Implement scrape-runs routes** — GET with filters (source, status, date range), pagination. Detail route joins raw_events.
- [ ] **Step 2: Implement quality-flags routes** — GET with filters (flag_type, severity, resolved/open). POST resolve sets resolved_at.
- [ ] **Step 3: Implement publish-status route** — PATCH to change event publish_status (admin override).
- [ ] **Step 4: Implement sources route** — Aggregates from scrape_runs: per source name, success rate, avg quality, event count, error rate.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat(admin): add API routes for scrape runs, quality flags, sources

Scrape runs: list + detail with raw events.
Quality flags: list + resolve.
Publish status: admin override.
Sources: aggregated metrics per source."
```

---

## Task 18: Admin Pages (Overview, Scraper Runs, Quality, Sources)

**Files:**
- Create: `src/app/admin/overview/page.tsx`
- Create: `src/app/admin/scraper-runs/page.tsx`
- Create: `src/app/admin/quality/page.tsx`
- Create: `src/app/admin/sources/page.tsx`

- [ ] **Step 1: Implement Overview page** — 6 StatCards, quality score histogram, recent runs, top flags
- [ ] **Step 2: Implement Scraper Runs page** — DataTable of runs, detail drawer, live status panel, start/stop controls
- [ ] **Step 3: Implement Quality page** — Flag list with filters, event detail view, resolve/suppress/publish actions
- [ ] **Step 4: Implement Sources page** — Source metrics table, sortable, sparkline trends

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/overview/ src/app/admin/scraper-runs/ src/app/admin/quality/ src/app/admin/sources/
git commit -m "feat(admin): add Overview, Scraper Runs, Quality, Sources pages

4 new admin pages with real data from pipeline tables.
Dark theme, no emojis, Lucide icons, glass cards."
```

---

## Task 19: Migrate Existing Admin Tabs

**Files:**
- Create: `src/app/admin/events/page.tsx` (extracted + extended)
- Create: `src/app/admin/users/page.tsx` (extracted)
- Create: `src/app/admin/analytics/page.tsx` (extracted)
- Create: `src/app/admin/moderation/page.tsx` (extracted)

- [ ] **Step 1: Extract Events tab** from old page.tsx into `events/page.tsx`. Add quality_score and publish_status columns. Add filter by publish_status.
- [ ] **Step 2: Extract Users tab** into `users/page.tsx`. Existing logic, new layout.
- [ ] **Step 3: Extract Analytics tab** into `analytics/page.tsx`. Wrap existing `AnalyticsPanel`.
- [ ] **Step 4: Extract Moderation tab** into `moderation/page.tsx`. Existing logic, new layout.

- [ ] **Step 5: Remove old monolithic admin/page.tsx content** (should already be a redirect from Task 15)

- [ ] **Step 6: Run app to verify all admin routes work**

Run: `npm run dev`, navigate to /admin/overview, /admin/events, /admin/users, etc.
Expected: All pages load without errors

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/
git commit -m "feat(admin): migrate existing tabs to individual route pages

Events: extended with quality_score + publish_status.
Users, Analytics, Moderation: existing logic in new layout.
Old monolithic page.tsx fully replaced."
```

---

## Task 20: Integration Test — Full Pipeline Run

**Files:**
- Create: `src/__tests__/pipeline/orchestrator.test.ts`

- [ ] **Step 1: Write integration test**

Test that the full pipeline runs for a mock scraper returning 3 events:
- One normal event (should be published)
- One event without date (should get missing_time flag)
- One event with coordinates outside Austria (should be suppressed)

Mock the Supabase client to verify writes to raw_events, normalized_event_candidates, events, event_quality_scores, and quality_flags.

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/pipeline/orchestrator.test.ts`
Expected: All PASS

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests + new tests pass

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/pipeline/orchestrator.test.ts
git commit -m "test(pipeline): add integration test for full pipeline run

Tests normal event, missing-date event, outside-austria event.
Verifies correct writes to all pipeline tables."
```

---

## Task 21: Final Verification + Build

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Verify existing scraper works with new pipeline**

Run: `npm run scrape -- --source BurgenlandInfoScraper` (or a small scraper)
Expected: Events appear in raw_events, normalized_event_candidates, events (with publish_status and quality_score)

- [ ] **Step 4: Run backfill dry-run**

Run: `npx tsx src/scripts/backfill-quality.ts --dry-run`
Expected: Score distribution printed, no writes

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(quality): complete Phase 1 quality system

Pipeline: Raw -> Normalize -> Match -> Score -> Publish
Admin: New sidebar layout, Overview, Scraper Runs, Quality, Sources
API: publish_status filter, noindex for low_confidence, 404 for suppressed
Backfill: Dry-run + live scoring for existing events"
```

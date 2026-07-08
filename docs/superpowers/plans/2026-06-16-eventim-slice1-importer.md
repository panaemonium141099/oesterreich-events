# Eventim Slice 1 — Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Import future, non-cancelled Eventim ticket events (AT/DE/CH) from the PFT feed into the `events` table with a `country` column, an authoritative mapped category, coarse genre tags, and an affiliate `ticket_url` set only when bookable.

**Architecture:** A standalone CLI script downloads + gunzips the daily PFT feed (one ~57 MB JSON `{eventserie:[]}`), a pure parser turns each series/event into the existing `ScrapedEvent` shape (filtered + mapped), and the existing `syncEventsToSupabase` write-path persists them. The write-path is extended minimally to carry `country` and to honour a pre-mapped (locked) category instead of re-classifying from text.

**Tech Stack:** TypeScript, tsx, Node `zlib`/`fetch`, Supabase JS, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-eventim-feed-integration-design.md`

---

## File Structure (Slice 1)

- Create `src/lib/eventim/types.ts` — feed TypeScript interfaces (`EventimSeries`, `EventimEvent`, `EventimPriceCategory`).
- Create `src/lib/eventim/category-map.ts` — `EVENTIM_CATEGORY_MAP` + `mapEventimCategory()`.
- Create `src/lib/eventim/availability.ts` — `isBookable()`, `isCancelled()`, `priceText()`.
- Create `src/lib/eventim/parse.ts` — `parseEventimFeed(series[])` → `ScrapedEvent[]`.
- Create `src/lib/eventim/feed-client.ts` — `downloadEventimFeed()` (fetch + gunzip).
- Create `src/scripts/import-eventim.ts` — CLI (`--dry-run`, `--limit N`, `--verbose`).
- Create `supabase/migrations/20260616_add_event_country.sql` — `country` column + index + backfill.
- Modify `src/types/events.ts:116-160` — extend `ScrapedEvent` with `country?` + `category_locked?`.
- Modify `src/lib/db/supabase-sync.ts:397` — honour locked category; write `country`.
- Tests: `src/__tests__/lib/eventim/{category-map,availability,parse}.test.ts`.

---

## Task 1: Migration — `country` column

**Files:** Create `supabase/migrations/20260616_add_event_country.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add country to events. Existing rows are all Austria-focused → default 'AT'.
-- Eventim importer sets real country (AT/DE/CH) from the feed.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'AT';

CREATE INDEX IF NOT EXISTS idx_events_country ON public.events (country);

-- Backfill: anything clearly outside the Austria bbox that already exists
-- (rare Feratel DE/CH rows) gets corrected by coordinates; everything else 'AT'.
UPDATE public.events SET country = 'DE'
  WHERE latitude BETWEEN 47.2 AND 55.1 AND longitude BETWEEN 5.8 AND 15.0
    AND NOT (latitude BETWEEN 46.3 AND 49.1 AND longitude BETWEEN 9.5 AND 17.2);
UPDATE public.events SET country = 'CH'
  WHERE latitude BETWEEN 45.8 AND 47.8 AND longitude BETWEEN 5.9 AND 10.5
    AND NOT (latitude BETWEEN 46.3 AND 49.1 AND longitude BETWEEN 9.5 AND 17.2);
```

- [ ] **Step 2: Apply via Supabase MCP** (`apply_migration`, name `add_event_country`) or `execute_sql`. Expected: success, `events.country` exists.

- [ ] **Step 3: Verify**

Run (MCP `execute_sql`): `SELECT country, count(*) FROM events GROUP BY country;`
Expected: mostly `AT`, small `DE`/`CH` counts.

- [ ] **Step 4: Commit** `git add supabase/migrations/20260616_add_event_country.sql && git commit -m "feat(eventim): add events.country column + index"`

---

## Task 2: Category map (pure, TDD)

**Files:** Create `src/lib/eventim/category-map.ts`; Test `src/__tests__/lib/eventim/category-map.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mapEventimCategory } from '@/lib/eventim/category-map';
import { PRIMARY_CATEGORY_SET } from '@/lib/category-classifier/enrichment-taxonomy';

describe('mapEventimCategory', () => {
  it('maps Rock & Pop (1A) to Musik with genre tag', () => {
    expect(mapEventimCategory(['1A'])).toEqual({ category: 'Musik', tags: ['rock-pop'] });
  });
  it('maps Electronic & Dance (1D) to Nightlife & Party', () => {
    expect(mapEventimCategory(['1D']).category).toBe('Nightlife & Party');
  });
  it('maps Klassik (2A) to Musik but Oper (2B) to Kultur & Bühne', () => {
    expect(mapEventimCategory(['2A']).category).toBe('Musik');
    expect(mapEventimCategory(['2B']).category).toBe('Kultur & Bühne');
  });
  it('maps Messen (7E) to Wissen & Karriere', () => {
    expect(mapEventimCategory(['7E']).category).toBe('Wissen & Karriere');
  });
  it('merges genre tags from multiple codes (Rock+Metal)', () => {
    const r = mapEventimCategory(['1A', '1G']);
    expect(r.category).toBe('Musik');
    expect(r.tags).toEqual(expect.arrayContaining(['rock-pop', 'metal']));
  });
  it('falls back to Sonstiges for unknown codes', () => {
    expect(mapEventimCategory(['4F']).category).toBe('Sonstiges');
    expect(mapEventimCategory([]).category).toBe('Sonstiges');
  });
  it('only ever emits valid primary categories', () => {
    for (const code of ['1A','1D','2A','2B','3A','4A','4C','5A','6C','7C','7E','Ball','Podcast','ZZ'])
      expect(PRIMARY_CATEGORY_SET.has(mapEventimCategory([code]).category)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm test -- category-map` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/eventim/category-map.ts`

```typescript
import type { PrimaryCategory } from '@/lib/category-classifier/enrichment-taxonomy';

/** First code in a series determines the primary category; all codes contribute genre tags. */
interface CatEntry { category: PrimaryCategory; tag?: string; }

const MAP: Record<string, CatEntry> = {
  '1A': { category: 'Musik', tag: 'rock-pop' },
  '1B': { category: 'Musik', tag: 'schlager' },
  '1C': { category: 'Musik', tag: 'festival' },
  '1D': { category: 'Nightlife & Party', tag: 'electronic' },
  '1E': { category: 'Musik', tag: 'jazz' },
  '1F': { category: 'Nightlife & Party' },
  '1G': { category: 'Musik', tag: 'metal' },
  '1H': { category: 'Musik', tag: 'hip-hop' },
  '1I': { category: 'Musik', tag: 'gospel' },
  '1K': { category: 'Musik' },
  '2A': { category: 'Musik', tag: 'klassik' },
  '2B': { category: 'Kultur & Bühne', tag: 'oper' },
  '2C': { category: 'Kultur & Bühne', tag: 'ballett' },
  '2D': { category: 'Kultur & Bühne', tag: 'theater' },
  '2E': { category: 'Familie & Kinder', tag: 'theater' },
  '2F': { category: 'Kultur & Bühne', tag: 'theater' },
  '2G': { category: 'Kultur & Bühne', tag: 'ausstellung' },
  '2H': { category: 'Kultur & Bühne', tag: 'lesung' },
  '2I': { category: 'Kultur & Bühne', tag: 'kino' },
  '3A': { category: 'Sport & Bewegung', tag: 'fussball' },
  '3B': { category: 'Sport & Bewegung', tag: 'motorsport' },
  '3C': { category: 'Sport & Bewegung', tag: 'wintersport' },
  '3D': { category: 'Sport & Bewegung', tag: 'eishockey' },
  '3E': { category: 'Sport & Bewegung', tag: 'tennis' },
  '3I': { category: 'Sport & Bewegung', tag: 'handball' },
  '3K': { category: 'Sport & Bewegung', tag: 'basketball' },
  '3L': { category: 'Sport & Bewegung', tag: 'reitsport' },
  '3M': { category: 'Sport & Bewegung', tag: 'golf' },
  '3N': { category: 'Sport & Bewegung', tag: 'kampfsport' },
  '3O': { category: 'Sport & Bewegung' },
  '4A': { category: 'Kultur & Bühne', tag: 'musical' },
  '4B': { category: 'Kultur & Bühne', tag: 'show' },
  '4C': { category: 'Familie & Kinder', tag: 'zirkus' },
  '5A': { category: 'Kultur & Bühne', tag: 'kabarett' },
  '5B': { category: 'Kultur & Bühne', tag: 'comedy' },
  '6A': { category: 'Community & Freizeit' },
  '6B': { category: 'Wellness & Spiritualität' },
  '6C': { category: 'Essen & Trinken' },
  '6D': { category: 'Märkte & Feste', tag: 'shopping' },
  '6E': { category: 'Natur & Abenteuer' },
  '7A': { category: 'Community & Freizeit' },
  '7B': { category: 'Sonstiges' },
  '7C': { category: 'Wissen & Karriere', tag: 'vortrag' },
  '7D': { category: 'Sonstiges' },
  '7E': { category: 'Wissen & Karriere', tag: 'messe' },
  'Ball': { category: 'Kultur & Bühne', tag: 'ball' },
  'Podcast': { category: 'Kultur & Bühne', tag: 'podcast' },
};

export function mapEventimCategory(codes: string[]): { category: PrimaryCategory; tags: string[] } {
  const primary = codes.map((c) => MAP[c]).find(Boolean)?.category ?? 'Sonstiges';
  const tags = [...new Set(codes.map((c) => MAP[c]?.tag).filter((t): t is string => !!t))];
  return { category: primary, tags };
}
```

- [ ] **Step 4: Run, verify pass** — `npm test -- category-map` → PASS.

- [ ] **Step 5: Commit** `git add src/lib/eventim/category-map.ts src/__tests__/lib/eventim/category-map.test.ts && git commit -m "feat(eventim): category code → primary category + genre tag map"`

---

## Task 3: Availability + price helpers (pure, TDD)

**Files:** Create `src/lib/eventim/availability.ts`; Test `src/__tests__/lib/eventim/availability.test.ts`

- [ ] **Step 1: Failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { isBookable, isCancelled, priceText } from '@/lib/eventim/availability';

const ev = (over: any = {}) => ({ eventStatus: '2', deliverable: true,
  priceCategories: [{ inventory: 'buchbar' }], ...over });

describe('availability', () => {
  it('bookable: status 2 + deliverable + a buchbar price cat', () => {
    expect(isBookable(ev())).toBe(true);
  });
  it('not bookable when status != 2', () => {
    expect(isBookable(ev({ eventStatus: '4' }))).toBe(false); // sold out
  });
  it('not bookable when not deliverable', () => {
    expect(isBookable(ev({ deliverable: false }))).toBe(false);
  });
  it('not bookable when no price cat is buchbar', () => {
    expect(isBookable(ev({ priceCategories: [{ inventory: 'nicht buchbar' }] }))).toBe(false);
  });
  it('isCancelled detects status 1', () => {
    expect(isCancelled(ev({ eventStatus: '1' }))).toBe(true);
    expect(isCancelled(ev())).toBe(false);
  });
  it('priceText formats from min/max', () => {
    expect(priceText(41, 59)).toBe('41,00 € – 59,00 €');
    expect(priceText(10, 10)).toBe('10,00 €');
    expect(priceText(undefined, undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** `src/lib/eventim/availability.ts`

```typescript
import type { EventimEvent } from './types';

export function isCancelled(e: Pick<EventimEvent, 'eventStatus'>): boolean {
  return String(e.eventStatus) === '1';
}

export function isBookable(
  e: Pick<EventimEvent, 'eventStatus' | 'deliverable' | 'priceCategories'>,
): boolean {
  if (String(e.eventStatus) !== '2') return false;       // 2 = AVAILABLE
  if (e.deliverable === false) return false;
  return (e.priceCategories ?? []).some((p) => p.inventory === 'buchbar');
}

export function priceText(min?: number, max?: number): string | undefined {
  const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
  if (typeof min !== 'number' && typeof max !== 'number') return undefined;
  if (typeof min === 'number' && typeof max === 'number')
    return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  return fmt((min ?? max) as number);
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** `git commit -am "feat(eventim): availability + price-text helpers"`

---

## Task 4: Feed types + parser (TDD)

**Files:** Create `src/lib/eventim/types.ts`, `src/lib/eventim/parse.ts`; Test `src/__tests__/lib/eventim/parse.test.ts`

- [ ] **Step 1: Write `src/lib/eventim/types.ts`** (from verified feed schema)

```typescript
export interface EventimPriceCategory {
  inventory: 'buchbar' | 'nicht buchbar' | string;
  price: string; currency: string;
  priceCategoryName: string; priceCategoryNumber: string;
  productType: string; onsaleDate?: string; onsaleTime?: string;
}
export interface EventimEvent {
  eventId: string; eventName: string; eventDateIso8601: string;
  eventStatus: string; eventType: string; deliverable: boolean;
  eventCity: string; eventCountry: string; eventZip?: string | null;
  eventStreet?: string | null; eventVenue: string; eventVenueId: string;
  venueLatitude?: number; venueLongitude?: number;
  minPrice?: number; maxPrice?: number; evoLink: string;
  priceCategories?: EventimPriceCategory[];
}
export interface EventimSeries {
  esId: string; esName: string; esText?: string; esPictureBig?: string;
  esCategories?: { category: string }[];
  artists?: { artistId: string; artistName: string }[];
  events?: EventimEvent[];
}
```

- [ ] **Step 2: Failing test** `src/__tests__/lib/eventim/parse.test.ts` — covers: keeps only `eventType==1`, drops cancelled (`eventStatus 1`), drops past dates, sets `country`, maps category, sets `ticket_url` only when bookable, strips HTML from description. (Use a small inline `EventimSeries` fixture with 1 bookable future AT event, 1 cancelled, 1 past, 1 voucher `eventType 4`; assert the output array has exactly the bookable one with the right fields. `nowIso` is injected for determinism.)

- [ ] **Step 3: Implement `src/lib/eventim/parse.ts`**

```typescript
import type { ScrapedEvent } from '@/types/events';
import type { EventimSeries, EventimEvent } from './types';
import { mapEventimCategory } from './category-map';
import { isBookable, isCancelled, priceText } from './availability';

const ALLOWED_COUNTRIES = new Set(['AT', 'DE', 'CH']);
const stripHtml = (s?: string) =>
  s ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : undefined;

export function parseEventimFeed(series: EventimSeries[], nowIso: string): ScrapedEvent[] {
  const out: ScrapedEvent[] = [];
  for (const s of series) {
    const { category, tags } = mapEventimCategory((s.esCategories ?? []).map((c) => c.category));
    const desc = stripHtml(s.esText);
    for (const e of s.events ?? []) {
      if (String(e.eventType) !== '1') continue;          // only ticket events
      if (isCancelled(e)) continue;                       // drop cancelled
      if (!e.eventDateIso8601 || e.eventDateIso8601 < nowIso) continue; // future only
      if (!ALLOWED_COUNTRIES.has(e.eventCountry)) continue;
      out.push(mapEvent(s, e, category, tags, desc));
    }
  }
  return out;
}

function mapEvent(
  s: EventimSeries, e: EventimEvent,
  category: string, tags: string[], description?: string,
): ScrapedEvent {
  const coords = e.venueLatitude && e.venueLongitude && e.venueLatitude !== 0
    ? { latitude: e.venueLatitude, longitude: e.venueLongitude } : {};
  return {
    source_name: 'Eventim',
    source_id: e.eventId,
    source_url: e.evoLink,
    ticket_url: isBookable(e) ? e.evoLink : undefined,
    title: e.eventName || s.esName,
    description,
    start_date: e.eventDateIso8601,
    location_name: e.eventVenue || undefined,
    address: e.eventStreet ?? undefined,
    postal_code: e.eventZip ?? undefined,
    ...coords,
    country: e.eventCountry,
    category,                 // authoritative
    category_locked: true,
    tags,
    price_min: e.minPrice,
    price_max: e.maxPrice,
    price_text: priceText(e.minPrice, e.maxPrice),
    image_url: s.esPictureBig || undefined,
    source_type: 'scraped',
  };
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Commit** `git commit -am "feat(eventim): feed types + parser (filters, mapping, country, bookable ticket_url)"`

---

## Task 5: Carry `country` + locked category through the write-path

**Files:** Modify `src/types/events.ts:159` (inside `ScrapedEvent`); Modify `src/lib/db/supabase-sync.ts:397` and the row-output block.

- [ ] **Step 1: Extend `ScrapedEvent`** — add before the closing brace (after `source_type?`):

```typescript
  /** ISO country code (AT/DE/CH). Defaults to 'AT' at DB level when absent. */
  country?: string;
  /** When true + `category` set, the importer's category is authoritative
   *  and the text classifier must NOT override it (feed sources). */
  category_locked?: boolean;
```

- [ ] **Step 2: Honour the lock in `toSupabaseRow`** — wrap the `resolveCanonicalCategory(...)` call at `supabase-sync.ts:397` so a locked category short-circuits:

```typescript
  const canonical = event.category_locked && event.category
    ? { category: event.category, tags: event.tags ?? null,
        category_confidence: 'manual', category_source: 'feed',
        category_version: 'eventim', category_locked: true,
        category_needs_review: false, category_reason: 'eventim feed code map',
        category_candidates: null }
    : resolveCanonicalCategory(
        { title: event.title, description: event.description ?? null,
          source_tags_raw: event.tags ?? null, source_category_raw: event.category ?? null,
          source_name: event.source_name, organizer: event.organizer ?? null,
          location_name: event.location_name ?? null },
        toExistingCategoryRow(existing),
      );
```

(Match the exact field shape `resolveCanonicalCategory` returns — read it at implementation time and mirror every key so the bulk-upsert key-set stays uniform.)

- [ ] **Step 3: Write `country` into the output payload** — in the row object built later in `toSupabaseRow` (the `~548-642` block), add `country: event.country ?? 'AT',`.

- [ ] **Step 4: Test** — add a parser→row integration assertion (or a focused unit test) that a `category_locked` ScrapedEvent keeps its category and that `country` is written. Run `npm test -- supabase-sync` (or the new test). Verify pass.

- [ ] **Step 5: Commit** `git commit -am "feat(eventim): write-path carries country + honours locked feed category"`

---

## Task 6: Feed client (download + gunzip)

**Files:** Create `src/lib/eventim/feed-client.ts`

- [ ] **Step 1: Implement**

```typescript
import { gunzipSync } from 'node:zlib';
import type { EventimSeries } from './types';

export async function downloadEventimFeed(opts?: {
  url?: string; user?: string; pass?: string;
}): Promise<EventimSeries[]> {
  const url = opts?.url ?? process.env.EVENTIM_FEED_URL!;
  const user = opts?.user ?? process.env.EVENTIM_FEED_USER!;
  const pass = opts?.pass ?? process.env.EVENTIM_FEED_PASS!;
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Eventim feed HTTP ${res.status}`);
  const gz = Buffer.from(await res.arrayBuffer());
  const json = JSON.parse(gunzipSync(gz).toString('utf8')) as { eventserie: EventimSeries[] };
  return json.eventserie ?? [];
}
```

- [ ] **Step 2: Commit** `git commit -am "feat(eventim): PFT feed download + gunzip client"`

(No network unit test — covered by the dry-run in Task 7. If memory becomes an issue on Vercel later, swap `gunzipSync`/`JSON.parse` for a streaming parser — tracked in Slice 5.)

---

## Task 7: Importer CLI + dry-run on real data

**Files:** Create `src/scripts/import-eventim.ts`; add `package.json` script `"import:eventim"`.

- [ ] **Step 1: Implement** the script: load `.env.local` (mirror `src/scripts/scrape.ts:1-17`), `downloadEventimFeed()`, `parseEventimFeed(series, new Date().toISOString())`, then `--dry-run` prints counts + 3 sample `ScrapedEvent`s; otherwise `syncEventsToSupabase(events)` in batches of 500. Flags `--dry-run`, `--limit N`, `--verbose`.

- [ ] **Step 2: Dry-run against the live feed**

Run: `EVENTIM_FEED_URL=<PFT-Feed-URL> EVENTIM_FEED_USER=<user> EVENTIM_FEED_PASS=<pass> npx tsx src/scripts/import-eventim.ts --dry-run --verbose` (Credentials aus den Vercel-Env-Vars / GitHub-Secrets — NIEMALS ins Repo committen, das Repo ist public)
Expected: ~22k series parsed, a few-thousand future non-cancelled AT/DE/CH events, samples show `source_name:'Eventim'`, affiliate `ticket_url`, mapped `category`, `country`, genre `tags`.

- [ ] **Step 3: Small live write** `... import-eventim.ts --limit 50` → verify in Supabase: `SELECT title, country, category, tags, ticket_url FROM events WHERE source_name='Eventim' LIMIT 10;`

- [ ] **Step 4: Commit** `git commit -am "feat(eventim): import-eventim CLI (dry-run + batched upsert)"`

---

## Slice 1 Done-When
- Dry-run parses the live feed and produces correctly-shaped `ScrapedEvent`s.
- `--limit 50` writes Eventim events with `country`, mapped `category` (not text-reclassified), genre `tags`, affiliate `ticket_url` only when bookable.
- `npm test` green; `npm run build` green.

---

## Roadmap (detailed per-slice when reached)
- **Slice 6 — Venues:** reuse the same feed parse → upsert `venues` (`registry_source='eventim'`) + `location_master_coords`; dedup `(name_normalized, city)`; quality-filter pseudo-venues.
- **Slice 2 — Remove OeticketScraper:** delete file + registry (`index.ts:7,182`) + `scrape:oeticket` + trusted-hosts; fix tests.
- **Slice 3 — Buy-button:** `derive-event-state.ts:54` gate to `source_name==='Eventim'`.
- **Slice 4 — Country toggle + map mask + venue filter UI:** `country` param in `/api/events`; AT-guard on featured/stats; `atOnly` in `EventFilters`/`buildParams`; `/map` toggle; `germany.geojson`+`switzerland.geojson` + `at-de-ch` pseudo-region.
- **Slice 5 — Cron:** `/api/cron/eventim` + `vercel.json`; measure feed memory, stream if needed.
- **Slice 7 — Spotify genre:** artist genres → `TAGS` mapping + cache, merged into `tags`.

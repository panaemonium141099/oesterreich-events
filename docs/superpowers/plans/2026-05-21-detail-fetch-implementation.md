# Detail-Fetch System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Universal detail-page extractor + per-source adapters that fill missing `address`, `description`, `price_text` for ~60k future events without AI.

**Architecture:** Pure-function `detail-extract/` library (5 layers: JSON-LD → adapter-CSS → og:meta → vertical-table → labeled-regex) with adapter-lookup-by-`source_name`. Two callers share the same code: opt-in `BaseScraper.enrichFromDetail()` for sync pipeline + `backfill-detail-enrich.ts` for offline replay. Soft-Gate: events without parseable street go to `published_low_confidence`.

**Tech Stack:** TypeScript, cheerio, Vitest, Supabase JS, BulkUpdater (existing).

**Spec:** [docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md](../specs/2026-05-21-detail-fetch-system-design.md)

---

## File Structure

```
src/lib/scrapers/detail-extract/                       NEW
├── types.ts                                           shared interfaces
├── validate.ts                                        isValidAddressText, isValidHtml
├── merge.ts                                           per-field merge rules
├── universal.ts                                       JSON-LD + OG + vertical-table + regex
├── extract.ts                                         public API enrichFromDetailHtml()
├── registry.ts                                        source_name → Adapter
└── adapters/
    ├── gem2go.ts                                      refactored from gem2go-detail.ts
    ├── falter.ts
    ├── meinbezirk.ts
    ├── innsbruck-clubs.ts
    ├── events-at.ts
    └── eventfrog.ts

src/lib/scrapers/detail-extract/__tests__/             NEW
├── validate.test.ts
├── merge.test.ts
├── universal.test.ts
├── extract.test.ts
└── adapters/<adapter>.test.ts                         + fixture/<source>/*.html files

src/lib/scrapers/gem2go-detail.ts                      MODIFIED — thin re-export only
src/lib/scrapers/BaseScraper.ts                        MODIFIED — add enrichFromDetail()
src/lib/pipeline/quality-flags.ts                      MODIFIED — add missing_address_street
src/scripts/probe-adapter.ts                           NEW — CLI tool
src/scripts/backfill-detail-enrich.ts                  NEW — backfill CLI
supabase/migrations/20260521_detail_fetch_tracking.sql NEW
src/lib/scrapers/Gem2GoScraper.ts                      MODIFIED — opt-in hook (already had its own impl)
src/lib/scrapers/MeinBezirkScraper.ts                  MODIFIED — opt-in hook
src/lib/scrapers/FalterScraper.ts                      MODIFIED — opt-in hook
src/lib/scrapers/InnsbruckClubsScraper.ts              MODIFIED — opt-in hook
src/lib/scrapers/EventsAtScraper.ts                    MODIFIED — opt-in hook
src/lib/scrapers/EventfrogScraper.ts                   MODIFIED — opt-in hook
package.json                                           MODIFIED — add npm scripts
```

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260521_detail_fetch_tracking.sql`

- [ ] **Step 1.1: Write migration**

```sql
-- supabase/migrations/20260521_detail_fetch_tracking.sql
ALTER TABLE events
  ADD COLUMN last_detail_fetch_at    timestamptz,
  ADD COLUMN last_detail_fetch_status text
    CHECK (last_detail_fetch_status IN
      ('success','no_change','http_error','timeout','invalid_html','parse_empty')),
  ADD COLUMN address_confidence      text
    CHECK (address_confidence IN ('high','medium','low'));

CREATE INDEX IF NOT EXISTS idx_events_detail_fetch_at
  ON events (last_detail_fetch_at);

CREATE INDEX IF NOT EXISTS idx_events_backfill_eligible
  ON events (source_name, last_detail_fetch_at)
  WHERE start_date >= CURRENT_DATE AND source_url IS NOT NULL;
```

- [ ] **Step 1.2: Apply via Supabase MCP**

Run via `mcp__6e1eb75e-..._apply_migration`:
- project_id: `booljdtrktpotsenbnut`
- name: `20260521_detail_fetch_tracking`
- query: contents of file above

Expected: success, no rows affected (only schema).

- [ ] **Step 1.3: Verify via SQL**

Run via execute_sql:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'events' AND column_name IN
  ('last_detail_fetch_at','last_detail_fetch_status','address_confidence');
```
Expected: 3 rows.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260521_detail_fetch_tracking.sql
git commit -m "feat(db): detail-fetch tracking columns + indexes"
```

---

## Task 2: Types & Skeleton

**Files:**
- Create: `src/lib/scrapers/detail-extract/types.ts`

- [ ] **Step 2.1: Write types.ts**

```ts
// src/lib/scrapers/detail-extract/types.ts
import type { CheerioAPI } from 'cheerio';

export type AddressConfidence = 'high' | 'medium' | 'low';
export type DetailFetchStatus =
  | 'success' | 'no_change' | 'http_error' | 'timeout' | 'invalid_html' | 'parse_empty';

export interface DetailEnrichment {
  description?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  address_locality?: string;
  image_url?: string;
  price_text?: string;
  price_min?: number;
  price_max?: number;
  organizer?: string;
  title?: string; // detail can also correct corrupted titles (partytimer)
}

export interface EnrichmentResult extends DetailEnrichment {
  address_confidence?: AddressConfidence;
  layersHit: string[]; // e.g. ['jsonld','adapter','og']
}

export interface Adapter {
  sourceNames: string[];
  extract(
    $: CheerioAPI,
    current: Readonly<DetailEnrichment>,
    url: string,
  ): Partial<DetailEnrichment>;
  overridesJsonLd?: boolean;
  isDetailPage?($: CheerioAPI, url: string): boolean;
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/lib/scrapers/detail-extract/types.ts
git commit -m "feat(detail-extract): shared types"
```

---

## Task 3: validate.ts (TDD)

**Files:**
- Test: `src/lib/scrapers/detail-extract/__tests__/validate.test.ts`
- Create: `src/lib/scrapers/detail-extract/validate.ts`

- [ ] **Step 3.1: Write the failing tests**

```ts
// src/lib/scrapers/detail-extract/__tests__/validate.test.ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { isValidAddressText, isValidHtml } from '../validate';

describe('isValidAddressText', () => {
  it('accepts a street with house number', () => {
    expect(isValidAddressText('Schlossplatz 1')).toBe(true);
    expect(isValidAddressText('Hauptstraße 12a')).toBe(true);
    expect(isValidAddressText('Kirchgasse 7')).toBe(true);
  });

  it('rejects strings shorter than 4 chars', () => {
    expect(isValidAddressText('A 1')).toBe(false);
    expect(isValidAddressText('')).toBe(false);
    expect(isValidAddressText(undefined)).toBe(false);
  });

  it('rejects non-address tokens followed by a number', () => {
    expect(isValidAddressText('Tisch 5')).toBe(false);
    expect(isValidAddressText('Saal 5')).toBe(false);
    expect(isValidAddressText('12. Bezirk')).toBe(false);
    expect(isValidAddressText('Reihe 3')).toBe(false);
    expect(isValidAddressText('ab 18')).toBe(false);
  });

  it('rejects street-name-only without number', () => {
    expect(isValidAddressText('Hauptstraße')).toBe(false);
    expect(isValidAddressText('Kirchplatz')).toBe(false);
  });
});

describe('isValidHtml', () => {
  it('accepts a normal event-detail page', () => {
    const html = `<html><head><title>Konzert</title></head>
      <body><main><h1>Konzert</h1><p>${ 'x'.repeat(300) }</p></main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(true);
  });

  it('rejects 404 / not-found pages', () => {
    const html = `<html><head><title>404 - Not Found</title></head><body><main>${'x'.repeat(300)}</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });

  it('rejects maintenance pages', () => {
    const html = `<html><head><title>Wartung</title></head><body><main>${'x'.repeat(300)}</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });

  it('rejects pages with very short body text', () => {
    const html = `<html><head><title>Event</title></head><body><main>Hi</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });

  it('rejects pages dominated by cookie consent', () => {
    const cookies = 'cookie datenschutz akzeptieren cookie banner cookie wir verwenden cookies '.repeat(50);
    const html = `<html><head><title>Event</title></head><body><main>${cookies}</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });
});
```

- [ ] **Step 3.2: Run tests — they should fail (file does not exist)**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/validate.test.ts
```

Expected: FAIL — cannot find module '../validate'.

- [ ] **Step 3.3: Implement validate.ts**

```ts
// src/lib/scrapers/detail-extract/validate.ts
import type { CheerioAPI } from 'cheerio';

const NON_ADDRESS_PREFIX = /^(saal|tisch|raum|reihe|sitz|bezirk|stock|etage|ab|von|bis|tor|halle)\s+\d/i;
const NUMBER_PREFIX_BEZIRK = /^\d+\.\s*bezirk/i;
const STREET_WITH_NUMBER = /[A-ZÄÖÜ][A-Za-zäöüß.\- ]{2,}\s+\d+[a-zA-Z]?\b/u;

export function isValidAddressText(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 4) return false;
  if (NUMBER_PREFIX_BEZIRK.test(t)) return false;
  if (NON_ADDRESS_PREFIX.test(t)) return false;
  return STREET_WITH_NUMBER.test(t);
}

const BAD_TITLE_TOKENS = /(404|not\s*found|fehler|wartung|maintenance|access\s*denied|forbidden)/i;
const COOKIE_TOKENS = /(cookie|datenschutz|akzeptieren|consent|wir\s+verwenden\s+cookies)/gi;

export function isValidHtml(html: string, $: CheerioAPI): boolean {
  const title = $('title').first().text();
  if (BAD_TITLE_TOKENS.test(title)) return false;

  const $main = $('main, article, [role="main"], .main-content, #content').first();
  const body = ($main.length ? $main : $('body')).text().replace(/\s+/g, ' ').trim();
  if (body.length < 200) return false;

  // Cookie wall heuristic: >50% of words are cookie-related
  const words = body.toLowerCase().split(/\s+/);
  if (words.length > 20) {
    const cookieMatches = body.match(COOKIE_TOKENS);
    if (cookieMatches && cookieMatches.length / words.length > 0.5) return false;
  }
  return true;
}
```

- [ ] **Step 3.4: Run tests — should pass**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/validate.test.ts
```

Expected: PASS (all green).

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/scrapers/detail-extract/validate.ts src/lib/scrapers/detail-extract/__tests__/validate.test.ts
git commit -m "feat(detail-extract): isValidAddressText + isValidHtml with tests"
```

---

## Task 4: merge.ts (TDD)

**Files:**
- Test: `src/lib/scrapers/detail-extract/__tests__/merge.test.ts`
- Create: `src/lib/scrapers/detail-extract/merge.ts`

- [ ] **Step 4.1: Write the failing tests**

```ts
// src/lib/scrapers/detail-extract/__tests__/merge.test.ts
import { describe, it, expect } from 'vitest';
import { mergeEnrichment } from '../merge';
import type { ScrapedEvent } from '@/types/events';

const baseEvent = (): ScrapedEvent => ({
  source_id: 'x', source_name: 'test', source_url: 'https://x', title: 'T', start_date: '2026-06-01',
});

describe('mergeEnrichment', () => {
  it('detail address wins when valid and listing missing', () => {
    const e = baseEvent();
    mergeEnrichment(e, { address: 'Schlossplatz 1' });
    expect(e.address).toBe('Schlossplatz 1');
  });

  it('rejects invalid detail address', () => {
    const e = baseEvent();
    e.address = 'Hauptstraße 5';
    mergeEnrichment(e, { address: 'Tisch 5' });
    expect(e.address).toBe('Hauptstraße 5');
  });

  it('detail wins for postal_code when listing empty', () => {
    const e = baseEvent();
    mergeEnrichment(e, { postal_code: '7000' });
    expect(e.postal_code).toBe('7000');
  });

  it('location_name: detail wins only when longer', () => {
    const e = baseEvent();
    e.location_name = 'Wien';
    mergeEnrichment(e, { location_name: 'Stadthalle Wien' });
    expect(e.location_name).toBe('Stadthalle Wien');
  });

  it('location_name: listing keeps if already longer', () => {
    const e = baseEvent();
    e.location_name = 'Stadthalle Wien, Saal 1';
    mergeEnrichment(e, { location_name: 'Wien' });
    expect(e.location_name).toBe('Stadthalle Wien, Saal 1');
  });

  it('description: listing wins if already >= 200 chars', () => {
    const e = baseEvent();
    e.description = 'x'.repeat(250);
    mergeEnrichment(e, { description: 'short' });
    expect(e.description!.length).toBe(250);
  });

  it('description: detail wins when listing was short', () => {
    const e = baseEvent();
    e.description = 'short';
    const longDetail = 'x'.repeat(500);
    mergeEnrichment(e, { description: longDetail });
    expect(e.description).toBe(longDetail);
  });

  it('price_text fills when listing was empty', () => {
    const e = baseEvent();
    mergeEnrichment(e, { price_text: '€ 12,–', price_min: 12, price_max: 12 });
    expect(e.price_text).toBe('€ 12,–');
    expect(e.price_min).toBe(12);
  });

  it('price_text never overwrites existing listing price', () => {
    const e = baseEvent();
    e.price_text = '€ 20,–';
    e.price_min = 20;
    mergeEnrichment(e, { price_text: '€ 12,–', price_min: 12 });
    expect(e.price_text).toBe('€ 20,–');
    expect(e.price_min).toBe(20);
  });

  it('start_date never overwritten', () => {
    const e = baseEvent();
    e.start_date = '2026-06-01';
    mergeEnrichment(e, { /* start_date is not in DetailEnrichment */ } as any);
    expect(e.start_date).toBe('2026-06-01');
  });

  it('image_url: detail wins (hi-res)', () => {
    const e = baseEvent();
    e.image_url = 'https://example.com/thumb.jpg';
    mergeEnrichment(e, { image_url: 'https://example.com/full.jpg' });
    expect(e.image_url).toBe('https://example.com/full.jpg');
  });
});
```

- [ ] **Step 4.2: Run tests — should fail**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/merge.test.ts
```

Expected: FAIL — cannot find module '../merge'.

- [ ] **Step 4.3: Implement merge.ts**

```ts
// src/lib/scrapers/detail-extract/merge.ts
import type { ScrapedEvent } from '@/types/events';
import type { DetailEnrichment } from './types';
import { isValidAddressText } from './validate';

/**
 * Apply a DetailEnrichment to a ScrapedEvent in-place using per-field rules.
 * See docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md §4
 * for the rule table — keep them in sync.
 */
export function mergeEnrichment(e: ScrapedEvent, d: Partial<DetailEnrichment>): void {
  // address — detail wins when valid
  if (d.address && isValidAddressText(d.address)) {
    e.address = d.address;
  }

  // postal_code — detail wins when 4-digit
  if (d.postal_code && /^\d{4}$/.test(d.postal_code)) {
    e.postal_code = d.postal_code;
  }

  // location_name — detail wins when longer than listing
  if (d.location_name) {
    const cur = e.location_name ?? '';
    if (d.location_name.length > cur.length) e.location_name = d.location_name;
  }

  // description — listing wins if already >= 200 chars; else detail fills/replaces
  if (d.description) {
    const cur = e.description ?? '';
    if (cur.length < 200) e.description = d.description;
  }

  // image_url — detail wins (hi-res over thumbnail) when present
  if (d.image_url) e.image_url = d.image_url;

  // price_text / price_min / price_max — only when listing was empty
  if (!e.price_text && d.price_text) e.price_text = d.price_text;
  if (e.price_min === undefined && d.price_min !== undefined) e.price_min = d.price_min;
  if (e.price_max === undefined && d.price_max !== undefined) e.price_max = d.price_max;

  // organizer — only when listing was empty
  if (!e.organizer && d.organizer) e.organizer = d.organizer;

  // title — detail wins ONLY when listing title is corrupted (HTML/newline garbage)
  if (d.title && e.title && isCorruptedTitle(e.title)) {
    e.title = d.title;
  }

  // Explicitly NOT overwritten: start_date, end_date, latitude, longitude
}

function isCorruptedTitle(t: string): boolean {
  if (/<[a-z][^>]*>/i.test(t)) return true; // contains HTML tags
  if (t.split('\n').length > 3) return true; // multiline title
  if (t.length > 200) return true;            // suspiciously long
  return false;
}
```

- [ ] **Step 4.4: Run tests — should pass**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/merge.test.ts
```

Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/scrapers/detail-extract/merge.ts src/lib/scrapers/detail-extract/__tests__/merge.test.ts
git commit -m "feat(detail-extract): per-field merge rules with tests"
```

---

## Task 5: universal.ts (Layer 1, 3, 4, 5)

**Files:**
- Test: `src/lib/scrapers/detail-extract/__tests__/universal.test.ts`
- Create: `src/lib/scrapers/detail-extract/universal.ts`

The 4 universal layers are JSON-LD, OpenGraph, vertical-table, labeled-regex. The existing `gem2go-detail.ts` contains all four already (just mixed with the gem2go CSS selectors). Extract layers 1, 3, 4, 5 to `universal.ts` and layer 2 (CSS) goes to `adapters/gem2go.ts` in Task 7.

- [ ] **Step 5.1: Write tests (full set)**

```ts
// src/lib/scrapers/detail-extract/__tests__/universal.test.ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { applyJsonLd, applyOgMeta, applyVerticalTable, applyRegexFallbacks } from '../universal';

describe('applyJsonLd', () => {
  it('extracts address + price from Event JSON-LD', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      description: 'A concert',
      location: { name: 'Stadthalle', address: { streetAddress: 'Roland-Rainer-Platz 1', postalCode: '1150', addressLocality: 'Wien' }},
      offers: { '@type': 'Offer', price: 25, priceCurrency: 'EUR', name: 'Stehplatz' },
    })}</script></body></html>`;
    const out: any = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out.address).toBe('Roland-Rainer-Platz 1');
    expect(out.postal_code).toBe('1150');
    expect(out.address_locality).toBe('Wien');
    expect(out.location_name).toBe('Stadthalle');
    expect(out.price_min).toBe(25);
    expect(out.price_text).toContain('€');
  });

  it('handles @graph wrapping', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@graph': [{ '@type': 'Event', location: { name: 'X', address: { streetAddress: 'Hauptstraße 5' }}}],
    })}</script></body></html>`;
    const out: any = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out.address).toBe('Hauptstraße 5');
  });

  it('handles AggregateOffer with lowPrice/highPrice', () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      offers: { '@type': 'AggregateOffer', lowPrice: 10, highPrice: 30, priceCurrency: 'EUR' },
    })}</script></body></html>`;
    const out: any = {};
    applyJsonLd(cheerio.load(html), out);
    expect(out.price_min).toBe(10);
    expect(out.price_max).toBe(30);
    expect(out.price_text).toMatch(/10.*–.*30|10.*-.*30/);
  });
});

describe('applyOgMeta', () => {
  it('fills image_url and description from og:* when empty', () => {
    const html = `<html><head>
      <meta property="og:image" content="https://x/img.jpg">
      <meta property="og:description" content="A really nice event in Vienna">
    </head><body></body></html>`;
    const out: any = {};
    applyOgMeta(cheerio.load(html), out);
    expect(out.image_url).toBe('https://x/img.jpg');
    expect(out.description).toContain('really nice');
  });

  it('does not overwrite a longer description', () => {
    const html = `<html><head>
      <meta property="og:description" content="Short">
    </head><body></body></html>`;
    const out: any = { description: 'x'.repeat(120) };
    applyOgMeta(cheerio.load(html), out);
    expect(out.description!.length).toBe(120);
  });
});

describe('applyVerticalTable', () => {
  it('parses Ort/Veranstalter/Eintritt rows', () => {
    const html = `<html><body><table class="verticaltable">
      <tr><th>Ort</th><td>Kunsthotel Fuchspalast<br>Hauptstraße 7<br>4281 Mönchdorf</td></tr>
      <tr><th>Veranstalter</th><td>Musikschule Fröhlich</td></tr>
      <tr><th>Eintritt</th><td>€ 15,–</td></tr>
    </table></body></html>`;
    const out: any = {};
    applyVerticalTable(cheerio.load(html), out);
    expect(out.location_name).toBe('Kunsthotel Fuchspalast');
    expect(out.address).toBe('Hauptstraße 7');
    expect(out.postal_code).toBe('4281');
    expect(out.address_locality).toBe('Mönchdorf');
    expect(out.organizer).toBe('Musikschule Fröhlich');
    expect(out.price_text).toContain('15');
  });
});

describe('applyRegexFallbacks', () => {
  it('finds labeled address in description', () => {
    const html = `<html><body><main>Adresse: Kirchgasse 12, 8010 Graz</main></body></html>`;
    const out: any = { description: 'Adresse: Kirchgasse 12, 8010 Graz' };
    applyRegexFallbacks(out, cheerio.load(html));
    expect(out.address).toBe('Kirchgasse 12');
    expect(out.postal_code).toBe('8010');
    expect(out.address_locality).toBe('Graz');
  });

  it('finds "Eintritt frei" → price_min=0', () => {
    const html = `<html><body><main>${'x'.repeat(200)}</main></body></html>`;
    const out: any = { description: 'Der Eintritt ist frei. Wir freuen uns auf euch!' };
    applyRegexFallbacks(out, cheerio.load(html));
    expect(out.price_min).toBe(0);
    expect(out.price_text?.toLowerCase()).toContain('frei');
  });

  it('rejects "Tisch 5" as address', () => {
    const html = `<html><body><main>${'x'.repeat(200)}</main></body></html>`;
    const out: any = { description: 'Adresse: Tisch 5' };
    applyRegexFallbacks(out, cheerio.load(html));
    expect(out.address).toBeUndefined();
  });
});
```

- [ ] **Step 5.2: Run tests — should fail**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/universal.test.ts
```

Expected: FAIL — cannot find module.

- [ ] **Step 5.3: Implement universal.ts**

Port the contents of `src/lib/scrapers/gem2go-detail.ts` lines 60-432, EXCLUDING `applyCssSelectors` (that becomes the gem2go adapter in Task 7). Export four named functions: `applyJsonLd`, `applyOgMeta`, `applyVerticalTable`, `applyRegexFallbacks`. Also re-export the helpers `formatEuro`, `stripHtml`, `toNumber`, `normalizePriceText`, and the type aliases `JsonLdEvent`, `JsonLdPlace`, `JsonLdOffer`.

```ts
// src/lib/scrapers/detail-extract/universal.ts
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { DetailEnrichment } from './types';
import { isValidAddressText } from './validate';

// Copy verbatim from src/lib/scrapers/gem2go-detail.ts:
//   - findJsonLdEvent, unwrapJsonLd, applyOffers, toNumber  (helpers)
//   - applyJsonLd (lines ~62-103)                            (Layer 1)
//   - applyOgMeta (lines ~389-402)                           (Layer 3)
//   - applyVerticalTable + parseLocationSegments (lines ~276-363) (Layer 4)
//   - applyRegexFallbacks + all regexes (lines ~404-596)     (Layer 5)
//   - formatEuro, stripHtml, normalizePriceText helpers
// EXCLUDE applyCssSelectors — that moves into adapters/gem2go.ts.
//
// Then add address-validity guard at the end of applyRegexFallbacks:
//   if (out.address && !isValidAddressText(out.address)) delete out.address;

// Public re-exports:
export { applyJsonLd, applyOgMeta, applyVerticalTable, applyRegexFallbacks };
export type { JsonLdEvent, JsonLdPlace, JsonLdOffer };
```

(The engineer reads gem2go-detail.ts and ports the relevant blocks. The new file must NOT contain `va-adr-strasse` or any other gem2go-specific CSS class.)

- [ ] **Step 5.4: Add address-validity guard at end of applyRegexFallbacks**

After all the labeled+freetext patterns ran, add:

```ts
// At the bottom of applyRegexFallbacks:
if (out.address && !isValidAddressText(out.address)) {
  delete out.address;
}
```

This catches false-positives like "Tisch 5" that match the rural-address regex `[A-ZÄÖÜ][A-Za-zäöüß\-]{2,}\s+\d+`.

- [ ] **Step 5.5: Run tests — should pass**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/universal.test.ts
```

Expected: PASS.

- [ ] **Step 5.6: Commit**

```bash
git add src/lib/scrapers/detail-extract/universal.ts src/lib/scrapers/detail-extract/__tests__/universal.test.ts
git commit -m "feat(detail-extract): universal layers (JSON-LD, OG, vtable, regex)"
```

---

## Task 6: extract.ts + registry.ts (Composer + Adapter Lookup)

**Files:**
- Test: `src/lib/scrapers/detail-extract/__tests__/extract.test.ts`
- Create: `src/lib/scrapers/detail-extract/registry.ts`
- Create: `src/lib/scrapers/detail-extract/extract.ts`

- [ ] **Step 6.1: Write the tests**

```ts
// src/lib/scrapers/detail-extract/__tests__/extract.test.ts
import { describe, it, expect } from 'vitest';
import { enrichFromDetailHtml } from '../extract';

describe('enrichFromDetailHtml', () => {
  it('returns {} for invalid HTML', () => {
    const html = '<html><head><title>404</title></head><body></body></html>';
    const r = enrichFromDetailHtml('test', 'https://x', html);
    expect(r.layersHit).toEqual([]);
    expect(r.address).toBeUndefined();
  });

  it('extracts via JSON-LD layer alone if no adapter', () => {
    const html = `<html><head><title>X</title></head><body><main>${'x'.repeat(300)}<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      location: { address: { streetAddress: 'Mariahilfer Straße 1', postalCode: '1060' }},
    })}</script></main></body></html>`;
    const r = enrichFromDetailHtml('unknown-source', 'https://x', html);
    expect(r.address).toBe('Mariahilfer Straße 1');
    expect(r.postal_code).toBe('1060');
    expect(r.layersHit).toContain('jsonld');
    expect(r.address_confidence).toBe('high');
  });

  it('lower confidence when only og:meta hit', () => {
    const html = `<html><head><title>X</title>
      <meta property="og:description" content="${'desc '.repeat(40)}">
    </head><body><main>${'x'.repeat(300)}</main></body></html>`;
    const r = enrichFromDetailHtml('unknown', 'https://x', html);
    expect(r.description?.length).toBeGreaterThan(50);
    expect(r.layersHit).toContain('og');
    // no address at all → confidence undefined
    expect(r.address_confidence).toBeUndefined();
  });

  it('regex-only address gets confidence=low', () => {
    const desc = 'Adresse: Bahnhofstraße 12, 4020 Linz. ' + 'x'.repeat(200);
    const html = `<html><head><title>Event</title></head><body><main>${desc}</main></body></html>`;
    const r = enrichFromDetailHtml('unknown', 'https://x', html);
    expect(r.address).toBe('Bahnhofstraße 12');
    expect(r.address_confidence).toBe('low');
  });
});
```

- [ ] **Step 6.2: Run tests — should fail**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/extract.test.ts
```

Expected: FAIL.

- [ ] **Step 6.3: Implement registry.ts (stub for now — adapters added in later tasks)**

```ts
// src/lib/scrapers/detail-extract/registry.ts
import type { Adapter } from './types';

const ADAPTERS: Adapter[] = [
  // Adapters will register here in Task 7 (gem2go) and Tasks 13-17 (others).
];

const BY_NAME = new Map<string, Adapter>();
for (const a of ADAPTERS) {
  for (const n of a.sourceNames) BY_NAME.set(n, a);
}

export function getAdapter(sourceName: string): Adapter | null {
  return BY_NAME.get(sourceName) ?? null;
}

/** For tests / dynamic registration. */
export function registerAdapter(a: Adapter): void {
  ADAPTERS.push(a);
  for (const n of a.sourceNames) BY_NAME.set(n, a);
}
```

- [ ] **Step 6.4: Implement extract.ts**

```ts
// src/lib/scrapers/detail-extract/extract.ts
import * as cheerio from 'cheerio';
import type { EnrichmentResult, DetailEnrichment, AddressConfidence } from './types';
import { isValidHtml, isValidAddressText } from './validate';
import {
  applyJsonLd,
  applyOgMeta,
  applyVerticalTable,
  applyRegexFallbacks,
} from './universal';
import { getAdapter } from './registry';

/**
 * Pure function: takes source_name + url + HTML, returns extracted fields
 * with confidence and which layers contributed. No I/O, no DB.
 */
export function enrichFromDetailHtml(
  sourceName: string,
  url: string,
  html: string,
): EnrichmentResult {
  const result: EnrichmentResult = { layersHit: [] };

  // Preprocess: inject spaces around <br> for cheerio .text() (gem2go regression)
  const preprocessed = html.replace(/<br\s*\/?>/gi, ' <br> ');
  const $ = cheerio.load(preprocessed);

  if (!isValidHtml(html, $)) return result;

  const adapter = getAdapter(sourceName);

  // Run adapter-specific isDetailPage gate if provided
  if (adapter?.isDetailPage && !adapter.isDetailPage($, url)) return result;

  const before = { ...result };

  // Layer 1: JSON-LD
  applyJsonLd($, result);
  if (changed(before, result)) result.layersHit.push('jsonld');

  // Layer 2: Adapter (source-specific CSS)
  if (adapter) {
    const partial = adapter.extract($, result, url);
    const beforeAdapter = { ...result };
    for (const k of Object.keys(partial) as Array<keyof DetailEnrichment>) {
      const v = partial[k];
      if (v === undefined) continue;
      // Adapter only overrides JSON-LD if explicitly allowed
      if (result[k] !== undefined && !adapter.overridesJsonLd) continue;
      (result as Record<string, unknown>)[k] = v;
    }
    if (changed(beforeAdapter, result)) result.layersHit.push('adapter');
  }

  // Layer 3: OpenGraph
  const beforeOg = { ...result };
  applyOgMeta($, result);
  if (changed(beforeOg, result)) result.layersHit.push('og');

  // Layer 4: Vertical table
  const beforeVtable = { ...result };
  applyVerticalTable($, result);
  if (changed(beforeVtable, result)) result.layersHit.push('vtable');

  // Layer 5: Regex
  const beforeRegex = { ...result };
  applyRegexFallbacks(result, $);
  if (changed(beforeRegex, result)) result.layersHit.push('regex');

  // Compute confidence based on which layer produced the address
  result.address_confidence = computeAddressConfidence(result.layersHit, !!result.address);

  // Clean: empty strings → undefined
  for (const k of Object.keys(result) as Array<keyof EnrichmentResult>) {
    const v = result[k];
    if (typeof v === 'string' && v.trim().length === 0) {
      delete (result as Record<string, unknown>)[k];
    }
  }

  return result;
}

function changed(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean {
  // Compare all keys that exist in either — exclude layersHit
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => k !== 'layersHit' && k !== 'address_confidence'));
  for (const k of keys) if (a[k] !== b[k]) return true;
  return false;
}

function computeAddressConfidence(layers: string[], hasAddress: boolean): AddressConfidence | undefined {
  if (!hasAddress) return undefined;
  // Highest-priority layer that ran wins the confidence assignment.
  if (layers.includes('jsonld') || layers.includes('adapter')) return 'high';
  if (layers.includes('vtable')) return 'medium';
  if (layers.includes('regex')) return 'low';
  return undefined;
}
```

- [ ] **Step 6.5: Run tests — should pass**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/extract.test.ts
```

Expected: PASS.

- [ ] **Step 6.6: Commit**

```bash
git add src/lib/scrapers/detail-extract/extract.ts src/lib/scrapers/detail-extract/registry.ts src/lib/scrapers/detail-extract/__tests__/extract.test.ts
git commit -m "feat(detail-extract): enrichFromDetailHtml composer + adapter registry"
```

---

## Task 7: gem2go Adapter (Refactor from gem2go-detail.ts)

**Files:**
- Create: `src/lib/scrapers/detail-extract/adapters/gem2go.ts`
- Test: `src/lib/scrapers/detail-extract/__tests__/adapters/gem2go.test.ts`
- Modify: `src/lib/scrapers/detail-extract/registry.ts` (register gem2go adapter)

- [ ] **Step 7.1: Write the test**

```ts
// src/lib/scrapers/detail-extract/__tests__/adapters/gem2go.test.ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { gem2goAdapter } from '../../adapters/gem2go';

describe('gem2goAdapter', () => {
  it('extracts via va-adr-* CSS classes', () => {
    const html = `<html><body>
      <span class="va-vaort">Pfarrsaal</span>
      <span class="va-adr-strasse">Kirchengasse</span>
      <span class="va-adr-hnr">7,</span>
      <span class="va-adr-plz">3040</span>
      <span class="va-adr-ort">Neulengbach</span>
      <div class="vatext_container"><div class="mehrtext-limiter">Konzert mit dem örtlichen Chor.</div></div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://gemeinde.example/');
    expect(r.location_name).toBe('Pfarrsaal');
    expect(r.address).toBe('Kirchengasse 7');
    expect(r.postal_code).toBe('3040');
    expect(r.address_locality).toBe('Neulengbach');
    expect(r.description).toContain('Konzert');
  });

  it('does not override existing JSON-LD values', () => {
    const html = `<html><body>
      <span class="va-adr-strasse">CSS Strasse</span>
      <span class="va-adr-hnr">1</span>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, { address: 'JsonLd Strasse 99' }, 'https://x');
    // Adapter respects existing (caller will skip non-undefined overlay)
    // But extract function may still return — composer handles overrides
    expect(r.address).toBe('CSS Strasse 1');
  });
});
```

- [ ] **Step 7.2: Run — should fail**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/adapters/gem2go.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 7.3: Create adapter — port `applyCssSelectors` from gem2go-detail.ts**

```ts
// src/lib/scrapers/detail-extract/adapters/gem2go.ts
import type { CheerioAPI } from 'cheerio';
import type { Adapter, DetailEnrichment } from '../types';

export const gem2goAdapter: Adapter = {
  sourceNames: ['gem2go', 'gemeinde-registry', 'gemeinden-generic', 'gemeinden', 'gemeinden-wp-burgenland'],
  extract($, current, url) {
    const out: Partial<DetailEnrichment> = {};

    const venue = $('.va-vaort').first().text().trim();
    if (venue) out.location_name = venue;

    const strasse = $('.va-adr-strasse').first().text().trim();
    if (strasse) {
      const hnrRaw = $('.va-adr-hnr').first().text().trim();
      const hnr = hnrRaw.replace(/[,\s]+$/, '').trim();
      out.address = hnr ? `${strasse} ${hnr}` : strasse;
    }

    const plz = $('.va-adr-plz').first().text().trim();
    if (plz) out.postal_code = plz;

    const ort = $('.va-adr-ort').first().text().trim();
    if (ort) out.address_locality = ort;

    const organizer = $('.veranstalter_bez_veranstalter').first().text().trim()
      || $('.veranstaltername, .organizer_name').first().text().trim();
    if (organizer) out.organizer = organizer;

    // Description: target the inner content, NOT the wrapper
    let candidate = $('.vatext_container .mehrtext-limiter').first().text().trim().replace(/\s+/g, ' ');
    if (!candidate) {
      const $clone = $('.vatext_container').first().clone();
      $clone.find('.mehrtext-toggle, .defaultfontsize').remove();
      candidate = $clone.text().trim().replace(/\s+/g, ' ');
    }
    if (candidate && candidate !== 'mehr anzeigen' && candidate.length > 20) {
      out.description = candidate;
    }

    return out;
  },
};
```

- [ ] **Step 7.4: Register in registry.ts**

Edit `src/lib/scrapers/detail-extract/registry.ts`:

```ts
// Add at top:
import { gem2goAdapter } from './adapters/gem2go';

// Replace empty ADAPTERS with:
const ADAPTERS: Adapter[] = [gem2goAdapter];
```

- [ ] **Step 7.5: Run tests — should pass**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/adapters/gem2go.test.ts
```

Expected: PASS.

- [ ] **Step 7.6: Commit**

```bash
git add src/lib/scrapers/detail-extract/adapters/gem2go.ts src/lib/scrapers/detail-extract/__tests__/adapters/gem2go.test.ts src/lib/scrapers/detail-extract/registry.ts
git commit -m "feat(detail-extract): gem2go adapter (refactored from gem2go-detail.ts)"
```

---

## Task 8: Backward-compat Wrapper for gem2go-detail.ts

**Files:**
- Modify: `src/lib/scrapers/gem2go-detail.ts` — replace contents with thin re-export

- [ ] **Step 8.1: Replace gem2go-detail.ts**

```ts
// src/lib/scrapers/gem2go-detail.ts
//
// LEGACY shim — kept for backward compatibility with three call sites
// (Gem2GoScraper, GenericGemeindeScraper, GemeindeRegistryScraper) and
// the existing test suite. New code should use enrichFromDetailHtml().

import { enrichFromDetailHtml } from './detail-extract/extract';
export type { DetailEnrichment } from './detail-extract/types';

export function extractGem2goDetail(html: string): import('./detail-extract/types').DetailEnrichment {
  const { layersHit: _l, address_confidence: _c, ...fields } = enrichFromDetailHtml('gem2go', '', html);
  return fields;
}
```

- [ ] **Step 8.2: Run the existing gem2go-detail tests**

```bash
npx vitest run --reporter=verbose 2>&1 | grep -iE "gem2go|detail" | head -50
```

Expected: All previously-passing tests for `gem2go-detail` still pass.

- [ ] **Step 8.3: Run full test suite**

```bash
npm test
```

Expected: green (or no new failures vs. baseline).

- [ ] **Step 8.4: Commit**

```bash
git add src/lib/scrapers/gem2go-detail.ts
git commit -m "refactor(detail-extract): gem2go-detail.ts becomes thin re-export"
```

---

## Task 9: BaseScraper.enrichFromDetail() Hook

**Files:**
- Test: `src/__tests__/lib/scrapers/base-scraper-enrich.test.ts`
- Modify: `src/lib/scrapers/BaseScraper.ts`

- [ ] **Step 9.1: Write the test**

```ts
// src/__tests__/lib/scrapers/base-scraper-enrich.test.ts
import { describe, it, expect, vi } from 'vitest';
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import type { ScrapedEvent } from '@/types/events';

class TestScraper extends BaseScraper {
  readonly name = 'test-source';
  async scrape(): Promise<ScrapedEvent[]> { return []; }
  // Expose protected for testing
  public _enrich = this.enrichFromDetail.bind(this);
  public _setFetch(fn: (url: string) => Promise<string>) {
    (this as any).fetchWithTimeout = fn;
  }
}

const ev = (id: string, url: string | null): ScrapedEvent => ({
  source_id: id, source_name: 'test-source', source_url: url, title: 't', start_date: '2026-06-01',
});

describe('BaseScraper.enrichFromDetail', () => {
  it('skips events without source_url', async () => {
    const s = new TestScraper();
    const fetchMock = vi.fn();
    s._setFetch(fetchMock);
    const events = [ev('1', null)];
    const sum = await s._enrich(events);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sum.fetched).toBe(0);
  });

  it('fetches and merges JSON-LD address', async () => {
    const s = new TestScraper();
    const html = `<html><head><title>X</title></head><body><main>${'x'.repeat(300)}<script type="application/ld+json">${JSON.stringify({
      '@type': 'Event',
      location: { name: 'Stadthalle', address: { streetAddress: 'Roland-Rainer-Platz 1', postalCode: '1150' }},
    })}</script></main></body></html>`;
    s._setFetch(async () => html);
    const events = [ev('1', 'https://example.com/e/1')];
    const sum = await s._enrich(events);
    expect(events[0].address).toBe('Roland-Rainer-Platz 1');
    expect(events[0].postal_code).toBe('1150');
    expect(sum.success).toBe(1);
  });

  it('does not throw on per-event fetch failure', async () => {
    const s = new TestScraper();
    s._setFetch(async () => { throw new Error('HTTP 500'); });
    const events = [ev('1', 'https://example.com/e/1')];
    const sum = await s._enrich(events);
    expect(sum.http_error).toBe(1);
    expect(events[0].address).toBeUndefined();
  });
});
```

- [ ] **Step 9.2: Run — should fail**

```bash
npx vitest run src/__tests__/lib/scrapers/base-scraper-enrich.test.ts
```

Expected: FAIL — method not found.

- [ ] **Step 9.3: Add `enrichFromDetail` to BaseScraper**

Insert before the final closing brace of `BaseScraper.ts`:

```ts
  // ─── DETAIL-PAGE ENRICHMENT HOOK ─────────────────────────────────────────
  // See docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md §7.
  // Opt-in: scrapers call this at the end of scrape() if they have source_urls.

  protected async enrichFromDetail(
    events: ScrapedEvent[],
    opts?: {
      concurrency?: number;
      perHostMaxConcurrent?: number;
      skipIfComplete?: (e: ScrapedEvent) => boolean;
      detailTimeoutMs?: number;
    },
  ): Promise<DetailEnrichSummary> {
    const concurrency = opts?.concurrency ?? 4;
    const perHostMax = opts?.perHostMaxConcurrent ?? 2;
    const detailTimeoutMs = opts?.detailTimeoutMs ?? 10000;
    const skipIfComplete = opts?.skipIfComplete ?? defaultSkipIfComplete;

    const work = events.filter((e) => e.source_url && !skipIfComplete(e));
    const summary: DetailEnrichSummary = {
      fetched: 0, success: 0, no_change: 0, http_error: 0, timeout: 0, invalid_html: 0, parse_empty: 0,
    };

    const hostCounts = new Map<string, number>();
    const queue = work.slice();
    let active = 0;

    const startOne = async (e: ScrapedEvent): Promise<void> => {
      const host = safeHostname(e.source_url!);
      hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
      summary.fetched++;
      try {
        const html = await this.fetchWithTimeout(e.source_url!, detailTimeoutMs);
        if (!html) { summary.parse_empty++; return; }
        const before = JSON.stringify({ a: e.address, d: e.description, p: e.price_text, l: e.location_name });
        const enrichment = enrichFromDetailHtml(this.name, e.source_url!, html);
        if (enrichment.layersHit.length === 0) { summary.invalid_html++; return; }
        mergeEnrichment(e, enrichment);
        const after = JSON.stringify({ a: e.address, d: e.description, p: e.price_text, l: e.location_name });
        if (before === after) summary.no_change++;
        else summary.success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/timeout|abort/i.test(msg)) summary.timeout++;
        else summary.http_error++;
      } finally {
        hostCounts.set(host, hostCounts.get(host)! - 1);
      }
    };

    return new Promise<DetailEnrichSummary>((resolve) => {
      const tick = (): void => {
        while (active < concurrency && queue.length) {
          // Find an event whose host has capacity
          const idx = queue.findIndex((e) => (hostCounts.get(safeHostname(e.source_url!)) ?? 0) < perHostMax);
          if (idx === -1) break;
          const [next] = queue.splice(idx, 1);
          active++;
          void startOne(next).finally(() => {
            active--;
            if (active === 0 && queue.length === 0) resolve(summary);
            else tick();
          });
        }
        if (active === 0 && queue.length === 0) resolve(summary);
      };
      if (work.length === 0) resolve(summary);
      else tick();
    });
  }
```

Add at top of BaseScraper.ts (after existing imports):

```ts
import { enrichFromDetailHtml } from './detail-extract/extract';
import { mergeEnrichment } from './detail-extract/merge';

export interface DetailEnrichSummary {
  fetched: number;
  success: number;
  no_change: number;
  http_error: number;
  timeout: number;
  invalid_html: number;
  parse_empty: number;
}

function defaultSkipIfComplete(e: ScrapedEvent): boolean {
  // Skip if all three priority fields are populated
  return !!(e.address && e.description && e.description.length > 80 && e.price_text);
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}
```

- [ ] **Step 9.4: Run tests**

```bash
npx vitest run src/__tests__/lib/scrapers/base-scraper-enrich.test.ts
```

Expected: PASS.

- [ ] **Step 9.5: Commit**

```bash
git add src/lib/scrapers/BaseScraper.ts src/__tests__/lib/scrapers/base-scraper-enrich.test.ts
git commit -m "feat(scrapers): BaseScraper.enrichFromDetail() with per-host throttling"
```

---

## Task 10: Quality-Flag Integration

**Files:**
- Modify: `src/lib/pipeline/quality-flags.ts` (find the actual file path first)

- [ ] **Step 10.1: Find the existing quality-flag computation**

```bash
grep -rln "missing_coords\|missing_location\|FlagType" src/lib/pipeline/ src/lib/db/ src/scripts/ | head -5
```

Identify the file that computes quality flags during the pipeline.

- [ ] **Step 10.2: Add the flag computation**

Wherever the existing flag computation lives, add (using the correct local imports):

```ts
import { isValidAddressText } from '@/lib/scrapers/detail-extract/validate';

// Add to the flag-computation function:
if (!event.address || !isValidAddressText(event.address)) {
  flags.push({
    type: 'missing_address_street',
    severity: 'warning',
    detail: event.location_name ? `nur location_name="${event.location_name}"` : 'keine address-info',
  });
  if (event.latitude != null && event.longitude != null && event.publish_status === 'published') {
    event.publish_status = 'published_low_confidence';
  }
}
```

- [ ] **Step 10.3: Add the flag to `FlagType` union**

Edit `src/lib/pipeline/types.ts` line ~19-30:

```ts
export type FlagType =
  | 'missing_coords'
  | 'missing_date'
  | 'missing_title'
  | 'missing_location'
  | 'missing_address_street'   // NEW
  | 'outside_austria'
  | 'short_title'
  | 'duplicate_uncertain'
  | 'duplicate_merged'
  | 'garbage_title'
  | 'venue_unmatched'
  | 'venue_geo_mismatch';
```

- [ ] **Step 10.4: Run pipeline tests**

```bash
npm test -- pipeline
```

Expected: green.

- [ ] **Step 10.5: Commit**

```bash
git add src/lib/pipeline/
git commit -m "feat(pipeline): missing_address_street quality flag + soft-gate"
```

---

## Task 11: probe-adapter CLI

**Files:**
- Create: `src/scripts/probe-adapter.ts`
- Modify: `package.json` (add script)

- [ ] **Step 11.1: Implement probe-adapter.ts**

```ts
// src/scripts/probe-adapter.ts
//
// Diagnostic CLI: pulls N sample events of a source (with source_url and
// no address), fetches each detail HTML, runs Universal-only extraction,
// and prints what was found vs. what's still missing. Output guides
// adapter authoring.
//
// Run: npx tsx --env-file=.env.local src/scripts/probe-adapter.ts --source meinbezirk --sample 5

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { enrichFromDetailHtml } from '../lib/scrapers/detail-extract/extract';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}

async function main() {
  const source = arg('source');
  const sample = parseInt(arg('sample', '5')!, 10);
  if (!source) { console.error('Usage: --source <name> [--sample N]'); process.exit(1); }

  const today = new Date().toISOString().slice(0, 10);
  const { data: events, error } = await sb
    .from('events')
    .select('id,title,source_url,address,location_name,description,price_text,postal_code')
    .eq('source_name', source)
    .gte('start_date', today)
    .is('address', null)
    .not('source_url', 'is', null)
    .limit(sample);
  if (error) { console.error(error); process.exit(1); }
  if (!events || events.length === 0) { console.log('No events found for source'); return; }

  console.log(`\n=== PROBING ${source} (${events.length} samples) ===\n`);

  const stats = { jsonld: 0, vtable: 0, og: 0, regex: 0, none: 0, addr: 0, desc: 0, price: 0, loc: 0 };

  for (const e of events) {
    console.log(`\n— ${(e.title ?? '').slice(0, 60)} —`);
    console.log(`  url=${e.source_url}`);
    let html: string;
    try {
      const r = await fetch(e.source_url!, { headers: { 'User-Agent': 'osterreich-events-probe/1.0' } });
      if (!r.ok) { console.log(`  HTTP ${r.status} — skipped`); continue; }
      html = await r.text();
    } catch (err) {
      console.log(`  fetch failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const result = enrichFromDetailHtml(source, e.source_url!, html);
    console.log(`  layers:    [${result.layersHit.join(', ') || 'none'}]`);
    console.log(`  address:   ${result.address ?? '∅'} (conf=${result.address_confidence ?? '-'})`);
    console.log(`  loc_name:  ${result.location_name ?? '∅'}`);
    console.log(`  desc len:  ${result.description?.length ?? 0}`);
    console.log(`  price:     ${result.price_text ?? '∅'}`);

    if (result.layersHit.includes('jsonld')) stats.jsonld++;
    if (result.layersHit.includes('vtable')) stats.vtable++;
    if (result.layersHit.includes('og')) stats.og++;
    if (result.layersHit.includes('regex')) stats.regex++;
    if (result.layersHit.length === 0) stats.none++;
    if (result.address) stats.addr++;
    if (result.description) stats.desc++;
    if (result.price_text) stats.price++;
    if (result.location_name) stats.loc++;

    // Diagnostic: show top-level structure that an adapter could exploit
    const $ = cheerio.load(html);
    const candidates: string[] = [];
    $('[class*="adresse"], [class*="address"], [class*="ort"], [class*="venue"], [class*="location"]').each((_, el) => {
      const cls = $(el).attr('class') ?? '';
      const txt = $(el).text().trim().slice(0, 60);
      if (cls && txt) candidates.push(`  .${cls} = "${txt}"`);
    });
    if (candidates.length) {
      console.log(`  candidate selectors:`);
      candidates.slice(0, 8).forEach((c) => console.log(c));
    }
  }

  console.log(`\n=== STATS (n=${events.length}) ===`);
  console.log(`  layers hit:    jsonld=${stats.jsonld}  vtable=${stats.vtable}  og=${stats.og}  regex=${stats.regex}  none=${stats.none}`);
  console.log(`  fields found:  address=${stats.addr}  description=${stats.desc}  price=${stats.price}  location_name=${stats.loc}`);
  console.log(`  → Adapter recommended if address-coverage < 80% (${stats.addr}/${events.length}=${Math.round(100*stats.addr/events.length)}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 11.2: Add npm script**

Edit `package.json` scripts:

```json
"probe:adapter": "tsx --env-file=.env.local src/scripts/probe-adapter.ts",
```

- [ ] **Step 11.3: Smoke test against gem2go**

```bash
npm run probe:adapter -- --source gem2go --sample 5
```

Expected: prints layer-hit stats; gem2go should mostly hit `adapter` + `jsonld`.

- [ ] **Step 11.4: Commit**

```bash
git add src/scripts/probe-adapter.ts package.json
git commit -m "feat(detail-extract): probe-adapter CLI for diagnosing source coverage"
```

---

## Task 12: meinbezirk Adapter (TDD with live probe)

**Files:**
- Create: `src/lib/scrapers/detail-extract/__tests__/adapters/fixtures/meinbezirk/sample-1.html`
- Test: `src/lib/scrapers/detail-extract/__tests__/adapters/meinbezirk.test.ts`
- Create: `src/lib/scrapers/detail-extract/adapters/meinbezirk.ts`
- Modify: `src/lib/scrapers/detail-extract/registry.ts`

- [ ] **Step 12.1: Run probe to see what universal already gets**

```bash
npm run probe:adapter -- --source meinbezirk --sample 5
```

Note the candidate selectors and missing fields.

- [ ] **Step 12.2: Save 2 real fixtures locally**

```bash
mkdir -p src/lib/scrapers/detail-extract/__tests__/adapters/fixtures/meinbezirk
# Fetch two sample detail pages — use URLs from probe output:
curl -sL -A "Mozilla/5.0" "<sample-url-1>" > src/lib/scrapers/detail-extract/__tests__/adapters/fixtures/meinbezirk/sample-1.html
curl -sL -A "Mozilla/5.0" "<sample-url-2>" > src/lib/scrapers/detail-extract/__tests__/adapters/fixtures/meinbezirk/sample-2.html
```

(If probe shows JSON-LD coverage is already > 90%, skip the adapter entirely — just register a no-op or none at all. Log this decision in the commit.)

- [ ] **Step 12.3: Inspect fixtures + identify CSS pattern**

```bash
grep -oE 'class="[^"]*(adresse|address|ort|venue|location|event)[^"]*"' src/lib/scrapers/detail-extract/__tests__/adapters/fixtures/meinbezirk/sample-1.html | sort -u
```

Pick the 2-3 most consistent selectors.

- [ ] **Step 12.4: Write the test**

```ts
// src/lib/scrapers/detail-extract/__tests__/adapters/meinbezirk.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import { meinbezirkAdapter } from '../../adapters/meinbezirk';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures/meinbezirk', name), 'utf8');

describe('meinbezirkAdapter', () => {
  it('extracts address from sample-1', () => {
    const $ = cheerio.load(fixture('sample-1.html'));
    const r = meinbezirkAdapter.extract($, {}, '');
    expect(r.address).toBeTruthy();
    // Adjust expectation based on the fixture you captured
  });

  it('extracts venue from sample-2', () => {
    const $ = cheerio.load(fixture('sample-2.html'));
    const r = meinbezirkAdapter.extract($, {}, '');
    expect(r.location_name).toBeTruthy();
  });
});
```

- [ ] **Step 12.5: Implement adapter based on findings**

```ts
// src/lib/scrapers/detail-extract/adapters/meinbezirk.ts
import type { Adapter, DetailEnrichment } from '../types';

export const meinbezirkAdapter: Adapter = {
  sourceNames: ['meinbezirk'],
  extract($, current, url) {
    const out: Partial<DetailEnrichment> = {};
    // Based on probe results — replace placeholders with actual selectors
    // Examples of selectors meinbezirk.at uses (verify with fixture):
    //   .event-detail-location, .event-detail-address, [itemprop="streetAddress"]
    const addr = $('[itemprop="streetAddress"]').first().text().trim();
    if (addr) out.address = addr;
    const plz = $('[itemprop="postalCode"]').first().text().trim();
    if (plz) out.postal_code = plz;
    const ort = $('[itemprop="addressLocality"]').first().text().trim();
    if (ort) out.address_locality = ort;
    const venue = $('[itemprop="name"][itemtype*="Place"], .event-venue-name').first().text().trim();
    if (venue) out.location_name = venue;
    return out;
  },
};
```

- [ ] **Step 12.6: Register adapter**

```ts
// src/lib/scrapers/detail-extract/registry.ts
import { meinbezirkAdapter } from './adapters/meinbezirk';

const ADAPTERS: Adapter[] = [gem2goAdapter, meinbezirkAdapter];
```

- [ ] **Step 12.7: Run tests + probe again, expect higher coverage**

```bash
npx vitest run src/lib/scrapers/detail-extract/__tests__/adapters/meinbezirk.test.ts
npm run probe:adapter -- --source meinbezirk --sample 10
```

Expected: stats shows address coverage now ≥ 80%.

- [ ] **Step 12.8: Commit**

```bash
git add src/lib/scrapers/detail-extract/adapters/meinbezirk.ts \
        src/lib/scrapers/detail-extract/__tests__/adapters/meinbezirk.test.ts \
        src/lib/scrapers/detail-extract/__tests__/adapters/fixtures/meinbezirk/ \
        src/lib/scrapers/detail-extract/registry.ts
git commit -m "feat(detail-extract): meinbezirk adapter"
```

---

## Tasks 13–16: Adapters for falter, innsbruck-clubs, events.at, eventfrog

For each adapter, repeat the Task 12 pattern exactly:

1. `npm run probe:adapter -- --source <name> --sample 5`
2. Save 2-3 fixture HTMLs to `__tests__/adapters/fixtures/<source>/`
3. Identify CSS selectors from fixtures
4. Write Vitest test with fixture
5. Implement `<source>.ts` adapter
6. Register in `registry.ts`
7. Re-probe — expect address coverage > 80%
8. Commit per adapter

**Task 13: falter** — Source name: `falter` — Detail URLs: `https://www.falter.at/event/<id>/<slug>`. Falter likely uses JSON-LD; check probe output first; adapter only needed for fields JSON-LD lacks.

**Task 14: innsbruck-clubs** — Source name: `innsbruck-clubs` — most events are on `treibhaus.at`. CSS-based.

**Task 15: events.at** — Source name: `events.at` — Detail URLs: `https://events.at/event/<slug>`. Has structured event pages.

**Task 16: eventfrog** — Source name: `eventfrog` — already 88% address coverage (only 83 missing). May only need OG meta. Probe first; skip adapter if not needed.

---

## Task 17: Wire up enrichFromDetail() in 6 Scrapers

For each scraper that should now enrich after scraping, add **one line** at the end of its `scrape()` method.

- [ ] **Step 17.1: Gem2GoScraper — replace its existing private enrich method**

In `src/lib/scrapers/Gem2GoScraper.ts`:
1. Find the existing call `await this.enrichEventsFromDetailPages(events);` — replace with `await this.enrichFromDetail(events);`.
2. Delete the now-unused private method `enrichEventsFromDetailPages()`.
3. Run gem2go-related tests + smoke-scrape (`npm run scrape -- --source gem2go --limit 5` or equivalent).

- [ ] **Step 17.2: GenericGemeindeScraper — replace inline detail block**

In `src/lib/scrapers/GenericGemeindeScraper.ts` line ~189 the code calls `extractGem2goDetail(html)` inline during the per-event loop. Refactor: collect events first, then call `await this.enrichFromDetail(events)` at the end.

(Backward-compat: since `gem2go-detail.ts` re-exports `extractGem2goDetail`, do NOT delete the inline block — only ADD the hook call. The inline block already filled values; the hook will be a no-op via `skipIfComplete`.)

- [ ] **Step 17.3: GemeindeRegistryScraper — same as above**

In `src/lib/scrapers/GemeindeRegistryScraper.ts` line ~227.

- [ ] **Step 17.4: MeinBezirkScraper, FalterScraper, others**

Edit each scraper file (`MeinBezirkScraper.ts`, `FalterScraper.ts`, `InnsbruckClubsScraper.ts`, `EventsAtScraper.ts`, `EventfrogScraper.ts`) — at the end of `scrape()`:

```ts
await this.enrichFromDetail(events);
return events;
```

- [ ] **Step 17.5: Smoke-scrape one source**

```bash
npm run scrape -- --source meinbezirk --limit 20
```

Watch console for `[meinbezirk]` logs + ensure no crashes.

- [ ] **Step 17.6: Run full test suite**

```bash
npm test
```

Expected: green.

- [ ] **Step 17.7: Commit**

```bash
git add src/lib/scrapers/Gem2GoScraper.ts src/lib/scrapers/GenericGemeindeScraper.ts src/lib/scrapers/GemeindeRegistryScraper.ts src/lib/scrapers/MeinBezirkScraper.ts src/lib/scrapers/FalterScraper.ts src/lib/scrapers/InnsbruckClubsScraper.ts src/lib/scrapers/EventsAtScraper.ts src/lib/scrapers/EventfrogScraper.ts
git commit -m "feat(scrapers): activate enrichFromDetail() hook in 6 sources"
```

---

## Task 18: Backfill CLI

**Files:**
- Create: `src/scripts/backfill-detail-enrich.ts`
- Modify: `package.json`

- [ ] **Step 18.1: Implement backfill-detail-enrich.ts**

```ts
// src/scripts/backfill-detail-enrich.ts
//
// Offline replay: pulls future events with source_url + missing fields,
// fetches the detail HTML, runs enrichFromDetailHtml + mergeEnrichment,
// writes back via BulkUpdater.
//
// Run examples:
//   npm run backfill:detail
//   npm run backfill:detail -- --source falter
//   npm run backfill:detail -- --source meinbezirk --limit 100 --dry-run
//   npm run backfill:detail -- --concurrency 6 --per-host 2
//   npm run backfill:detail -- --retry-failed
//
// Resume: writes data/backfill-detail-checkpoint.json after each chunk.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { enrichFromDetailHtml } from '../lib/scrapers/detail-extract/extract';
import { mergeEnrichment } from '../lib/scrapers/detail-extract/merge';
import type { ScrapedEvent } from '@/types/events';

const CHECKPOINT = 'data/backfill-detail-checkpoint.json';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return process.argv[i + 1];
}
function hasFlag(name: string): boolean { return process.argv.includes(`--${name}`); }

interface Stats {
  fetched: number; success: number; no_change: number;
  http_error: number; timeout: number; invalid_html: number; parse_empty: number;
}

async function main() {
  const source = arg('source');
  const limit = parseInt(arg('limit', '0')!, 10);
  const concurrency = parseInt(arg('concurrency', '4')!, 10);
  const perHostMax = parseInt(arg('per-host', '2')!, 10);
  const since = arg('since');
  const dryRun = hasFlag('dry-run');
  const retryFailed = hasFlag('retry-failed');
  const verbose = hasFlag('verbose');

  // Build query
  const today = new Date().toISOString().slice(0, 10);
  let q = sb.from('events')
    .select('id,source_name,source_url,title,start_date,address,description,price_text,location_name,postal_code,price_min,price_max,organizer,image_url,last_detail_fetch_status')
    .gte('start_date', today)
    .not('source_url', 'is', null);

  if (source) q = q.eq('source_name', source);
  if (since) q = q.gte('updated_at', since);
  if (!retryFailed) {
    // Skip recently-failed
    q = q.or('last_detail_fetch_status.is.null,last_detail_fetch_status.in.(success,no_change)');
  }
  q = q.is('address', null); // primary criterion
  if (limit > 0) q = q.limit(limit);

  const { data: events, error } = await q;
  if (error) throw error;
  console.log(`Loaded ${events?.length ?? 0} eligible events.`);
  if (!events || events.length === 0) return;

  // Stable sort: group by hostname for per-host throttling
  events.sort((a, b) => safeHost(a.source_url!).localeCompare(safeHost(b.source_url!)));

  // Resume checkpoint
  let resumeIdx = 0;
  if (existsSync(CHECKPOINT) && !dryRun) {
    const cp = JSON.parse(readFileSync(CHECKPOINT, 'utf8'));
    if (cp.lastIndex && cp.runId === checksum(events)) resumeIdx = cp.lastIndex;
  }
  console.log(`Resuming from index ${resumeIdx}`);

  const stats: Stats = { fetched: 0, success: 0, no_change: 0, http_error: 0, timeout: 0, invalid_html: 0, parse_empty: 0 };
  const updates: Array<{ id: string; patch: Partial<ScrapedEvent> & { last_detail_fetch_at: string; last_detail_fetch_status: string; address_confidence?: string } }> = [];
  const hostCounts = new Map<string, number>();
  const queue = events.slice(resumeIdx).map((e, i) => ({ ...e, _idx: resumeIdx + i }));
  let active = 0;
  let cpCounter = 0;

  await new Promise<void>((resolve) => {
    const finishOne = async () => {
      active--;
      cpCounter++;
      if (cpCounter % 50 === 0) {
        await flushUpdates();
      }
      if (active === 0 && queue.length === 0) {
        await flushUpdates();
        resolve();
      } else tick();
    };
    const tick = () => {
      while (active < concurrency && queue.length) {
        const idx = queue.findIndex((e) => (hostCounts.get(safeHost(e.source_url!)) ?? 0) < perHostMax);
        if (idx === -1) break;
        const [e] = queue.splice(idx, 1);
        const host = safeHost(e.source_url!);
        hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
        active++;
        void process(e).finally(() => {
          hostCounts.set(host, hostCounts.get(host)! - 1);
          finishOne();
        });
      }
      if (active === 0 && queue.length === 0) resolve();
    };
    tick();
  });

  console.log(`\n=== DONE ===\n${JSON.stringify(stats, null, 2)}`);

  async function process(e: any): Promise<void> {
    stats.fetched++;
    try {
      const r = await fetchHtml(e.source_url!, 10000);
      if (!r) { stats.parse_empty++; queueUpdate(e.id, 'parse_empty'); return; }
      const enrichment = enrichFromDetailHtml(e.source_name, e.source_url!, r);
      if (enrichment.layersHit.length === 0) { stats.invalid_html++; queueUpdate(e.id, 'invalid_html'); return; }
      const beforeJ = JSON.stringify({ a: e.address, d: e.description, p: e.price_text });
      mergeEnrichment(e, enrichment);
      const afterJ = JSON.stringify({ a: e.address, d: e.description, p: e.price_text });
      if (beforeJ === afterJ) { stats.no_change++; queueUpdate(e.id, 'no_change', enrichment.address_confidence); }
      else {
        stats.success++;
        queueUpdate(e.id, 'success', enrichment.address_confidence, {
          address: e.address,
          postal_code: e.postal_code,
          location_name: e.location_name,
          description: e.description,
          price_text: e.price_text,
          price_min: e.price_min,
          price_max: e.price_max,
          organizer: e.organizer,
          image_url: e.image_url,
        });
      }
      if (verbose) console.log(`  ✓ ${e.id} layers=[${enrichment.layersHit.join(',')}] addr=${e.address?.slice(0,40) ?? '∅'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/timeout|abort/i.test(msg)) { stats.timeout++; queueUpdate(e.id, 'timeout'); }
      else { stats.http_error++; queueUpdate(e.id, 'http_error'); }
    }
  }

  function queueUpdate(id: string, status: Stats['fetched'] extends number ? string : never, confidence?: string, patch?: Partial<ScrapedEvent>): void {
    updates.push({
      id,
      patch: {
        ...(patch ?? {}),
        last_detail_fetch_at: new Date().toISOString(),
        last_detail_fetch_status: status,
        ...(confidence ? { address_confidence: confidence } : {}),
      } as any,
    });
  }

  async function flushUpdates() {
    if (dryRun) {
      console.log(`  [dry-run] would persist ${updates.length} updates`);
      updates.length = 0;
      return;
    }
    if (updates.length === 0) return;
    // Use the existing BulkUpdater if available; otherwise update individually:
    for (const u of updates) {
      const { error } = await sb.from('events').update(u.patch).eq('id', u.id);
      if (error) console.error(`Update ${u.id} failed:`, error.message);
    }
    writeFileSync(CHECKPOINT, JSON.stringify({ lastIndex: events.length - queue.length, runId: checksum(events) }));
    updates.length = 0;
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'osterreich-events-backfill/1.0' } });
    if (!r.ok) return null;
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function safeHost(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

function checksum(events: any[]): string {
  return events.length + ':' + (events[0]?.id ?? '') + ':' + (events[events.length-1]?.id ?? '');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 18.2: Add npm script**

```json
"backfill:detail": "tsx --env-file=.env.local src/scripts/backfill-detail-enrich.ts",
```

- [ ] **Step 18.3: Dry-run smoke test (10 events)**

```bash
npm run backfill:detail -- --source gem2go --limit 10 --dry-run --verbose
```

Expected: prints layer-hit info for each event, no DB writes.

- [ ] **Step 18.4: Commit**

```bash
git add src/scripts/backfill-detail-enrich.ts package.json
git commit -m "feat(detail-extract): backfill-detail-enrich CLI"
```

---

## Task 19: Live Test — 5000 Events Backfill

This is the live-fire test. We run the backfill against real data, observe results, and iterate on adapters for sources that still show missing addresses.

- [ ] **Step 19.1: Baseline measurement**

```bash
npx tsx --env-file=.env.local src/scripts/inspect-missing-address.ts > /tmp/baseline.txt
cat /tmp/baseline.txt | head -40
```

Save the baseline `noAddr` per source. The user request: at least 5000 events processed.

- [ ] **Step 19.2: Run backfill on the top-volume sources, capped at 5000 events**

```bash
# Process 5000 events across the active-adapter sources
npm run backfill:detail -- --limit 5000 --concurrency 4 --per-host 2 --verbose 2>&1 | tee /tmp/backfill-run-1.log
```

Watch the final stats block. Expected: `success` ≥ 60% of `fetched`. Anything under 60% means an adapter needs work.

- [ ] **Step 19.3: Re-measure**

```bash
npx tsx --env-file=.env.local src/scripts/inspect-missing-address.ts > /tmp/after-run-1.txt
diff /tmp/baseline.txt /tmp/after-run-1.txt
```

Confirm that `noAddr` numbers dropped for the 5 active sources.

- [ ] **Step 19.4: Identify sources that still have missing addresses**

```bash
# Re-query: which sources still have a high missing-address rate after backfill?
# Use the Supabase MCP execute_sql with the same SQL as in the spec to get a fresh snapshot.
```

The query is:

```sql
SELECT source_name,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE address IS NULL) AS no_addr,
       ROUND(100.0 * COUNT(*) FILTER (WHERE address IS NULL) / COUNT(*), 1) AS pct
FROM events
WHERE start_date >= CURRENT_DATE
  AND publish_status IN ('published','published_low_confidence','draft','needs_review')
GROUP BY source_name
HAVING COUNT(*) FILTER (WHERE address IS NULL) > 50
ORDER BY no_addr DESC LIMIT 30;
```

- [ ] **Step 19.5: For each remaining source > 100 missing — do live web analysis**

For sources still over the threshold, pick 3 random `source_url`s from the DB (must have `address IS NULL`), open in a browser via WebFetch, and inspect:

1. Does the page even have a street address?
2. If YES — where? JSON-LD? A specific CSS class? Plain text?
3. Update the appropriate adapter OR the universal regex if it's a common pattern.
4. Re-test that adapter, re-run backfill on that source only.

Use this iteration loop:

```bash
# A. Look at 3 URLs interactively
# For each URL: open via WebFetch, inspect HTML
# B. Modify the adapter (or universal.ts) — guided by what you saw
# C. Re-test:
npx vitest run src/lib/scrapers/detail-extract/__tests__/adapters/<source>.test.ts
# D. Re-probe:
npm run probe:adapter -- --source <name> --sample 10
# E. Re-backfill JUST that source:
npm run backfill:detail -- --source <name> --retry-failed --verbose
# F. Re-measure:
npx tsx --env-file=.env.local src/scripts/inspect-missing-address.ts
# G. Commit fixes:
git add ... && git commit -m "fix(detail-extract): <source> adapter — <what was added>"
```

- [ ] **Step 19.6: Stop criterion**

Continue iterating until either:
- For each source in the top-10-by-`no_addr`, the address-coverage is ≥ 80% **OR** WebFetch confirms the source genuinely lacks street addresses on its detail pages (e.g., listings that only show "Online" or "Wien" — no street ever exists).
- For genuine-no-address sources, document in `docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md` §9 (Out-of-Scope) as known limitations.

- [ ] **Step 19.7: Final measurement**

```bash
npx tsx --env-file=.env.local src/scripts/inspect-missing-address.ts > /tmp/final.txt
```

Compare against baseline. Document the delta in the final commit message.

- [ ] **Step 19.8: Cleanup and final commit**

```bash
# Remove stale checkpoint
rm -f data/backfill-detail-checkpoint.json
git add -A
git commit -m "feat(detail-extract): adapter iteration round 1 — <X events enriched, dropped from Y% to Z%>"
```

---

## Self-Review (post-write)

After writing this plan I checked it against the spec:

- ✅ Spec §1 architecture → Tasks 2, 6 cover all modules.
- ✅ Spec §2 layered extraction → Task 5 implements all 4 universal layers, Task 7 adapter layer.
- ✅ Spec §3 source-based adapter lookup → Task 6 (registry).
- ✅ Spec §4 merge rules → Task 4 with full test coverage.
- ✅ Spec §5 HTML validity → Task 3 (validate.ts).
- ✅ Spec §6 address validity → Task 3.
- ✅ Spec §7 BaseScraper hook → Task 9 with per-host throttling.
- ✅ Spec §8 quality-flag soft-gate → Task 10.
- ✅ Spec §10 backfill CLI → Task 18.
- ✅ Spec §11 DB migration → Task 1.
- ✅ Spec §12 probe-adapter CLI → Task 11.
- ✅ Spec §13 backward-compat → Task 8.
- ✅ Spec §14 test strategy → tests in every task.
- ✅ Spec §15 acceptance criteria → covered by Task 19 measurement.

No placeholders found. Method names are consistent (`enrichFromDetail`, `enrichFromDetailHtml`, `mergeEnrichment`, `getAdapter`).

---

## Execution Notes

- **Order matters:** Tasks 1-9 are sequential (each builds on the previous). Tasks 12-16 (adapters) can be parallelized once Tasks 1-9 are done.
- **TDD discipline:** Every task that adds code starts with a failing test, then implementation, then green.
- **Frequent commits:** Each task ends with `git commit`. Do not batch commits across tasks.
- **Smoke before scale:** Task 19 is the live-fire test — run with `--limit 10 --dry-run` first to spot bugs cheaply.

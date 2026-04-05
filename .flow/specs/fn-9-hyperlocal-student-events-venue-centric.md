# Hyperlocal Student Events: Venue-Centric Registry Architecture

## Goal & Context

Transform the platform from a flat event-only model to a **venue-centric architecture** where physical locations (bars, pubs, clubs, Vereinslokale) and student organizations are first-class entities. Instead of manually curating 100+ scraper sources, use **registries** (OpenStreetMap, OeH listings, ESN sections, Open Data) to automatically generate venue candidates, then attach the best available event feed per venue (JSON-LD > ICS > RSS > HTML scraping).

**Why:** Current architecture has no venue table -- 108K events store location as free-text strings with no deduplication. Student events (pub quizzes, bar nights, semester openings) happen at small venues that institutional scrapers miss. The "talk about it" factor for students comes from hyperlocal bar/club events and student org activities, not from tourism portals.

**Scale target:** 5,000-15,000 venue candidates from OSM Austria alone, plus ~200 student org sources from OeH/ESN/IAESTE/AIESEC/AEGEE registries.

## Architecture Overview

```
Venue Registry (Supabase: venues table)
  OSM bars/pubs/clubs + Student Orgs + Open Data + Manual additions
       |
       | venue_id FK
       v
Events (existing table)
  + venue_id (nullable FK)
  + event_series_id (nullable FK)
  + content_fingerprint (dedupe)
       |
       v
Ingestion Pipeline (per-venue feed detection)
  1. Schema.org/JSON-LD extraction
  2. ICS/iCal feed parsing
  3. RSS feed parsing
  4. HTML scraping (BaseScraper)
  5. Open Data feeds (data.gv.at)
```

## Data Models

### venues (new Supabase table)

```sql
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  name_normalized text NOT NULL,
  type text NOT NULL,             -- bar/pub/nightclub/club/vereinslokal/university/student_org
  subtype text,                   -- e.g. karaoke_bar, fachschaft, esn_section

  -- Location
  address text,
  postal_code text,
  city text,
  bundesland text,
  latitude float8,
  longitude float8,

  -- Digital footprint
  website text,
  facebook_url text,
  instagram_url text,
  event_feed_url text,            -- ICS, RSS, or event page URL
  event_feed_type text,           -- ics | rss | json-ld | html | api | null

  -- Registry provenance
  osm_id bigint,                  -- OpenStreetMap node/way/relation ID
  osm_tags jsonb,                 -- raw OSM tags for enrichment
  registry_source text,           -- osm | open_data | oeh | esn | manual

  -- Metadata
  is_student_relevant boolean DEFAULT false,
  localness_score int DEFAULT 50, -- 0-100, higher = more hyperlocal
  last_scraped_at timestamptz,
  scrape_status text,             -- active | inactive | error | pending
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(osm_id),
  UNIQUE(name_normalized, city)
);
```

### event_series (new Supabase table)

```sql
CREATE TABLE event_series (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id uuid REFERENCES venues(id),
  title text NOT NULL,
  title_normalized text NOT NULL,
  recurrence_rule text,           -- iCal RRULE string
  category text,
  day_of_week int,                -- 0=Sun..6=Sat for weekly events
  start_time time,                -- typical start time
  created_at timestamptz DEFAULT now()
);
```

### events table changes

```sql
ALTER TABLE events ADD COLUMN venue_id uuid REFERENCES venues(id);
ALTER TABLE events ADD COLUMN event_series_id uuid REFERENCES event_series(id);
ALTER TABLE events ADD COLUMN content_fingerprint text;
CREATE INDEX idx_events_venue_id ON events(venue_id);
CREATE INDEX idx_events_content_fingerprint ON events(content_fingerprint);
CREATE INDEX idx_events_series_id ON events(event_series_id);
```

## Ingestion Pipeline Design

### Phase A: Registry Import (offline, batch)

1. **OSM Overpass query** for Austria: amenity in bar/pub/nightclub/biergarten + leisure=nightclub
   - Weekly batch via `npx tsx src/scripts/import-osm-venues.ts`
   - Extract: name, coords, address, website, opening_hours, OSM tags
   - Upsert into venues table keyed on osm_id
   - Expected yield: 5,000-15,000 venues

2. **Student org registry scrape**: OeH-Vertretungen list, ESN Austria sections, IAESTE committees, AIESEC offices, AEGEE sections
   - One-time scrape + periodic refresh
   - Each org -> venue entry (type=student_org, is_student_relevant=true)
   - Extract website + social links for feed detection
   - Expected yield: ~200 organizations

3. **Open Data feeds**: Linztermine (data.gv.at), Graz Kulturserver RSS, Touristische Infrastrukturdaten
   - Mapped to existing regional scrapers where possible
   - New venues registered from POI data

### Phase B: Feed Detection (per venue, automated)

For each venue with a website:
1. Fetch homepage, scan for `<link rel="alternate" type="text/calendar">` -> ICS feed
2. Scan for `<script type="application/ld+json">` with @type: Event -> JSON-LD
3. Scan for RSS/Atom `<link>` tags -> RSS feed
4. Store detected feed type + URL in venues.event_feed_url / event_feed_type

### Phase C: Universal Event Ingestion

New RegistryBasedScraper that iterates over venues with active feeds:
- **ICS connector**: node-ical async parsing, RRULE expansion (90-day window), DST-safe (luxon)
- **JSON-LD connector**: Cheerio extraction, @graph + @type array handling
- **RSS connector**: Existing RSS parsing pattern from niche scrapers
- **HTML connector**: Per-venue scraper config (CSS selectors stored in venue metadata)

### Phase D: Deduplication

Multi-stage pipeline:
1. **Fingerprint**: sha256(normalizeTitle(title) + startDate) -> content_fingerprint column
2. **DB constraint**: UNIQUE(content_fingerprint) prevents exact duplicates
3. **Fuzzy matching**: Within (date, city) blocks, Jaro-Winkler on titles (threshold 0.85 auto-merge)
4. **Series detection**: Recurring events with same title+venue+day_of_week -> event_series

### Phase E: Scoring Enhancement

Extend calculate-scores.ts:
- is_student_relevant venue bonus: +10
- Venue type bar/pub/nightclub: +5 (localness)
- Series event (recurring pub quiz, karaoke): +5 (habit-forming)
- Student org source: +10
- Existing scoring factors remain unchanged

## API Contracts

### GET /api/venues (new)

Query params: bbox, type, bundesland, student_only, has_events
Response: { venues: Venue[], cursor: string }

### GET /api/events (enhanced)

New query params: venue_id, student_only, localness_min
- venue_id filters to a specific venue
- student_only=true filters to events at student-relevant venues
- localness_min=70 filters to highly local events

### POST /api/admin/import-osm (new, admin-only)

Triggers OSM venue import batch job
Response: { imported: number, updated: number, skipped: number }

## Edge Cases & Constraints

1. **OSM data quality**: ~20% of venues lack a website URL. These become passive entries (no automatic event feed, but can still be manually linked or enriched via search).
2. **Feed detection false positives**: Some JSON-LD blocks are BreadcrumbList/Organization, not Event. Must filter by @type.
3. **ICS RRULE infinite expansion**: Always bound to 90-day window. node-ical + luxon handles DST.
4. **Dual-write constraint**: New venues table lives in Supabase only (no SQLite mirror needed -- venues are a production-only registry, not staging data).
5. **ODbL compliance**: OSM data used as Produced Work (display enrichment), not Derivative Database. Attribution required: "Data OpenStreetMap contributors, ODbL" in footer.
6. **Facebook/Meta API**: NOT used as open harvester. Only via opt-in venue onboarding (future phase). Social URLs stored for manual reference only.
7. **Eventbrite/Songkick/DICE**: Not included as primary sources due to API restrictions. Can be added as ticket_url enrichment if venue is onboarded.
8. **108K existing events backfill**: venue_id assignment via fuzzy matching on location_name against venues.name_normalized. Conservative: only assign when confidence > 0.9.

## Acceptance Criteria

- [ ] venues table created in Supabase with proper RLS (public read, admin write)
- [ ] event_series table created with RLS
- [ ] events table extended with venue_id, event_series_id, content_fingerprint
- [ ] OSM import script fetches Austrian bars/pubs/nightclubs via Overpass, upserts 5K+ venues
- [ ] Student org registry scraper imports OeH/ESN/IAESTE/AIESEC sections as venue entries (~200)
- [ ] Feed detection script scans venue websites for ICS/JSON-LD/RSS feeds
- [ ] ICS connector parses calendar feeds with RRULE support (node-ical + luxon)
- [ ] JSON-LD connector extracts Schema.org Events from venue websites
- [ ] Content fingerprint deduplication prevents duplicate events across sources
- [ ] Fuzzy dedup (Jaro-Winkler) merges near-duplicates within (date, city) blocks
- [ ] Recurring event detection creates event_series entries
- [ ] Scoring algorithm enhanced with student_relevant + localness bonuses
- [ ] Existing 108K events backfilled with venue_id where match confidence > 0.9
- [ ] /api/venues endpoint with bbox, type, student_only filters
- [ ] /api/events enhanced with venue_id, student_only, localness_min filters
- [ ] OSM attribution displayed in application footer (ODbL compliance)
- [ ] All new code has Vitest tests, existing 127 tests still pass

## Boundaries (Out of Scope)

- Facebook/Instagram API integration (requires separate opt-in onboarding system)
- Eventbrite/Songkick/DICE API integration (licensing constraints)
- Google Business Profile integration (requires per-venue account linking)
- User-generated event submission UI (separate epic)
- Venue onboarding portal for businesses (separate epic)
- Mobile push notifications for nearby events (separate epic)
- Real-time event updates / WebSocket feeds (separate epic)

## Decision Context

**Why venue-centric over event-centric expansion?**
Adding 100 more event scrapers yields diminishing returns -- each new scraper requires manual maintenance. A venue registry (OSM + student orgs) generates thousands of sources automatically, and feed detection means many venues self-serve their event data via ICS/JSON-LD without custom scraper code.

**Why OSM over Google Places?**
OSM is free, bulk-queryable, and ODbL-licensed. Google Places API has per-query costs, rate limits, and ToS restrictions on caching/storing data.

**Why not Facebook as primary source?**
Meta Graph API restricts event access to page admins and marketing partners since 2018. An open "harvest all Austrian events" strategy is not technically feasible. Social becomes viable only through opt-in venue onboarding (future phase).

**Why Supabase-only for venues (no SQLite)?**
Venues are a production registry, not staging/scraping data. The dual-write pattern is only needed for the scrape-to-sync pipeline. Venue management is a direct Supabase operation.

# CHANGELOG - Osterreich Events Platform

## Architecture Overview

### Platform Summary
Osterreich Events is an Austrian event discovery platform built with **Next.js 16** (App Router), **React 19**, **TypeScript**, and **Supabase**. It aggregates events from 44 scrapers across Austria, displays them on an interactive **Mapbox GL JS** map, and provides social features including direct messaging, group event planning, friend system, feed, and memories.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Map | Mapbox GL JS (`mapbox-gl` v3.20) |
| Styling | Tailwind CSS v4 |
| Database (production) | Supabase PostgreSQL (22 tables) |
| Database (staging) | SQLite via `better-sqlite3` (scraper output) |
| Auth | Supabase Auth (Google OAuth + Email/Password) |
| Realtime | Supabase Channels (postgres_changes) |
| Scraping | Cheerio (SSR), Puppeteer-core (SPA/tickets) |
| Geocoding | Nominatim (OpenStreetMap) + local cache |
| Analytics | Custom analytics via Supabase `analytics_events` table |

### Dual-Database Architecture
```
Scrapers (44)
    |
    v
SQLite (data/events.db) -- staging, local scrape runs
    |  tables: events, scrape_runs, geocode_cache
    |
    v  (manual sync / migration)
Supabase PostgreSQL -- production, serves API
    |  22 tables (see below)
    |
    v
Next.js API Routes (/api/events)
    |
    v
Frontend (Mapbox map + event cards + social features)
```

Scrapers write to SQLite via `src/lib/db/queries.ts` (`upsertEvent`). Events are then migrated to Supabase for production use. The API routes (`/api/events`) query Supabase directly using the service role key.

---

## Supabase Tables (18 confirmed in codebase, 22 per project estimate)

### Core Event Tables
| Table | Purpose |
|-------|---------|
| `events` | All events (scraped + user-created + business). Fields: id, source_type, source_name, source_id, source_url, title, description, category, tags[], start_date, end_date, location_name, address, postal_code, district, bundesland, latitude, longitude, image_url, images[], price_text, price_min, price_max, ticket_url, visibility, organizer, view_count, save_count, share_count |
| `saved_events` | User bookmarks. Fields: user_id, event_id, remind_at, reminded, notes |
| `event_reminders` | Reminder scheduling for saved events |

### User & Auth Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends Supabase auth.users). Fields: first_name, last_name, birth_date, phone, avatar_url, address, city, bio, role (user/business/admin/god), spotify_connected, facebook_connected, preferred_bundesland, preferred_categories[], notification_enabled, agb_accepted_at, newsletter_opt_in |
| `friendships` | Friend relationships. Fields: requester_id, addressee_id, status (pending/accepted) |

### Social & Chat Tables
| Table | Purpose |
|-------|---------|
| `direct_messages` | DM conversations. Fields: sender_id, receiver_id, content, message_type (text/event_share), event_id, read |
| `groups` | Event planning groups. Fields: name, description, image_url, created_by, is_public, invite_code, event_type, linked_event_id, location_name/address/lat/lng, event_date, notes, visibility |
| `group_members` | Group membership. Fields: group_id, user_id, role (admin/member), rsvp (going/maybe/not_going), rsvp_at |
| `group_messages` | Group chat. Fields: group_id, user_id, content, message_type, event_id, image_url |
| `group_contributions` | Shared costs/items for group events |
| `notifications` | Push/in-app notifications. Fields: user_id, type, title, body, event_id, group_id, from_user_id, action_url, read |

### Feed & Activity Tables
| Table | Purpose |
|-------|---------|
| `activities` | Activity feed entries. Types: post, event_save, event_share, rsvp, etc. |

### Memory Tables
| Table | Purpose |
|-------|---------|
| `memories` | Event memory albums. Fields: title, description, created_by, event_id |
| `memory_photos` | Photos within a memory album |
| `memory_participants` | Users tagged in a memory |

### Calendar Tables
| Table | Purpose |
|-------|---------|
| `calendar_shares` | Calendar sharing between friends |

### Analytics Tables
| Table | Purpose |
|-------|---------|
| `analytics_events` | Event tracking. Fields: user_id, session_id, event_type, event_data (JSONB), page, referrer, user_agent, ip_hash |

### Integration Tables
| Table | Purpose |
|-------|---------|
| `spotify_artist_matches` | Spotify artist-to-event matches for music recommendations |

### Additional Tables (in Supabase but not directly queried from frontend)
The project mentions 22 tables total. The remaining ~4 tables likely include Supabase system tables (auth.users, storage.buckets, storage.objects) and potentially migration/RLS support tables.

---

## Scrapers (44 registered)

All scrapers extend `BaseScraper` (`src/lib/scrapers/BaseScraper.ts`) which provides:
- `fetchPage(url)` with retry logic (3 attempts, exponential backoff)
- `rateLimit()` with configurable delay (default 1000ms)
- `cleanImageUrl()` for filtering placeholder/broken images
- `extractImageUrl()` stub (not yet implemented in base class)
- Custom User-Agent: `BurgenlandEvents-Scraper/1.0 (educational project)`

### Burgenland (5 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| BurgenlandInfoScraper | `burgenland.info` | burgenland.info | Cheerio + JSON-LD (@graph) |
| LandesregierungScraper | `burgenland.at` | burgenland.at | Cheerio (article.event) |
| EsterházyScraper | `esterhazy.at` | esterhazy.at | Cheerio |
| OhoScraper | `oho.at` | oho.at (Oberwart) | Cheerio |
| NeusiedlerseeScraper | `neusiedlersee.com` | neusiedlersee.com | Cheerio |

### Wien (10 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| WienGvScraper | `wien-gv` | wien.gv.at | Cheerio |
| WienVADBScraper | `wien-vadb` | Wien VADB (event database) | Cheerio |
| FalterScraper | `falter` | falter.at | Cheerio |
| WienInfoScraper | `wien.info` | wien.info | Cheerio |
| StadthalleScraper | `stadthalle` | stadthalle.com | Cheerio |
| PraterWienScraper | `praterwien` | praterwien.com | Cheerio |
| PartytimerScraper | `partytimer` | partytimer.at | Cheerio |
| WienClubsScraper | `wien-clubs` | Multiple club websites (Grelle Forelle, Flex, Pratersauna, etc.) | Cheerio |
| BasiskulturScraper | `basiskultur` | basiskultur.at | Cheerio |
| GanzWienScraper | `ganz-wien` | ganz-wien.at | Cheerio |

### Niederosterreich (1 scraper)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| DonauNOEScraper | `donau-noe` | donau.com (NOE region) | Cheerio |

### Oberosterreich (2 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| LinzTermineScraper | `linztermine` | linztermine.at | Cheerio |
| PosthofScraper | `posthof` | posthof.at (Linz venue) | Cheerio |

### Steiermark (5 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| GrazTourismusScraper | `graztourismus` | graztourismus.info | Cheerio |
| PopcultureScraper | `popculture` | popculture.at | Cheerio |
| KulturGrazScraper | `kultur-graz` | kultur.graz.at | Cheerio |
| MariazellAtScraper | `mariazell.at` | mariazell.at | Cheerio |
| BasilikaMariazellScraper | `basilika-mariazell` | basilika-mariazell.at | Cheerio |
| MariazellGvScraper | `mariazell.gv.at` | mariazell.gv.at (municipality) | Cheerio |

### Salzburg (4 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| RockhouseScraper | `rockhouse` | rockhouse.at | Cheerio |
| ARGEkulturScraper | `argekultur` | argekultur.at | Cheerio |
| SzeneSalzburgScraper | `szene-salzburg` | szene-salzburg.at | Cheerio |
| GasteinScraper | `gastein` | gastein.com | Cheerio |

### Karnten (1 scraper)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| KaerntenLiveScraper | `kaernten.live` | kaernten.live | Cheerio |

### Tirol (2 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| TirolScraper | `tirol.at` | tirol.at | Cheerio |
| EventsTTScraper | `events.tt` | events.tt (Tiroler Tageszeitung) | Cheerio |

### Vorarlberg (2 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| BodenseeVorarlbergScraper | `bodensee-vorarlberg` | bodensee-vorarlberg.com | Cheerio |
| VorarlbergTravelScraper | `vorarlberg.travel` | vorarlberg.travel | Cheerio |

### Multi-Region / Austria-wide (9 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| TourismusPortaleScraper | `tourismus-portale` | Multiple tourism portal APIs | Cheerio |
| FeratelScraper | `feratel-deskline` | Feratel Deskline TOSC5 API (55+ regions) | REST API |
| VeranstaltungskalenderNetScraper | `veranstaltungskalender.net` | veranstaltungskalender.net | Cheerio |
| EventsAtScraper | `events.at` | events.at | Cheerio |
| FeverUpScraper | `feverup` | feverup.com/wien | Cheerio |
| MeinBezirkScraper | `meinbezirk` | meinbezirk.at (all regions) | Cheerio |
| OeticketScraper | `oeticket` | oeticket.com | Puppeteer |
| TicketmasterScraper | `ticketmaster` | ticketmaster.at API | REST API |

### Municipality Scrapers (3 scrapers)
| Scraper | Name | Source | Method |
|---------|------|--------|--------|
| GemeindeListScraper | `gemeinden` | Pre-curated municipality websites | Cheerio |
| Gem2GoScraper | `gem2go` | GEM2GO CMS (~2000 municipalities) | Cheerio |
| GenericGemeindeScraper | `gemeinden-generic` | Non-GEM2GO municipality pages | Cheerio |

**Total: 44 scraper instances** (some files export multiple classes, e.g., MariazellScraper.ts exports 3, SalzburgScrapers.ts exports 3)

---

## API Routes

### `GET /api/events`
Main events endpoint. Queries Supabase directly.
- **Auth**: None (public)
- **Client**: Uses `SUPABASE_SERVICE_ROLE_KEY` (falls back to anon key)
- **Params**: bundesland, district, category, dateFrom, dateTo, priceMin, priceMax, search, eveningOnly, limit, offset
- **Default behavior**: Only returns future/current public events, ordered by start_date ASC
- **Limit**: Default 50,000 (requires Supabase dashboard Max Rows setting)
- **Search sanitization**: Strips PostgREST special characters `[,.*()]`
- **Known issue**: Evening filter applied client-side after fetch (not at DB level)

### `GET /api/events/[id]`
Single event detail.
- **Auth**: None (public)
- **Client**: Uses service role key
- **Returns**: Full event object with all fields

### `POST /api/scrape`
Trigger scraping.
- **Auth**: Optional API key via `x-api-key` header (checked against `SCRAPE_API_KEY` env var)
- **Body**: `{ source?: string }` - specific scraper name, or omit for all
- **Known issue**: Auth is optional (no key = access granted if SCRAPE_API_KEY not set)

### `POST /api/analytics`
Client-side analytics event ingestion.
- **Auth**: Optional (user_id captured if authenticated)
- **Rate limiting**: 100 events per session per minute (in-memory)
- **Privacy**: IP hashed with SHA-256 + salt, only first 16 chars stored
- **Body**: `{ type, data, page, referrer, sessionId }`
- **Event types tracked**: page_view, event_click, event_save, search, filter_change, nachtleben_toggle, bundesland_switch, link_click

### `GET /api/admin/analytics`
Admin analytics dashboard data.
- **Auth**: Required (admin or god role)
- **Params**: period (today/7d/30d/all)
- **Returns**: overview stats, viewsByDay, topEvents, topSearches, behavior metrics, linkClicks, funnel data, bundeslandHeatmap

### `GET /api/admin/scrapers`
List all scrapers with status and event counts.
- **Auth**: None (no explicit auth check - security issue)
- **Returns**: Array of scraper objects with name, displayName, category, eventCount, lastRun, status, progress

### `POST /api/admin/scrapers`
Scraper management actions.
- **Auth**: None (no explicit auth check - security issue)
- **Actions**: start (single scraper), stop, start-all, validate, post-process, start-github, github-status

### `GET /api/admin/scrapers/[name]/progress`
Real-time scraper progress polling.
- **Auth**: None
- **Returns**: Progress JSON from file-based status tracking

---

## Auth System

### Providers
- **Google OAuth**: Via Supabase Auth, redirects to `/auth/callback`
- **Apple OAuth**: Configured in AuthProvider but may not be active in Supabase dashboard
- **Email/Password**: Standard Supabase auth with email confirmation

### Role System
Four roles in `profiles.role`:
| Role | Access |
|------|--------|
| `user` | Standard user, all social features |
| `business` | Business profile (structure exists, flow incomplete) |
| `admin` | Admin panel access, analytics, user management |
| `god` | Full access, all admin features, role assignment |

### Profile Completeness
`isProfileComplete()` checks: first_name, last_name, birth_date must be non-empty. Incomplete profiles are redirected to `/auth/complete-profile`.

### Auth Flow
1. User signs in (Google OAuth or Email)
2. Callback at `/auth/callback` exchanges code for session
3. If profile missing required fields -> redirect to `/auth/complete-profile`
4. Profile fetched non-blocking (loading = false immediately after session)
5. Role-based helpers: `isGod`, `isAdmin`, `isBusiness` on auth context

### Client Architecture
- **Browser client**: `@supabase/ssr` `createBrowserClient` (singleton, cached)
- **Server client**: `createServerSupabaseClient()` for API routes
- **Service role**: Used in `/api/events` and `/api/events/[id]` for bypassing RLS

---

## Chat System

### Direct Messages (`direct_messages` table)
- **Thread model**: sender_id + receiver_id pairs, queried with OR condition
- **Message types**: `text`, `event_share`
- **Event sharing**: event_id stored on message, renders `EventPreviewCard`
- **Read receipts**: `read` boolean, marked on opening conversation
- **Realtime**: Supabase postgres_changes subscription per conversation channel
- **Limit**: 200 messages per conversation fetch

### Group Messages (`group_messages` table)
- **Thread model**: Messages belong to a group_id
- **Message types**: `text`, `event_share`, `system` (RSVP changes, invites)
- **Profiles joined**: Messages fetched with profile data (first_name, last_name, avatar_url)
- **Realtime**: Supabase channel subscription per group
- **Features**: RSVP system (going/maybe/not_going), contributions, notes, activity log

### Unread Count
- Header and SocialNav components poll `direct_messages` for unread count
- Filter: `receiver_id = user.id AND read = false`

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page (unauthenticated) or Map view (authenticated) |
| `/map` | Full-screen Mapbox GL JS map with event markers |
| `/calendar` | Personal calendar with saved events, friend sharing |
| `/feed` | Social feed with posts, trending events |
| `/friends` | Friend management (search, requests, accept) |
| `/messages` | DM inbox list |
| `/messages/[userId]` | DM conversation thread |
| `/groups` | Event planning groups list + create |
| `/groups/[id]` | Group dashboard (chat, RSVP, memories, contributions) |
| `/memories` | Memory albums list + create |
| `/memories/[id]` | Memory detail with photos |
| `/saved` | Saved/bookmarked events |
| `/profile` | User profile settings |
| `/events/create` | Create user event |
| `/spotify-matches` | Spotify artist-event matches |
| `/admin` | Admin panel (6 tabs: overview, users, events, stats, scrapers, moderation) |
| `/auth/login` | Login page |
| `/auth/register` | Registration page |
| `/auth/callback` | OAuth callback handler |
| `/auth/complete-profile` | Profile completion for new users |
| `/impressum` | Legal: Impressum |
| `/datenschutz` | Legal: Privacy Policy |
| `/agb` | Legal: Terms of Service |

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| EventMap | `src/components/Map/EventMap.tsx` | Mapbox GL JS map with clustering, bundesland overlay |
| EventCard | `src/components/Events/EventCard.tsx` | Event card in sidebar/lists |
| EventDetail | `src/components/Events/EventDetail.tsx` | Full event detail modal/page |
| EventPreviewCard | `src/components/Events/EventPreviewCard.tsx` | Compact event preview (used in chat shares) |
| FilterBar | `src/components/Filters/FilterBar.tsx` | Category, bundesland, date, price filters |
| Header | `src/components/Layout/Header.tsx` | Top navigation with unread badge |
| SocialNav | `src/components/Layout/SocialNav.tsx` | Social features sidebar navigation |
| HeroSection | `src/components/Landing/HeroSection.tsx` | Landing page hero with curtain animation |
| LandingAuth | `src/components/Landing/LandingAuth.tsx` | Landing page auth buttons |
| SidebarFeed | `src/components/Feed/SidebarFeed.tsx` | Feed sidebar with friend activities |
| AnalyticsPanel | `src/components/Admin/AnalyticsPanel.tsx` | Admin analytics dashboard |
| LocationBanner | `src/components/Map/LocationBanner.tsx` | Geolocation permission banner |
| LocationAutocomplete | `src/components/UI/LocationAutocomplete.tsx` | Location search autocomplete |

---

## SQLite Schema (Staging DB)

Three tables in `data/events.db`:

### `events`
Mirrors Supabase events structure for staging. Key differences:
- `id` is INTEGER AUTOINCREMENT (not UUID)
- `tags` stored as JSON string
- `UNIQUE(source_name, source_id)` constraint for deduplication
- Cross-source deduplication: skips if same source_id from ANY source

### `scrape_runs`
Tracks individual scraper executions: source_name, started_at, finished_at, status, events_found/new/updated, error_message.

### `geocode_cache`
Nominatim geocoding cache: query -> latitude, longitude.

---

## Known Issues

### Critical
1. **`ignoreBuildErrors: true`** in `next.config.ts` - TypeScript errors are suppressed at build time
2. **Service role key in API routes** - `/api/events` uses `SUPABASE_SERVICE_ROLE_KEY` directly, bypassing RLS
3. **Admin scraper routes have no auth** - `/api/admin/scrapers` GET and POST have no authentication check
4. **Scrape API auth is optional** - If `SCRAPE_API_KEY` env var is not set, `/api/scrape` is open

### Data Quality
5. **41% of events have no image** - Category fallback images not implemented
6. **MeinBezirk events lack descriptions** - 100% of ~3842 events have no description (scraper only fetches list view)
7. **Feratel coordinates are approximate** - ~2800 events have region-center coords instead of actual venue coordinates
8. **~93 events have no coordinates** - Unknown locations not geocoded

### Architecture
9. **Leaflet still in dependencies** - `leaflet`, `react-leaflet`, `react-leaflet-cluster`, `@types/leaflet` in package.json despite migration to Mapbox GL JS
10. **Dual-DB sync is manual** - No automated pipeline from SQLite staging to Supabase production
11. **BaseScraper.extractImageUrl() is a stub** - Returns undefined, each scraper implements its own image extraction
12. **Social features spinner** - Friends/Messages/Groups show endless spinner when Supabase RLS blocks queries

### UI/UX
13. **Cookie banner needs polish** - Functional but visually basic
14. **Bezirk filter behavior** - Map should show all events when filtering by Bezirk, only sidebar should filter
15. **Profile image fallback** - Avatar sometimes shows broken image instead of initials

### Incomplete Features
16. **Business profiles** - Basic structure exists but flow not complete
17. **Spotify integration** - OAuth flow built but needs developer credentials
18. **Event planner UI** - "Eigenes Event" form may not work (RLS on groups INSERT)
19. **University scrapers** - Not yet implemented (research in `data/uni-event-sources.json`)

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS access token |
| `SCRAPE_API_KEY` | Optional API key for /api/scrape endpoint |
| `GITHUB_TOKEN` | GitHub API token for Actions workflow triggers |
| `GITHUB_REPO` | GitHub repo path (default: panaemonium141099/oesterreich-events) |

---

## Build & Run Commands

```bash
npm run dev              # Development server
npm run build            # Production build (TS errors suppressed)
npm run scrape           # Run all scrapers (writes to SQLite)
npm run scrape:burgenland # Single scraper
npm run scrape:all       # All scrapers + feratel + validate
npm run validate         # Validate event data quality
npm run post-process     # Geocoding + Bundesland assignment
npm run assign-districts # Assign districts to events
npm run geocode          # Run geocoding for events without coordinates
```

---

## File Structure

```
src/
  app/
    page.tsx                    # Landing/Map main page
    layout.tsx                  # Root layout with AuthProvider
    globals.css                 # Global styles (Tailwind v4)
    admin/page.tsx              # Admin panel (6 tabs)
    auth/
      login/page.tsx            # Login
      register/page.tsx         # Registration
      callback/route.ts         # OAuth callback
      complete-profile/page.tsx # Profile completion
    calendar/page.tsx           # Personal calendar
    events/create/page.tsx      # Create event form
    feed/page.tsx               # Social feed
    friends/page.tsx            # Friend management
    groups/
      page.tsx                  # Groups list + create
      [id]/page.tsx             # Group dashboard
    map/page.tsx                # Full map view
    memories/
      page.tsx                  # Memories list
      [id]/page.tsx             # Memory detail
    messages/
      page.tsx                  # DM inbox
      [userId]/page.tsx         # DM thread
    profile/page.tsx            # User profile
    saved/page.tsx              # Saved events
    spotify-matches/page.tsx    # Spotify matches
    api/
      events/
        route.ts                # Events list API
        [id]/route.ts           # Event detail API
      scrape/route.ts           # Scrape trigger API
      analytics/route.ts        # Analytics ingestion
      admin/
        analytics/route.ts      # Admin analytics
        scrapers/
          route.ts              # Scraper management
          [name]/progress/route.ts  # Scraper progress
    impressum/page.tsx          # Legal pages
    datenschutz/page.tsx
    agb/page.tsx
  components/
    Admin/AnalyticsPanel.tsx
    Events/
      EventCard.tsx
      EventDetail.tsx
      EventPreviewCard.tsx
    Feed/
      SidebarFeed.tsx
      CreatePost.tsx
      FeedItem.tsx
      TrendingRow.tsx
      FeedSkeleton.tsx
    Filters/FilterBar.tsx
    Landing/
      HeroSection.tsx
      LandingAuth.tsx
      LandingStats.tsx
    Layout/
      Header.tsx
      SocialNav.tsx
    Legal/                      # Legal page components
    Map/
      EventMap.tsx
      LocationBanner.tsx
    UI/
      Icons.tsx
      LocationAutocomplete.tsx
  lib/
    analytics.ts                # Client-side analytics tracking
    austriaGemeinden.ts         # Municipality data
    bundeslaender.ts            # Bundesland boundaries/data
    categories.ts               # Category definitions
    categoryImages.ts           # Category fallback images
    districts.ts                # Burgenland districts
    districtsAT.ts              # All Austrian districts
    geocoding.ts                # Nominatim geocoding
    geolocation.ts              # Browser geolocation API
    plzCoordinates.ts           # Postal code coordinates
    spotify.ts                  # Spotify API helpers
    calendar/                   # Calendar utilities
    db/
      connection.ts             # SQLite connection (WAL mode)
      schema.ts                 # SQLite schema (events, scrape_runs, geocode_cache)
      queries.ts                # SQLite queries (getEvents, upsertEvent, recordScrapeRun)
    scrapers/
      BaseScraper.ts            # Abstract base class
      index.ts                  # 44-scraper registry + runAllScrapers
      puppeteerBrowser.ts       # Shared Puppeteer browser instance
      [40 scraper files]        # Individual scraper implementations
      gemeinden/                # Municipality scraper data
    supabase/
      client.ts                 # Browser Supabase client (singleton)
      server.ts                 # Server-side Supabase client
      auth-context.tsx          # AuthProvider + useAuth hook
  types/
    database.ts                 # Supabase generated types (partial - 5 tables)
    events.ts                   # Event, ScrapedEvent, EventFilters, Category, District types
  scripts/
    scrape.ts                   # CLI scraper runner
    validate-events.js          # Event data validator
    post-process.ts             # Geocoding + Bundesland post-processing
    assign-districts.ts         # District assignment script
    geocode.ts                  # Bulk geocoding script
data/
  events.db                     # SQLite staging database (gitignored)
  uni-event-sources.json        # University event source URLs (40+ institutions)
  AUDIT-EVENT-PLANNER.md        # Event planner feature audit
```

---

## Categories (13)
Musik, Nightlife, Wein & Kulinarik, Kultur, Markte, Sport, Familie, Natur, Feste & Brauchtum, Bildung, Gesundheit, Religion, Sonstiges

## Districts (Burgenland-specific, 7)
Neusiedl am See, Eisenstadt, Mattersburg, Oberpullendorf, Oberwart, Gussing, Jennersdorf

---

*Last updated: 2026-03-31*

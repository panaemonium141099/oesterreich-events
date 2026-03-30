# Comprehensive Audit Report

**Date:** 2026-03-30
**Project:** burgenland-events-v5 (Österreich Events)

---

## Audit 1: Cybersecurity

### 🔴 CRITICAL — Hardcoded Ticketmaster API Key

**File:** `src/lib/scrapers/TicketmasterScraper.ts` (line 74)

The Ticketmaster API key is hardcoded as a fallback value:
```
private readonly API_KEY = process.env.TICKETMASTER_API_KEY || '9Hr32Ry5UAYl0rnPAn4hAAahDurOGbJr';
```

**Fix:** Remove the hardcoded fallback. Use only `process.env.TICKETMASTER_API_KEY` and fail gracefully if not set.

---

### 🔴 CRITICAL — Overly Permissive RLS Policies

Supabase security advisor flagged two **always-true** RLS INSERT policies:

1. **`public.events`** — Policy `Anyone can insert scraped events` uses `WITH CHECK (true)`, meaning any anonymous user can insert events.
2. **`public.notifications`** — Policy `Anyone can insert notifications` uses `WITH CHECK (true)`, meaning any user can create notifications for any other user.

**Fix:** Restrict these policies. For events, limit INSERT to `service_role` or authenticated users with business role. For notifications, restrict to the system or the user's own notifications.

---

### 🔴 CRITICAL — Leaked Password Protection Disabled

Supabase Auth's leaked password protection (HaveIBeenPwned check) is disabled.

**Fix:** Enable it in Supabase Dashboard under Auth > Password Security settings.

---

### 🟡 IMPORTANT — Search Parameter Not Sanitized (Potential Injection)

**File:** `src/app/api/events/route.ts` (line 84)

The search parameter is interpolated directly into a Supabase `.or()` filter string:
```
query.or(`title.ilike.%${filters.search}%,...`)
```

While Supabase client libraries parameterize queries internally, special PostgREST characters (e.g., `,`, `.`, `(`, `)`) in the search string could manipulate the filter logic.

**Fix:** Sanitize the search input by escaping or stripping PostgREST special characters before interpolation, or use `.textSearch()` / `.ilike()` on individual columns.

---

### 🟡 IMPORTANT — Service Role Key Fallback Pattern

**Files:**
- `src/app/api/events/route.ts` (line 7)
- `src/app/api/events/[id]/route.ts` (line 6)
- `src/components/Landing/LandingStats.tsx` (line 5)

Pattern: `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`

If the service role key is not set, these server-side routes fall back to the anon key. This could silently bypass expected server-side privileges, or worse, if the service role key were accidentally exposed client-side.

**Fix:** Use explicit server-only Supabase client creation. Fail loudly if the service role key is missing in API routes.

---

### 🟡 IMPORTANT — `.gitignore` Does Not Cover Bare `.env` File

The `.gitignore` only ignores `.env*.local`. A bare `.env` file would be tracked by git.

**Fix:** Add `.env` to `.gitignore`.

---

### 🟡 IMPORTANT — No Rate Limiting on API Routes

None of the API routes (`/api/events`, `/api/events/[id]`, `/api/scrape`) implement rate limiting.

**Fix:** Add rate limiting middleware (e.g., `next-rate-limit`, Vercel edge rate limits, or a custom token bucket per IP).

---

### 🟡 IMPORTANT — No CORS Configuration

No explicit CORS headers are set on API routes. Next.js API routes allow same-origin by default, but if the API is consumed cross-origin, this could be an issue — or conversely, lack of restrictive CORS could allow unwanted cross-origin access.

**Fix:** Add explicit CORS headers to API routes if cross-origin access is needed, or verify same-origin is sufficient.

---

### 🟢 NICE TO HAVE — No XSS via dangerouslySetInnerHTML

No usage of `dangerouslySetInnerHTML` or `innerHTML` found in the codebase. Good.

### 🟢 NICE TO HAVE — Auth Tokens

Supabase handles auth tokens via httpOnly cookies through `@supabase/ssr` middleware. No sensitive tokens in localStorage. Only non-sensitive UI state (`onboarding_complete`, `calendar_custom_filters`) is stored in localStorage.

---

## Audit 2: UX/Usability

### 🔴 CRITICAL — No Error Boundaries

**Issue:** No `error.tsx` files exist anywhere in the app. If any page throws a runtime error, users see the default Next.js error page with no way to recover.

**Fix:** Add `error.tsx` at the app root and at key route segments (`/map`, `/calendar`, `/profile`, etc.) with user-friendly error messages and retry buttons.

---

### 🔴 CRITICAL — No Loading States (Route-Level)

**Issue:** No `loading.tsx` files exist. When navigating between routes, there is no visual feedback during data loading (especially for pages like `/calendar`, `/saved`, `/friends` that fetch data).

**Fix:** Add `loading.tsx` with skeleton/spinner components at the app root and key route segments.

---

### 🟡 IMPORTANT — No 404 Page

**Issue:** No `not-found.tsx` exists. Visiting an invalid URL shows the default Next.js 404 page.

**Fix:** Add a custom `not-found.tsx` at the app root with navigation back to the map.

---

### 🟡 IMPORTANT — Profile Page Shows Phone as Required (Label Mismatch)

**Issue:** The profile page previously showed `Telefonnummer *` but phone is optional per the registration flow. (Fixed in this session.)

**Status:** Resolved.

---

### 🟡 IMPORTANT — Missing Accessibility (ARIA)

**Issue:** Only 6 out of 30 components use any `aria-*` attributes or `role` attributes. Key interactive components like `EventCard`, `FilterBar`, `Sidebar`, `EventList` lack ARIA labels.

**Fix:** Add `aria-label`, `role`, `aria-expanded`, `aria-haspopup` to interactive elements. Ensure keyboard navigation works for all filters, cards, and modals.

---

### 🟡 IMPORTANT — 16+ `<img>` Tags Instead of `next/image`

**Issue:** 16 files use raw `<img>` tags. While 5 components do import `next/image`, most user-facing images (avatars, event images in feeds, groups, messages, calendar) use unoptimized `<img>` tags.

**Fix:** Replace `<img>` with `next/image` for automatic lazy loading, responsive sizing, and WebP conversion.

---

### 🟢 NICE TO HAVE — Map Loading State Exists

The map page has a `MapLoadingOverlay` component and proper loading state management. Good.

---

## Audit 3: Code Quality

### 🟡 IMPORTANT — Console Statements in Production Code

**Issue:** Found `console.log`, `console.warn`, and `console.error` calls across production code:

- `src/app/api/events/route.ts` — `console.error` (acceptable for server-side logging)
- `src/app/map/page.tsx` — `console.error`
- `src/app/calendar/page.tsx` — `console.warn`
- `src/components/Events/EventDetail.tsx` — `console.warn` (x2)
- `src/components/Landing/HeroSection.tsx` — `console.error`
- `src/lib/supabase/auth-context.tsx` — `console.warn` (x2)
- Multiple scraper files — `console.log` (acceptable for CLI scripts)

**Fix:** Replace client-side `console.log/warn/error` with a proper logging utility that can be silenced in production builds, or remove them. Server-side logging is acceptable.

---

### 🟡 IMPORTANT — All Pages Are Client Components

**Issue:** All 19+ page files use `'use client'`. This means no Server-Side Rendering (SSR) or Static Site Generation (SSG) benefits. The landing page (`/`) and event detail pages are prime candidates for server components.

**Fix:** Convert the landing page, static pages, and read-only pages to server components where possible. Use client components only for interactive parts.

---

### 🟡 IMPORTANT — `LandingStats` Creates Supabase Client at Module Level

**File:** `src/components/Landing/LandingStats.tsx`

A Supabase client with the service role key is created at module scope (line 3-6). This client persists across requests in serverless environments and could lead to stale connections.

**Fix:** Create the client inside the function body.

---

### 🟢 NICE TO HAVE — TypeScript Strict Mode

The project uses TypeScript with `@types/react` v19. A build test would confirm no type errors. (No `npx next build` was run during this audit.)

---

### 🟢 NICE TO HAVE — No Dead Code Detected

No obviously unused components or significant dead code patterns found.

---

## Audit 4: Data Quality

### 🟡 IMPORTANT — 50 Duplicate Event Groups

**Issue:** 50 groups of events share the same `title + start_date` combination, indicating duplicate events from different scrapers.

**Fix:** Run the `validate-events.js` script more frequently, or add a deduplication step to the scraping pipeline. Consider a unique constraint on `(title, start_date, location_name)`.

---

### 🟡 IMPORTANT — 3,254 Past Events Still in Database

**Issue:** 3,254 events have `start_date` before today. While the API filters these out, they consume storage and slow queries.

**Fix:** Add a periodic cleanup job to archive or delete events older than 30 days.

---

### 🟡 IMPORTANT — 1 Event Missing Coordinates

**Issue:** 1 event has NULL latitude/longitude. While nearly all 42,370 events have coordinates, this event won't appear on the map.

**Fix:** Run the geocoding script (`npm run geocode`) or manually assign coordinates.

---

### 🟢 NICE TO HAVE — No Orphaned Records

Saved events all point to valid events. No orphaned records found.

### 🟢 NICE TO HAVE — All Events Have Titles and Start Dates

0 events with missing title, 0 with missing start_date, 0 with missing bundesland.

---

## Audit 5: Scalability / Architecture

### 🔴 CRITICAL — 20 Unindexed Foreign Keys

**Issue:** 20 foreign key columns across tables lack covering indexes:

| Table | Foreign Key Column |
|---|---|
| events | business_id |
| groups | created_by |
| group_messages | event_id, user_id |
| group_events | shared_by |
| memories | created_by, event_id, group_id |
| memory_photos | memory_id, uploaded_by |
| notifications | event_id, from_user_id, group_id |
| activities | event_id, group_id, memory_id, target_user_id |
| direct_messages | event_id, sender_id |
| event_invites | invited_by |

This causes slow JOIN operations and CASCADE deletes.

**Fix:** Add indexes on all foreign key columns:
```sql
CREATE INDEX idx_group_messages_user_id ON group_messages(user_id);
CREATE INDEX idx_group_messages_event_id ON group_messages(event_id);
-- ... etc for all 20
```

---

### 🟡 IMPORTANT — API Route Fetches Up to 50,000 Events

**File:** `src/app/api/events/route.ts` (line 104)

The default query limit is 50,000 rows. This means every map load fetches potentially all future events in a single request.

**Fix:** Implement pagination, viewport-based loading (only fetch events within the current map bounds), or use a spatial query with PostGIS.

---

### 🟡 IMPORTANT — No Caching Strategy

**Issue:** No caching headers on API responses. No CDN configuration. No `stale-while-revalidate`. Every page load hits Supabase directly.

**Fix:** Add `Cache-Control` headers to the events API (events change daily, not per-second). Consider ISR (Incremental Static Regeneration) for the landing page. Use `next/cache` for server-side data fetching.

---

### 🟡 IMPORTANT — Real-Time Subscriptions Properly Cleaned Up

**Issue:** All three real-time subscriptions (`messages/[userId]`, `messages`, `groups/[id]`) properly call `removeChannel` in cleanup functions. Good.

---

### 🟡 IMPORTANT — Bundle Size Concerns

**Issue:**
- `mapbox-gl` (380KB+ gzipped) is imported alongside `leaflet` — are both needed?
- `puppeteer-core` is in production dependencies but only used for scraping scripts
- `better-sqlite3` is in production dependencies but only used for local scraping

**Fix:** Move `puppeteer-core` and `better-sqlite3` to devDependencies if they're only used in scripts. Evaluate whether both Mapbox and Leaflet are needed.

---

### 🟢 NICE TO HAVE — Good Database Indexing on Events Table

The events table has proper indexes on:
- `start_date` (for date filtering)
- `bundesland` (for region filtering)
- `category` (for category filtering)
- `latitude, longitude` (for spatial queries)
- `source_name, source_id` (unique, for deduplication)
- `visibility` (for access control)
- `title` (GIN trigram for full-text search)

---

## Summary

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 5 |
| 🟡 IMPORTANT | 15 |
| 🟢 NICE TO HAVE | 7 |

### Top Priority Fixes Before Launch

1. Remove hardcoded Ticketmaster API key
2. Fix overly permissive RLS policies on `events` and `notifications`
3. Enable leaked password protection in Supabase Auth
4. Add `error.tsx` and `loading.tsx` files
5. Add indexes on 20 unindexed foreign keys

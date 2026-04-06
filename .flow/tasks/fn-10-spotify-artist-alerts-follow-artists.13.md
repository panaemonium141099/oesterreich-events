# fn-10-spotify-artist-alerts-follow-artists.13 Expandable Sidebar: Artist-Events Section with Ticket CTAs

## Description
Extend the existing map sidebar (`src/components/Layout/Sidebar.tsx`, 380px desktop / bottom sheet mobile) with an expandable "Kuenstler-Events" section. When expanded, it shows a detailed listing of all upcoming events matching the user's followed artists, with conversion-optimized ticket CTAs. The sidebar keeps its current "Veranstaltungen" list as the default view and adds a toggle/tab to switch to "Kuenstler-Events".

**Size:** M
**Files:** `src/components/Layout/Sidebar.tsx` (extend), `src/components/Artists/ArtistEventsSection.tsx`, `src/components/Artists/ArtistEventCard.tsx`, `src/app/api/artists/events/route.ts`, `src/app/map/page.tsx` (state)

## Approach

- Extend sidebar with a navigation toggle at the top (below the existing "Veranstaltungen" header):
  - Tab 1: **Alle Events** (default, existing EventList)
  - Tab 2: **Kuenstler-Events** (new, artist-matched events with ticket CTAs)
  - Tab 2 shows a badge count of upcoming artist events
  - Only visible for authenticated users who follow at least 1 artist
- New API route `GET /api/artists/events`:
  - Queries `artist_event_notifications` joined with `events` for the authenticated user
  - Only future events (`start_date >= now()`)
  - Returns: event details + matched artist names + match_score + ticket_url
  - Sorted by start_date (soonest first)
  - Cursor-based pagination (same pattern as `/api/events`)
- `ArtistEventsSection` component:
  - Groups events by time: "Diese Woche", "Naechste Woche", "Diesen Monat", "Spaeter"
  - Each group is collapsible
  - Infinite scroll pagination (same BATCH_SIZE: 50 as EventList)
- `ArtistEventCard` component (extends EventCard pattern):
  - Everything EventCard already shows (thumbnail, title, date, location, tags)
  - PLUS: matched artist name with Spotify image
  - PLUS: match confidence badge (>= 0.8 = "Sicherer Match", 0.6-0.8 = "Wahrscheinlich")
  - PLUS: prominent "Tickets sichern" button (links to ticket_url)
  - PLUS: fallback "Details ansehen" when no ticket_url
  - PLUS: "Erinnere mich" toggle icon (creates/removes event_reminders for this event)
- Sidebar expansion:
  - Desktop: sidebar width expands from 380px to ~500px when "Kuenstler-Events" is active (more room for ticket CTAs)
  - Mobile: bottom sheet stays same, ArtistEventCard adapts to narrow width
  - Smooth width transition (framer-motion or CSS transition)
- Clicking an ArtistEventCard flies the map to that event (same as existing EventCard behavior)
- Empty state: "Noch keine Events gefunden. Folge Kuenstlern um benachrichtigt zu werden!" with link to /artists
- Respect eveningMode (dark/light theme toggle)

## Key context

- Existing sidebar: `src/components/Layout/Sidebar.tsx` -- 380px desktop, fixed bottom sheet mobile
- Existing event list: `src/components/Events/EventList.tsx` -- infinite scroll, BATCH_SIZE 50
- Existing event card: `src/components/Events/EventCard.tsx` -- thumbnail, title, date, location, tags, category border
- Map page state in `src/app/map/page.tsx` (MapPageInner) -- add `sidebarTab: 'events' | 'artists'` state
- `selectedEvent` and `hoveredEventId` flow must work for ArtistEventCards too (fly-to, highlight)
- `ticket_url` on events may be NULL -- many scraped events have no ticket link
- Follow the left-border color coding from EventCard for category indication

## Acceptance
- [ ] Sidebar has toggle tabs: "Alle Events" / "Kuenstler-Events"
- [ ] "Kuenstler-Events" tab only visible for authenticated users with followed artists
- [ ] Badge count shows number of upcoming artist-matched events
- [ ] API route returns matched events with artist info, ticket_url, match_score
- [ ] Events grouped by time period (Diese Woche, Naechste Woche, etc.)
- [ ] ArtistEventCard shows matched artist name + image
- [ ] Match confidence badge displayed per event
- [ ] "Tickets sichern" button links to ticket_url when available
- [ ] "Details ansehen" fallback when no ticket_url
- [ ] "Erinnere mich" toggle per event (creates/removes reminders)
- [ ] Clicking card flies map to event location
- [ ] Desktop sidebar expands for artist view, smooth transition
- [ ] Mobile bottom sheet adapts ArtistEventCard layout
- [ ] Empty state with CTA to follow artists
- [ ] Infinite scroll pagination
- [ ] Respects eveningMode (dark/light theme)
- [ ] German-language UI throughout

## Done summary
Added artist-events sidebar tab to the map page with tabbed navigation (Alle Events / Kuenstler-Events), ArtistEventCard with match confidence badges and ticket CTAs, time-grouped collapsible sections, infinite scroll, reminder toggles, and smooth sidebar width transition for the desktop view.
## Evidence
- Commits: e04ee97b14d7e025b8946383cfef5395a3bccb35, 2808c93
- Tests: npx tsc --noEmit, npm test -- --run (501 passed)
- PRs:
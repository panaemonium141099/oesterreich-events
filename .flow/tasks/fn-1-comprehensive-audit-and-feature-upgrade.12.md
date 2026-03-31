# fn-1-comprehensive-audit-and-feature-upgrade.12 Chat Event Search and Sharing Enhancement

## Description
Enhance the chat messaging system with inline event search and rich event preview cards. Users should be able to search for events within a chat conversation and send them as rich-content messages. The `event_share` message type already exists in both DM and group chat — enhance it with inline search and better preview rendering.

**Size:** M
**Files:** src/app/messages/[userId]/page.tsx, src/app/groups/[id]/page.tsx, src/components/Chat/EventSearchInline.tsx (new), src/components/Chat/EventPreviewMessage.tsx (new), src/app/api/events/search/route.ts (new)

## Approach
- Create lightweight `/api/events/search` endpoint — text search with limit 10, returns minimal event data (id, title, date, location, image_url, category)
- Create `EventSearchInline` component: triggered by a search icon button in chat input area, shows dropdown with search results, selecting an event inserts it as an `event_share` message
- Create `EventPreviewMessage` component: renders event_share messages as rich cards in chat — image, title, date, location, clickable link to `/events/[id]` or `/map?event=[id]`
- Update DM page (`messages/[userId]/page.tsx`): add EventSearchInline to input area, replace plain event_share rendering with EventPreviewMessage
- Update group chat (`groups/[id]/page.tsx`): same enhancements as DM
- Deep-link: clicking an event preview in chat navigates to the event on the map

## Key context
- `direct_messages` table already has `event_id` and `message_type: 'event_share'` columns
- `group_messages` table also supports `message_type: 'event_share'` with `event_id`
- Current event sharing sends just the event_id — the receiver must fetch event details separately
- Chat uses Supabase Realtime on `postgres_changes` INSERT — no change needed for the transport layer
- The search endpoint should NOT use the 50K events API — create a lightweight dedicated endpoint
## Acceptance
- [ ] `/api/events/search` endpoint: text search, limit 10, returns minimal data
- [ ] EventSearchInline component with search dropdown in chat input area
- [ ] EventPreviewMessage renders rich event cards in chat (image, title, date, location)
- [ ] DM page enhanced with inline event search and rich previews
- [ ] Group chat enhanced with same features
- [ ] Deep-link from chat event preview to map/event detail
- [ ] Search debounced (300ms) to avoid excessive API calls
- [ ] `npm run build` succeeds
## Done summary
Added inline event search and rich event preview cards to both DM and group chat. Created a lightweight /api/events/search endpoint, reusable EventSearchInline and EventPreviewMessage components, with debounced search and deep-linking to the map view.
## Evidence
- Commits: 8eaa6af2779124a915d7734a9144d5d554b4f30c
- Tests: npm run build
- PRs:
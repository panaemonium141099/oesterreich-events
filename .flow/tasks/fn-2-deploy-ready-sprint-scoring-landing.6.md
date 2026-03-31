# fn-2-deploy-ready-sprint-scoring-landing.6 Event Detail Page & Sitemap

## Description
Create `/events/[id]/page.tsx` (SEO event detail page with `generateMetadata` + JSON-LD Event schema) and `sitemap.ts` using `generateSitemaps()` to handle 40k+ events.

**Size:** M
**Files:** `src/app/events/[id]/page.tsx` (new), `src/app/sitemap.ts` (new)

## Approach

**`/events/[id]/page.tsx`:** Server Component. `params` is `Promise<{ id: string }>` in Next.js 16 — must `await params`. Fetch event from Supabase using service role client (same pattern as `src/app/api/events/route.ts:9-12`). If not found, call `notFound()` from `next/navigation`. `generateMetadata`: title = event.title, description = first 160 chars of event.description, openGraph.images = [event.image_url] if present. JSON-LD Event schema: name, startDate (ISO), endDate, location (Place with address + geo coordinates), description, image, eventStatus (EventScheduled), eventAttendanceMode (OfflineEventAttendanceMode), organizer if present, offers if price_text present. XSS-sanitize the JSON-LD string. Render: reuse `EventDetail` component if it exists (check `src/components/Events/EventDetail.tsx`) or a simple server-rendered layout showing event details. Include `<Link href="/map">← Zurück zur Karte</Link>`.

**`sitemap.ts`:** Use `generateSitemaps()` to split into chunks of 5000 events per sitemap (Google's limit is 50k, staying well under). In Next.js 16, `id` parameter from `generateSitemaps` is `Promise<string>` — must `await id`. Query: events WHERE `start_date >= today` ORDER BY `event_score DESC, id`. Offset by `chunkIndex * 5000`. Each URL entry: `url: /events/{id}`, `lastModified: updated_at`, `changeFrequency: 'daily'`, `priority: event_score > 50 ? 0.8 : 0.5`. Also return static pages in chunk 0: `/` (priority 1.0), `/map` (0.8), `/impressum` (0.3), `/datenschutz` (0.3). Add `export const revalidate = 86400` (24h ISR) to avoid generating on every request.

## Key Context
- `src/app/events/create/page.tsx` exists at 13KB — there IS an events directory; `[id]` sits alongside `create/` at the same level
- Check `src/components/Events/EventDetail.tsx` for reusable component — existing EventDetail likely accepts an event prop and renders the full detail view
- `generateSitemaps()` returns `[{ id: 0 }, { id: 1 }, ...]` — calculate max index from `Math.ceil(totalEvents / 5000)`. Fetch total count first with a `.count()` query
- The sitemap uses absolute URLs — `metadataBase` from layout.tsx propagates, but sitemap entries need full `https://lasstreffen.at/events/{id}` strings
- `export const dynamic = 'force-dynamic'` may be needed if the sitemap reads request-time data; alternatively use `export const revalidate = 86400`
## Acceptance
- [ ] `GET /events/{valid-id}` returns 200 with event title in `<title>` tag
- [ ] `GET /events/{invalid-id}` returns 404
- [ ] OG tags present on event page: `curl http://localhost:3000/events/{id} | grep "og:"`
- [ ] Event page HTML contains `<script type="application/ld+json">` with schema.org Event type
- [ ] JSON-LD includes: name, startDate, location (with address), eventStatus, eventAttendanceMode
- [ ] `GET /sitemap.xml` returns valid XML sitemap index (or single sitemap if <5000 events)
- [ ] Sitemap includes `/events/{id}` URLs for upcoming events
- [ ] Sitemap includes static pages: `/`, `/map`
- [ ] `npm run build` passes (static generation of event pages if any are statically generated)
## Done summary
Created /events/[id]/page.tsx with generateMetadata (OG/Twitter tags), XSS-sanitized JSON-LD Event schema (name, startDate, location, eventStatus, eventAttendanceMode, organizer, offers), and 404 handling. Created sitemap.ts using generateSitemaps() to split 40k+ events into 5000-event chunks with score-based priority, plus static pages (/, /map, /impressum, /datenschutz) in chunk 0 and 24h ISR revalidation.
## Evidence
- Commits: 569adba3398045fe03bbb8654ce61440dd98d855
- Tests: npx tsc --noEmit
- PRs:
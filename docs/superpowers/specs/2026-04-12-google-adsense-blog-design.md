# Google AdSense Integration — Blog Pages

## Goal & Context

Monetize the blog section of lasstreffen.at with Google AdSense. Ads appear only on blog pages (`/blog` and `/blog/[slug]`), not on the map, landing page, or event detail pages. Hybrid approach: Auto-Ads globally on blog + manual ad slots at key positions on blog detail pages.

## Architecture

### 1. Blog Layout with AdSense Script

Create `src/app/blog/layout.tsx` that wraps all blog routes.

- Load the AdSense script via `next/script` with `strategy="afterInteractive"`
- Script URL: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${NEXT_PUBLIC_ADSENSE_CLIENT_ID}`
- Only load in production (`process.env.NODE_ENV === 'production'`)
- Only load after marketing cookie consent is granted (read from `localStorage`)
- Enable Auto-Ads via the script's `data-ad-client` attribute
- Publisher ID stored as env var `NEXT_PUBLIC_ADSENSE_CLIENT_ID` (not hardcoded)

### 2. AdSlot Component

Create `src/components/Ads/AdSlot.tsx` — a reusable client component.

**Props:**
- `slot: string` — the ad-unit ID from AdSense dashboard
- `format?: 'auto' | 'horizontal' | 'rectangle'` — ad format (default: `'auto'`)
- `className?: string` — optional wrapper class

**Behavior:**
- Renders nothing if `NEXT_PUBLIC_ADSENSE_CLIENT_ID` is not set (dev/preview)
- Renders nothing if marketing cookies are not consented
- Wraps `<ins class="adsbygoogle">` with `data-ad-client`, `data-ad-slot`, `data-ad-format`, `data-full-width-responsive="true"`
- Calls `(adsbygoogle = window.adsbygoogle || []).push({})` in a `useEffect`
- Wrapped in a container with subtle border and small "Anzeige" label above (AdSense policy compliance)

### 3. Ad Placement on Blog Detail Page

Three manual `<AdSlot>` insertions in `src/app/blog/[slug]/page.tsx`:

| Position | Location in page | Format |
|----------|-----------------|--------|
| After lead paragraph | Below the first `<p>` with left border | `auto` |
| Mid-content | Between lineup/gallery section and practical info | `horizontal` |
| End-of-article | Before the Related Posts carousel | `rectangle` |

Each slot gets its own ad-unit ID (configured in AdSense dashboard later).

### 4. Blog Index Page

No manual slots. Auto-Ads (enabled via the layout script) will place ads automatically on `/blog`.

### 5. Cookie Consent Extension

Extend the existing `CookieBanner` component (`src/components/Legal/CookieBanner.tsx`):

- Add a "Marketing-Cookies" category alongside any existing categories
- When accepted: set `marketing_consent: true` in localStorage
- When declined: set `marketing_consent: false` — no AdSense loads
- The blog layout reads this value to decide whether to inject the AdSense script
- Default state (no choice made yet): no ads (opt-in, DSGVO compliant)

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/blog/layout.tsx` | **Create** — blog layout with conditional AdSense script |
| `src/components/Ads/AdSlot.tsx` | **Create** — reusable ad slot component |
| `src/app/blog/[slug]/page.tsx` | **Modify** — insert 3 AdSlot components |
| `src/components/Legal/CookieBanner.tsx` | **Modify** — add marketing cookies category |
| `.env.local` | **Modify** — add `NEXT_PUBLIC_ADSENSE_CLIENT_ID` (empty until account created) |

## Environment Variables

```
NEXT_PUBLIC_ADSENSE_CLIENT_ID=   # e.g. ca-pub-1234567890 (empty in dev)
```

## Acceptance Criteria

- [ ] AdSense script loads only on `/blog` and `/blog/*` routes
- [ ] AdSense script loads only in production
- [ ] AdSense script loads only after marketing cookie consent
- [ ] Three ad slots visible on blog detail pages (after consent)
- [ ] No ads render when env var is empty or consent not given
- [ ] CookieBanner has a marketing cookies toggle
- [ ] Existing cookie consent behavior is not broken
- [ ] "Anzeige" label shown above each ad slot (AdSense policy)
- [ ] No layout shift from ad slots (reserved min-height)

## Boundaries

- No Google Consent Mode v2 (can be added later if Google requires it)
- No ads on non-blog pages (landing, map, events, admin)
- No server-side ad logic — purely client-side
- Ad-unit IDs will be placeholder values until AdSense account is approved
- No A/B testing or analytics for ad performance (phase 1)

## Decision Context

Hybrid approach (Auto-Ads + manual slots) chosen over pure Auto-Ads because manual slots at key content breaks perform better on long-form blog content. Pure manual was rejected because it requires more maintenance as blog templates evolve. The blog is the only section with ads because it has the right content density and user intent (reading) for display ads — the map and event pages need to stay clean.

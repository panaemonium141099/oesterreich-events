# UX Audit - Osterreich Events App

**Audit Date:** 2026-03-29
**Auditor:** Claude Code (automated source-level review)
**Scope:** All pages, components, auth flows, navigation, and cross-cutting concerns

---

## 1. Landing Page Flow

### 1.1 Typo in Search Placeholder
- **File:** `src/components/Landing/HeroSection.tsx` (line 140)
- **Severity:** Minor
- **Issue:** Placeholder text says "Lass tressen in..." -- should be "Lass treffen in..." (missing 'f'). Same typo appears in the Header component (line 115: "Lass treffen in..." -- this one is correct but uses a slightly different wording "Lass treffen in..." vs the landing).
- **Fix:** Change placeholder to "Lass treffen in..." or "Wo bist du?" for consistency.

### 1.2 Gemeinden Data Not Pre-loaded -- Empty First Keystroke
- **File:** `src/components/Landing/HeroSection.tsx` (line 26-34)
- **Severity:** Minor
- **Issue:** Gemeinden JSON is lazy-loaded on first keystroke via `loadGemeinden()`. On slow connections, the user types 2+ characters before data arrives, seeing no suggestions initially. Only on subsequent keystrokes do suggestions appear.
- **Fix:** Start fetching gemeinden.json on input focus, not on change. Or prefetch it after page load with a small delay.

### 1.3 No Feedback on Auth Error Redirect
- **File:** `src/app/page.tsx`, `src/app/auth/callback/route.ts` (line 18)
- **Severity:** Minor
- **Issue:** If OAuth callback fails, user is redirected to `/?auth_error=true` but the landing page has no code to read this query param or display an error message. The user sees the normal landing page with no indication that login failed.
- **Fix:** Read `auth_error` search param in the landing page and show a toast/banner: "Anmeldung fehlgeschlagen. Bitte versuche es erneut."

### 1.4 curtain Animation Uses Direct DOM Manipulation
- **File:** `src/components/Landing/HeroSection.tsx` (lines 65-76)
- **Severity:** Minor
- **Issue:** `navigateWithCurtain` directly manipulates DOM via `document.getElementById` and inline styles. This works but is fragile. If the `id` changes or the element doesn't exist, the fallback `router.push` works, but the animation is brittle.
- **Fix:** Acceptable for now. Consider a shared transition context if more pages use this pattern.

### 1.5 LandingStats Calls SQLite on Server -- Couples Frontend to Local DB
- **File:** `src/components/Landing/LandingStats.tsx` (line 4)
- **Severity:** Major
- **Issue:** `LandingStats` is a server component calling `getEvents({ limit: 0 })` which queries the local SQLite database. This will fail in any deployment where SQLite is not available (e.g., Vercel Edge). The stat count will also be stale -- it only updates on page rebuild, not live.
- **Fix:** Either accept this as a static/ISR component (fine for now), or fetch the count from the API route client-side.

---

## 2. Login/Register Flow

### 2.1 Google OAuth Callback Route Exists But Has No Error Display
- **File:** `src/app/auth/callback/route.ts`
- **Severity:** Minor
- **Issue:** See 1.3 above. Auth errors silently redirect to landing with no visible error.
- **Fix:** Show error on landing or redirect to `/auth/login?error=oauth`.

### 2.2 Apple Sign-In Button Disabled But Visible
- **File:** `src/app/auth/login/page.tsx` (lines 63-75), `src/app/auth/register/page.tsx` (lines 131-143)
- **Severity:** Minor
- **Issue:** Apple button is always shown as disabled with "Bald verfugbar" tooltip. This adds visual noise and may confuse users who expect it to work.
- **Fix:** Acceptable if temporary. Consider hiding it entirely until implemented, or adding a "coming soon" badge inside the button.

### 2.3 No Email Validation Beyond HTML `required`
- **File:** `src/app/auth/login/page.tsx`, `src/app/auth/register/page.tsx`
- **Severity:** Minor
- **Issue:** Both forms rely on `type="email"` and `required` for validation. No custom validation (e.g., regex, domain check). Supabase will reject malformed emails, but the error message from Supabase may not be user-friendly in German.
- **Fix:** Add client-side email format validation with a German error message before submitting.

### 2.4 Register Step 2 -- All Fields Required Including Phone
- **File:** `src/app/auth/register/page.tsx` (lines 256-275)
- **Severity:** Major
- **Issue:** Step 2 requires birth_date and phone as `required` HTML fields. This is a privacy concern -- many users will not want to give their phone number during registration. This will cause drop-off.
- **Fix:** Make phone and birth_date optional at registration. Collect them later in the profile if needed.

### 2.5 Register -- No Password Strength Indicator
- **File:** `src/app/auth/register/page.tsx`
- **Severity:** Minor
- **Issue:** Minimum 6 characters is validated, but there is no visual strength indicator or requirements list (uppercase, number, etc.).
- **Fix:** Add a password strength meter or at least show the minimum requirement visually before submission.

### 2.6 After Email Registration -- Redirect Unclear
- **File:** `src/app/auth/register/page.tsx` (lines 84-105)
- **Severity:** Minor
- **Issue:** After successful registration, the success screen shows "Fast geschafft!" with a link "Zum Login". The user must manually navigate to login after confirming their email. This flow works but could be smoother.
- **Fix:** Acceptable. Could add a "check your inbox" illustration or auto-redirect after email confirmation.

### 2.7 Login -- Double Navigation on Success
- **File:** `src/app/auth/login/page.tsx` (lines 19-23, 35-36)
- **Severity:** Minor
- **Issue:** After successful email login, `router.push('/map')` is called (line 36). But the `useEffect` on lines 19-23 also calls `router.replace('/map')` when `user` becomes truthy. This could cause a double navigation or a flash.
- **Fix:** Remove the explicit `router.push('/map')` in `handleEmailLogin` and let the useEffect handle the redirect.

---

## 3. Map Page Flow

### 3.1 Sidebar Hidden on Mobile -- No Way to See Event List
- **File:** `src/app/map/page.tsx` (lines 135-146)
- **Severity:** Critical
- **Issue:** The sidebar is wrapped in `hidden lg:block`, meaning it is completely invisible on mobile and tablet screens. The hamburger button in the header (`lg:hidden`) toggles `sidebarOpen` state, but the sidebar container always has `hidden lg:block`. This means on mobile, there is NO event list at all -- users can only interact with map markers.
- **Fix:** Implement a mobile-friendly sidebar (e.g., bottom sheet or full-screen overlay) that shows when `sidebarOpen` is true on small screens.

### 3.2 FilterBar Overflows on Mobile
- **File:** `src/components/Filters/FilterBar.tsx`
- **Severity:** Major
- **Issue:** The FilterBar renders search input + CategoryFilter + DistrictFilter + DateRangeFilter all in a horizontal `flex` row with no wrapping or overflow handling. On mobile, this will overflow the header and either be cut off or cause horizontal scrolling.
- **Fix:** Add `overflow-x-auto` and `flex-wrap` or create a mobile filter UI (e.g., collapsible filter panel or modal).

### 3.3 DistrictFilter Shows Empty When "Ganz Osterreich" Selected
- **File:** `src/components/Filters/DistrictFilter.tsx` (lines 12-14)
- **Severity:** Minor
- **Issue:** When bundesland is "all", `getDistrictsByBundesland('all')` likely returns an empty array, so the Bezirk dropdown shows "Alle Bezirke" with no options. This is correct behavior but the dropdown should probably be hidden when there are no districts to select.
- **Fix:** Hide the DistrictFilter dropdown entirely when no districts are available.

### 3.4 PriceRangeFilter Exists But Is Not Used
- **File:** `src/components/Filters/PriceRangeFilter.tsx`
- **Severity:** Minor
- **Issue:** The PriceRangeFilter component exists and the API supports `priceMin`/`priceMax` filters, but it is not rendered anywhere in the FilterBar. The component also lacks evening mode styling.
- **Fix:** Either add PriceRangeFilter to the FilterBar or remove the dead component.

### 3.5 Home Button ("OE") Hidden on Mobile
- **File:** `src/components/Layout/Header.tsx` (line 91)
- **Severity:** Major
- **Issue:** The home button with "OE" text has `hidden lg:flex`, so it is invisible on mobile. Users on mobile cannot navigate back to the landing page from the map. The only way back is using the browser back button.
- **Fix:** Show a simplified home button on mobile, or add a back/home link to the mobile hamburger menu.

### 3.6 Home Button Uses `window.location.href` Instead of Router
- **File:** `src/components/Layout/Header.tsx` (line 89)
- **Severity:** Minor
- **Issue:** The home button uses `window.location.href = '/'` which causes a full page reload rather than a client-side navigation. This is intentional (for the curtain animation), but it's slower.
- **Fix:** Acceptable given the curtain animation design intent.

### 3.7 Map Loading Spinner Uses Light Theme Colors
- **File:** `src/app/map/page.tsx` (lines 15-22, 27-31)
- **Severity:** Minor
- **Issue:** The map loading spinner has hardcoded light colors (`bg-slate-100`, `border-blue-600`, `text-slate-500`). If the user previously had evening mode enabled, the loading state will flash in light mode before the map renders.
- **Fix:** Use neutral colors or detect previous evening mode preference from localStorage.

### 3.8 EventMap Uses Mapbox But CLAUDE.md Says Leaflet
- **File:** `src/components/Map/EventMap.tsx` vs `src/components/Map/EventMarker.tsx`
- **Severity:** Minor (documentation issue)
- **Issue:** CLAUDE.md states the map uses "Leaflet + react-leaflet + react-leaflet-cluster" but EventMap.tsx actually uses Mapbox GL JS. EventMarker.tsx still uses Leaflet but appears to be dead code (not imported by EventMap or MapPage).
- **Fix:** Update CLAUDE.md to reflect Mapbox GL JS. Remove dead EventMarker.tsx if not used.

### 3.9 Mapbox Access Token May Be Empty
- **File:** `src/components/Map/EventMap.tsx` (line 10)
- **Severity:** Critical
- **Issue:** `mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''`. If the env var is missing, the map will fail to load with no user-facing error message. The loading spinner would just spin forever.
- **Fix:** Add error handling -- if the token is empty, show a fallback message instead of a broken map.

### 3.10 "Nachtleben" Toggle Does Not Persist
- **File:** `src/app/map/page.tsx`
- **Severity:** Minor
- **Issue:** The evening mode state is only in component state. If the user navigates away (e.g., to profile) and comes back, evening mode resets to off.
- **Fix:** Persist evening mode in localStorage.

### 3.11 User Menu Links to Non-Existent Pages
- **File:** `src/components/Layout/Header.tsx` (lines 242-249)
- **Severity:** Major
- **Issue:** The user dropdown menu includes a link to `/groups` ("Meine Gruppen") but there is no `src/app/groups/` directory. Similarly, `/admin` is linked but has no route. Clicking these will result in a 404 page.
- **Fix:** Remove links to unimplemented pages, or add placeholder pages with "Coming Soon" messages.

---

## 4. Profile Page Flow

### 4.1 Profile Back Navigation Only Goes to /map
- **File:** `src/app/profile/page.tsx` (line 90)
- **Severity:** Minor
- **Issue:** The "Zuruck zur Karte" link always goes to `/map`. If the user came from the landing page menu, they would expect to go back to the landing page, not the map.
- **Fix:** Use `router.back()` or store the previous route.

### 4.2 No Form Validation for Required Fields
- **File:** `src/app/profile/page.tsx` (lines 126-143)
- **Severity:** Minor
- **Issue:** Fields marked with `*` (Vorname, Nachname, Geburtsdatum, Telefonnummer) are visually indicated as required but have no HTML `required` attribute. The save button is only disabled when `!firstName || !lastName` (line 268). Birth date and phone can be empty despite being marked as required.
- **Fix:** Either enforce all "required" fields in the disabled check, or remove the `*` from birth date and phone.

### 4.3 Spotify and Facebook Connect Buttons Do Nothing
- **File:** `src/app/profile/page.tsx` (lines 213-254)
- **Severity:** Major
- **Issue:** The Spotify and Facebook "Verbinden" buttons are rendered as `<button>` elements but have no `onClick` handler. Clicking them does nothing. The `profile?.spotify_connected` / `profile?.facebook_connected` fields are checked but there is no integration code.
- **Fix:** Either implement OAuth flows for Spotify/Facebook, or hide these buttons, or add a "Coming soon" tooltip.

### 4.4 No Avatar Upload Capability
- **File:** `src/app/profile/page.tsx` (lines 101-109)
- **Severity:** Minor
- **Issue:** The avatar area shows the user's avatar or initials but provides no way to upload or change the avatar. For Google OAuth users, the avatar comes from Google, but email/password users have no avatar.
- **Fix:** Add an avatar upload button/overlay.

### 4.5 Profile Page Has Its Own Layout Instead of Reusing Auth Layout
- **File:** `src/app/profile/page.tsx`
- **Severity:** Minor (design consistency)
- **Issue:** The profile page builds its own full layout (header, background, etc.) rather than using a shared layout. This is fine but means any design changes must be duplicated.
- **Fix:** Consider creating a shared "dark page" layout component.

---

## 5. Event Detail Flow

### 5.1 Close Button Positioned Absolutely Outside Container
- **File:** `src/components/Events/EventDetail.tsx` (lines 109-116)
- **Severity:** Major
- **Issue:** The close button has `absolute top-6 right-6` but its parent modal card is not `position: relative`. The button is positioned relative to the backdrop overlay (which is `absolute inset-0`), not the card. This means the close button floats in the top-right of the screen, not the top-right of the modal card.
- **Fix:** Add `relative` to the modal card div, or reposition the close button inside the card with proper positioning.

### 5.2 Duplicate `transition-` Classes on Close Button
- **File:** `src/components/Events/EventDetail.tsx` (line 111)
- **Severity:** Minor (cosmetic)
- **Issue:** The close button has `transition-all hover:rotate-90 transition-transform` -- two conflicting `transition-` classes. Tailwind v4 may only apply the last one.
- **Fix:** Remove one of the transition classes. Use `transition-all` alone.

### 5.3 Time Display Logic May Show Incorrect Times
- **File:** `src/components/Events/EventDetail.tsx` (lines 31-41)
- **Severity:** Major
- **Issue:** The `formatTime` function checks `date.getHours() === 0 && date.getMinutes() === 0` to suppress midnight times. However, events that genuinely start at midnight (00:00) -- common for nightlife/raves -- will have their time suppressed. Also, if the source stores dates in UTC, a time like "22:00 UTC" would display as "23:00" or "00:00" in CET, potentially triggering the midnight suppression for a 23:00 event.
- **Fix:** Store and display times in local timezone. Do not suppress 00:00 for Nightlife category events.

### 5.4 Share Button Only Copies URL -- No Share API
- **File:** `src/components/Events/EventDetail.tsx` (lines 72-76)
- **Severity:** Minor
- **Issue:** "Teilen" only copies `event.source_url` to clipboard. On mobile, using the Web Share API (`navigator.share()`) would provide a much better UX with native share sheets.
- **Fix:** Use `navigator.share()` when available, fall back to clipboard copy.

### 5.5 Save Button Redirects With Full Page Reload When Not Logged In
- **File:** `src/components/Events/EventDetail.tsx` (lines 79-81)
- **Severity:** Minor
- **Issue:** When a non-logged-in user clicks the heart button, `window.location.href = '/auth/login'` causes a full page reload. After login, the user is redirected to `/map` but not back to the event they wanted to save.
- **Fix:** Use `router.push('/auth/login?next=/map')` and store the event ID to save after login.

### 5.6 Saved Events Table Query Uses String Event ID
- **File:** `src/components/Events/EventDetail.tsx` (lines 61, 85, 88)
- **Severity:** Major
- **Issue:** The event `id` from SQLite is a number, but saved_events in Supabase stores `event_id` as a string (`.eq('event_id', String(event.id))`). This mismatch between SQLite event IDs and Supabase saved_events could cause issues if the SQLite DB is rebuilt with different IDs. Events would become "orphaned" in the saved_events table.
- **Fix:** Use `source_id` (which is stable across scrapes) as the event identifier in saved_events, not the auto-increment `id`.

### 5.7 Supabase Client Created Outside Component
- **File:** `src/components/Events/EventDetail.tsx` (line 51)
- **Severity:** Minor
- **Issue:** `const supabase = createClient()` is called in the component body on every render. While `createBrowserClient` likely caches internally, this is not ideal.
- **Fix:** Use `useMemo` or create a singleton.

---

## 6. Saved Events Flow

### 6.1 Saved Events Join Query May Fail
- **File:** `src/app/saved/page.tsx` (lines 47-54)
- **Severity:** Critical
- **Issue:** The query joins `saved_events` with an `events` table in Supabase: `.select('id, event_id, ..., events (id, title, ...)')`. But the app's events come from a local SQLite database, not Supabase. Unless there is also an `events` table in Supabase (which is not evident from the codebase), this join will fail with a "relation does not exist" error, or return null for the `events` field.
- **Fix:** Either sync events to Supabase, store event metadata in the saved_events row itself, or fetch event details from the local API by ID after getting saved event IDs.

### 6.2 No Click Handler to View Saved Event Details
- **File:** `src/app/saved/page.tsx` (lines 125-168)
- **Severity:** Major
- **Issue:** Saved event cards have no `onClick` or `Link` to navigate to the event or show details. Users can see their saved events but cannot click them to view details or navigate to the event on the map.
- **Fix:** Wrap each saved event card in a `Link` to `/map?eventId=...` or add an onClick handler to show event details.

### 6.3 Remove Button Only Visible on Hover -- Bad Mobile UX
- **File:** `src/app/saved/page.tsx` (line 160)
- **Severity:** Major
- **Issue:** The remove button has `opacity-0 group-hover:opacity-100`. On touch devices, there is no hover state. Users on mobile cannot see or access the remove button.
- **Fix:** Always show the remove button, or add a swipe-to-delete gesture, or show it on tap.

### 6.4 Date Formatting May Show Wrong Day for Date-Only Strings
- **File:** `src/app/saved/page.tsx` (lines 67-73)
- **Severity:** Minor
- **Issue:** `formatDate` creates `new Date(dateStr)` without the timezone fix used in EventCard/EventDetail. Date-only strings like "2026-04-15" will be parsed as UTC midnight, potentially showing the previous day in CET (UTC+1/+2).
- **Fix:** Apply the same `dateStr + 'T12:00:00'` fix used in other components.

---

## 7. Event Create Flow

### 7.1 Event Submitted to Supabase But Events Served from SQLite
- **File:** `src/app/events/create/page.tsx` (lines 69-86)
- **Severity:** Critical
- **Issue:** User-created events are inserted into Supabase (`supabase.from('events').insert(...)`) but the map/sidebar loads events from the local SQLite database via `/api/events`. User-created events will NOT appear on the map because the API reads from SQLite, not Supabase.
- **Fix:** Either (a) also insert into SQLite via an API route, (b) read from Supabase alongside SQLite, or (c) add a note that user events will appear after admin approval/sync.

### 7.2 No Coordinate Input for User Events
- **File:** `src/app/events/create/page.tsx`
- **Severity:** Major
- **Issue:** The create form has no latitude/longitude fields and no geocoding. Even if user events were displayed on the map, they would have no coordinates and thus no map marker. Address + PLZ + Bundesland are available but not geocoded.
- **Fix:** Add geocoding (Nominatim) from the address/PLZ, or add a "pick location on map" feature.

### 7.3 Bundesland Display Names Are Malformed
- **File:** `src/app/events/create/page.tsx` (line 259)
- **Severity:** Minor
- **Issue:** `bl.charAt(0).toUpperCase() + bl.slice(1).replace('oe', 'o').replace('ae', 'a')` only replaces the first occurrence. "niederoesterreich" becomes "Niederosterreich" (correct) but the display logic is fragile.
- **Fix:** Use a proper name mapping instead of string replacement. The main `BUNDESLAENDER` array in bundeslaender.ts already has display names.

### 7.4 No Image Upload
- **File:** `src/app/events/create/page.tsx`
- **Severity:** Minor
- **Issue:** No option to upload or link an image for the event. The event will use a category fallback image.
- **Fix:** Add an image URL field or file upload to Supabase Storage.

### 7.5 Category List Differs from Main Categories
- **File:** `src/app/events/create/page.tsx` (lines 9-13) vs `src/lib/categories.ts`
- **Severity:** Minor
- **Issue:** The create page has `'Nightlife'` and `'Rave'` is missing from the create form CATEGORIES but exists in EventCard color maps. The create page also includes `'Feste & Brauchtum'` and `'Religion'` which is good. However, the lists should be imported from a shared source.
- **Fix:** Import CATEGORIES from `@/lib/categories` instead of defining a local copy.

---

## 8. Password Reset Flow

### 8.1 Reset Password Page Has No Session Check
- **File:** `src/app/auth/reset-password/page.tsx`
- **Severity:** Major
- **Issue:** The reset password page renders the form immediately. If the user navigates directly to `/auth/reset-password` without a valid reset token (from the email link), `supabase.auth.updateUser({ password })` will fail with an unclear error. There is no check that a valid recovery session exists.
- **Fix:** Check for an active recovery session on mount. If none exists, show a message: "Dieser Link ist ungultig oder abgelaufen. Bitte fordere einen neuen Link an."

### 8.2 No Show/Hide Password Toggle on Reset Page
- **File:** `src/app/auth/reset-password/page.tsx`
- **Severity:** Minor
- **Issue:** The reset password form has no show/hide toggle for the password fields, unlike the login and register forms which do have this feature.
- **Fix:** Add the same EyeIcon/EyeOffIcon toggle as in login/register.

### 8.3 Reset Success Redirects to /map Without Checking Auth
- **File:** `src/app/auth/reset-password/page.tsx` (line 36)
- **Severity:** Minor
- **Issue:** After successful password reset, the user is redirected to `/map` after 2 seconds. But they may need to log in again with their new password. The redirect assumes the session is still valid.
- **Fix:** Redirect to `/auth/login?message=password_reset` instead, with a success message on the login page.

---

## 9. Auth Context

### 9.1 Safety Timeout Is Only 3 Seconds
- **File:** `src/lib/supabase/auth-context.tsx` (line 91)
- **Severity:** Minor
- **Issue:** The safety timeout to prevent infinite loading is 3 seconds. On slow connections, `getSession()` might take longer than 3 seconds. When the timeout fires, `loading` becomes false with no user, potentially causing protected pages to briefly redirect to login before the session is actually loaded.
- **Fix:** Increase timeout to 5-10 seconds, or show a "taking longer than expected" message after 3 seconds instead of completing.

### 9.2 No Error State in Auth Context
- **File:** `src/lib/supabase/auth-context.tsx`
- **Severity:** Minor
- **Issue:** The auth context has `loading` but no `error` state. If `getSession()` fails or profile fetch fails, the user gets silently logged out with no explanation.
- **Fix:** Add an `error` state to the context and surface it in the UI.

### 9.3 Supabase Client Created with `useState` Initializer
- **File:** `src/lib/supabase/auth-context.tsx` (line 60)
- **Severity:** Minor
- **Issue:** `const [supabase] = useState(() => createClient())` -- using useState to create a singleton is a React antipattern. It works but `useMemo` or `useRef` would be more idiomatic.
- **Fix:** Use `const supabase = useMemo(() => createClient(), [])` or a ref.

### 9.4 signOut Redirects to Landing But Not Explicitly
- **File:** `src/lib/supabase/auth-context.tsx` (lines 167-170)
- **Severity:** Minor
- **Issue:** `signOut` clears the profile but does not redirect. The user stays on whatever page they are on. On protected pages (profile, saved, create), the redirect-to-login useEffect will fire, but the user sees a brief flash of the loading spinner.
- **Fix:** Add `router.push('/')` in the signOut handler, or let consumers handle it.

---

## 10. Cross-Cutting Concerns

### 10.1 No Dark/Light Mode Toggle -- Only Evening Mode on Map
- **Severity:** Major
- **Issue:** The app has two visual modes: black-themed pages (landing, auth, profile, saved, create) and light-themed pages (map default). There is no system-wide dark mode toggle. The "Nachtleben" evening mode only affects the map page. The landing/auth/profile pages are always dark. This creates inconsistency -- the map feels like a different app when in default (light) mode.
- **Fix:** Consider either making the map default to dark theme to match the rest of the app, or adding a global dark/light mode preference.

### 10.2 No Mobile Navigation Menu
- **Severity:** Critical
- **Issue:** On mobile, the map page header has a hamburger button that toggles sidebar state, but the sidebar is `hidden lg:block` (see 3.1). The landing page has no hamburger menu. Auth pages use a simple back arrow. There is no unified mobile navigation. Users cannot access profile, saved events, or event create from mobile on the map page without the user dropdown (which does exist).
- **Fix:** The user dropdown in the header does work on mobile for authenticated users. For non-authenticated mobile users, only "Anmelden" is visible. This is acceptable but the sidebar issue (3.1) remains critical.

### 10.3 No 404 Page
- **Severity:** Minor
- **Issue:** There is no custom `src/app/not-found.tsx`. Navigating to non-existent routes (like `/groups` or `/admin`) will show Next.js's default 404 page, which does not match the app's design.
- **Fix:** Add a custom not-found page with the app's dark theme and a link back to the landing page.

### 10.4 No Loading State Between Page Navigations
- **Severity:** Minor
- **Issue:** When navigating from landing to map (especially with the curtain animation), there is a 500ms delay + full route change. During this time, the browser may show a blank/white flash before the map page renders.
- **Fix:** The curtain animation helps. Consider adding a `loading.tsx` in the map route for a smoother transition.

### 10.5 Protected Routes Use Client-Side Redirects Only
- **Severity:** Minor
- **Issue:** Profile, saved events, and create event pages redirect to login with `useEffect` checks. This means the protected content briefly renders (or at least the loading spinner renders) before the redirect fires. The middleware (`src/middleware.ts`) only refreshes the session; it does not redirect unauthenticated users.
- **Fix:** Acceptable for now. For better security, add route protection in middleware for `/profile`, `/saved`, `/events/create`.

### 10.6 No SEO Meta Tags on Inner Pages
- **Severity:** Minor
- **Issue:** Only the root layout has metadata. The map page, profile page, auth pages, etc. have no page-specific `<title>` or `<meta description>`.
- **Fix:** Add `export const metadata` to each page (or use `generateMetadata`).

### 10.7 No Error Boundary
- **Severity:** Minor
- **Issue:** There is no `error.tsx` in any route segment. If a runtime error occurs (e.g., SQLite connection failure, Mapbox token invalid), the user sees an unhandled React error.
- **Fix:** Add `error.tsx` at least in the root and map route.

### 10.8 Accessibility -- Missing ARIA Labels
- **Severity:** Minor
- **Issue:** Several interactive elements lack `aria-label` attributes: the hamburger menu button, bundesland dropdown, evening mode toggle, close buttons, etc. Screen readers will not be able to identify these controls.
- **Fix:** Add `aria-label` to all icon-only buttons and custom dropdowns.

### 10.9 No Keyboard Navigation for Custom Dropdowns
- **Severity:** Minor
- **Issue:** The bundesland dropdown and user menu in Header.tsx are custom-built divs, not native `<select>` elements. They close on outside click but have no keyboard navigation (no arrow key support, no Escape to close, no focus trap).
- **Fix:** Add keyboard event handlers for Escape and arrow key navigation.

### 10.10 `Rave` Category Missing From Category Filter
- **Severity:** Minor
- **Issue:** The `CATEGORY_COLORS` map in EventCard.tsx includes `'Rave'` but the CATEGORIES list in `categories.ts` (used by the filter dropdown) does not include `'Rave'`. The categoryImages.ts also has a `'Rave'` entry. This means Rave events get colored badges but cannot be filtered for specifically. The Nightlife category likely catches most raves via keyword matching.
- **Fix:** Either add 'Rave' to the CATEGORIES list or merge it into 'Nightlife' consistently.

---

## Summary by Severity

### Critical (3)
| # | Issue | File |
|---|-------|------|
| 3.1 | Sidebar completely hidden on mobile -- no event list | `map/page.tsx` |
| 3.9 | No fallback if Mapbox token is missing | `EventMap.tsx` |
| 6.1 | Saved events join references non-existent Supabase events table | `saved/page.tsx` |

### Major (10)
| # | Issue | File |
|---|-------|------|
| 1.5 | LandingStats couples frontend to local SQLite | `LandingStats.tsx` |
| 2.4 | Phone + birth date required at registration | `register/page.tsx` |
| 3.2 | FilterBar overflows on mobile | `FilterBar.tsx` |
| 3.5 | Home button hidden on mobile | `Header.tsx` |
| 3.11 | Links to non-existent /groups and /admin pages | `Header.tsx` |
| 4.3 | Spotify/Facebook buttons do nothing | `profile/page.tsx` |
| 5.1 | Close button positioned relative to overlay, not card | `EventDetail.tsx` |
| 5.6 | Event ID mismatch between SQLite and Supabase | `EventDetail.tsx` |
| 6.2 | No click handler on saved events | `saved/page.tsx` |
| 6.3 | Remove button only visible on hover -- broken on mobile | `saved/page.tsx` |
| 7.1 | User events go to Supabase but map reads from SQLite | `create/page.tsx` |
| 7.2 | No coordinates for user-created events | `create/page.tsx` |
| 8.1 | No session check on password reset page | `reset-password/page.tsx` |
| 10.1 | Inconsistent dark/light theming across pages | cross-cutting |

### Minor (25+)
| # | Issue | File |
|---|-------|------|
| 1.1 | Typo "Lass tressen in..." | `HeroSection.tsx` |
| 1.2 | Gemeinden not pre-loaded | `HeroSection.tsx` |
| 1.3 | No auth error display on landing | `page.tsx` |
| 1.4 | Direct DOM manipulation in curtain | `HeroSection.tsx` |
| 2.2 | Disabled Apple button adds noise | `login/page.tsx` |
| 2.3 | No client-side email validation | `login/page.tsx` |
| 2.5 | No password strength indicator | `register/page.tsx` |
| 2.6 | Redirect after register is manual | `register/page.tsx` |
| 2.7 | Double navigation on login success | `login/page.tsx` |
| 3.3 | District dropdown empty but visible | `DistrictFilter.tsx` |
| 3.4 | PriceRangeFilter unused | `PriceRangeFilter.tsx` |
| 3.6 | Home button uses full page reload | `Header.tsx` |
| 3.7 | Map loading uses light-only colors | `map/page.tsx` |
| 3.8 | CLAUDE.md says Leaflet, code uses Mapbox | `EventMap.tsx` |
| 3.10 | Evening mode does not persist | `map/page.tsx` |
| 4.1 | Back navigation always goes to /map | `profile/page.tsx` |
| 4.2 | Required field indicators inconsistent | `profile/page.tsx` |
| 4.4 | No avatar upload | `profile/page.tsx` |
| 5.2 | Duplicate transition classes | `EventDetail.tsx` |
| 5.3 | Midnight time suppression for nightlife events | `EventDetail.tsx` |
| 5.4 | No Web Share API | `EventDetail.tsx` |
| 5.5 | Save redirect uses full page reload | `EventDetail.tsx` |
| 5.7 | Supabase client created every render | `EventDetail.tsx` |
| 6.4 | Date parsing timezone issue | `saved/page.tsx` |
| 7.3 | Bundesland names malformed | `create/page.tsx` |
| 7.4 | No image upload | `create/page.tsx` |
| 7.5 | Category list not shared | `create/page.tsx` |
| 8.2 | No password toggle on reset page | `reset-password/page.tsx` |
| 8.3 | Reset redirects to map, not login | `reset-password/page.tsx` |
| 9.1 | 3-second safety timeout too short | `auth-context.tsx` |
| 9.2 | No error state in auth context | `auth-context.tsx` |
| 9.3 | useState for Supabase client | `auth-context.tsx` |
| 9.4 | signOut does not redirect | `auth-context.tsx` |
| 10.3 | No custom 404 page | app directory |
| 10.4 | No loading state between navigations | app directory |
| 10.5 | Protected routes client-side only | middleware.ts |
| 10.6 | No SEO meta tags on inner pages | various |
| 10.7 | No error boundary | app directory |
| 10.8 | Missing ARIA labels | various |
| 10.9 | No keyboard navigation for dropdowns | Header.tsx |
| 10.10 | Rave category inconsistency | categories.ts |

---

## Top Priority Fixes (Recommended Order)

1. **Fix mobile sidebar** (3.1) -- users on mobile cannot see event list at all
2. **Fix saved events Supabase join** (6.1) -- saved events page likely crashes
3. **Add Mapbox token error handling** (3.9) -- map breaks silently without token
4. **Fix mobile FilterBar overflow** (3.2) -- filters unusable on mobile
5. **Fix EventDetail close button positioning** (5.1) -- close button misplaced
6. **Add click handlers to saved events** (6.2) -- saved events are display-only
7. **Fix mobile remove button visibility** (6.3) -- cannot unsave on mobile
8. **Remove/fix dead links** (3.11) -- /groups and /admin 404
9. **Fix user-created events not appearing on map** (7.1) -- core feature broken
10. **Add session check on password reset** (8.1) -- prevents confusing errors

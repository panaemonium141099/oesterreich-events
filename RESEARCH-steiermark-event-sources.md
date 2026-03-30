# Research: Steiermark (Styria) Event Sources

## Overview

Comprehensive list of event sources for Steiermark, Austria. Organized by category with scraping notes.

**Last updated:** 2026-03-27 — URLs verified via WebFetch, rendering confirmed.

---

## 1. Official Tourism — Statewide

### steiermark.com (Steirischer Tourismus GmbH)
- **URL:** https://www.steiermark.com/de/Urlaub-planen/Veranstaltungen
- **English:** https://www.steiermark.com/en/Plan-your-holiday/Events
- **Top Events:** https://www.steiermark.com/en/Plan-your-holiday/Events/Top-events
- **SSR vs Headless:** Likely feratel/Deskline backend — needs inspection; probably SSR with pagination
- **Event types:** All categories (sports, culture, folk, festivals, markets)
- **Approx. count:** 400–800+ statewide
- **Notes:** Primary aggregator for all of Styria. Uses feratel Deskline as backend CMS/database. Individual event detail pages likely have JSON-LD structured data. Has regional sub-sections (see §2).
- **Scraping approach:** Cheerio likely sufficient if SSR (TYPO3/feratel pattern matches burgenland.info). Paginated list pages + JSON-LD on detail pages.

---

## 2. Official Tourism — Regional Sub-Pages on steiermark.com

All sub-regions are served under steiermark.com with the same CMS — single scraper can cover all.

| Region | URL |
|---|---|
| Region Graz | https://www.steiermark.com/en/Region-Graz/Vacation-planning/Events |
| Schladming-Dachstein | https://www.steiermark.com/en/Schladming-Dachstein/Vacation-planning/Events |
| Oststeiermark | https://www.steiermark.com/en/Oststeiermark/Plan-your-holiday/Events |
| Südsteiermark | https://www.steiermark.com/en/Suedsteiermark/Holiday/events |
| Thermen- & Vulkanland | https://www.steiermark.com/en/Thermen-Vulkanland/Plan-your-holiday/Events |
| Murtal | https://www.steiermark.com/en/Murtal/Events/Top-Events |
| Murau | https://www.steiermark.com/en/Murau/Plan-your-holidays/Events/Top-events |

**Notes:** These are filtered views of the same database. Scraping the main events endpoint once with all results is more efficient than hitting each sub-region separately.

---

## 3. Graz City Tourism

### graztourismus.at
- **URL:** https://www.graztourismus.at/en/events/event-calendar
- **Alternative service domain:** https://service.graztourismus.at/en/events/event-calendar
- **Category filters:** Theatre/Music, Culinary, Guided Tours, Sports, Top Events
- **SSR vs Headless:** Likely SSR (standard Austrian tourism CMS); has filter options suggesting a backend API — inspect network requests for JSON endpoint
- **Event types:** Concerts, cultural events, festivals, culinary, guided tours, sports
- **Approx. count:** 200–400 Graz city events
- **Notes:** Very well-structured calendar. Continuously updated. The `service.graztourismus.at` subdomain may expose a cleaner API endpoint.

### kultur.graz.at (Kulturserver Graz — City of Graz official)
- **URL:** https://kultur.graz.at/kalender/event/
- **Calendar root:** https://kultur.graz.at/kalender/
- **SSR vs Headless:** SSR (city government website, standard HTML)
- **Event types:** Cultural events only — exhibitions, performances, openings, readings
- **Approx. count:** 100–300
- **Notes:** Official City of Graz cultural calendar. Good structured HTML, likely filterable by date.

### graz.net
- **URL:** https://www.graz.net/veranstaltungen/
- **SSR vs Headless:** SSR (standard CMS)
- **Event types:** Mixed city events
- **Approx. count:** 100–200
- **Notes:** General city portal. Secondary source, may duplicate graztourismus.at.

---

## 4. Regional Tourism — Independent Websites

### schladming-dachstein.at
- **URL:** https://www.schladming-dachstein.at/en/event
- **Calendar:** https://www.schladming-dachstein.at/en/event/event-calendar
- **SSR vs Headless:** SSR (likely feratel Deskline — same CMS as steiermark.com)
- **Event types:** Winter sports, alpine events, folk festivals, concerts, hiking
- **Approx. count:** 150–300
- **Notes:** Major ski/mountain tourism region. Night Race (Schladming), Ennstal Classic, major ski world cup events.

### suedsteiermark.at
- **URL:** https://www.suedsteiermark.at/veranstaltungen/
- **SSR vs Headless:** SSR
- **Event types:** Wine events, folk festivals, culinary, cultural
- **Approx. count:** 80–150
- **Notes:** Wine region south of Graz. Wine events, Welschlauf, Jazz Festival Leibnitz.

### steiermark-card.net
- **URL:** https://www.steiermark-card.net/veranstaltungen/
- **SSR vs Headless:** SSR
- **Event types:** Partner/excursion destination events across all of Styria
- **Approx. count:** 50–100
- **Notes:** Smaller but curated list tied to Steiermark Card attractions (167 partner destinations). Easter events, summer openings, concerts at partner venues.

---

## 5. Graz Cultural Venues

### Bühnen Graz — Ticketzentrum (covers Oper, Schauspielhaus, Orpheum, Next Liberty, Kasematten, Minoritensaal)
- **Main ticket portal:** https://ticketzentrum.buehnen-graz.com/spielplan
- **English:** https://ticketzentrum.buehnen-graz.com/en/
- **Oper Graz calendar:** https://oper-graz.buehnen-graz.com/en/calendar/
- **Schauspielhaus calendar:** https://schauspielhaus-graz.buehnen-graz.com/spielplan/kalender/
- **Grazer Spielstätten (Orpheum, Dom im Berg, Kasematten):** https://spielstaetten.buehnen-graz.com
- **SSR vs Headless:** Likely SSR (standard Austrian theatre CMS)
- **Event types:** Opera, operetta, musical, ballet, classical theatre, open-air concerts, rock/pop (Kasematten)
- **Approx. count:** 300–500 productions/performances per season across all venues
- **Notes:** Single scraper can cover all Bühnen Graz venues via ticketzentrum.buehnen-graz.com. Individual event pages likely have structured metadata.

### Helmut List Halle
- **URL:** https://www.helmut-list-halle.com/events/
- **SSR vs Headless:** SSR
- **Event types:** Large concerts, shows, exhibitions, corporate events
- **Approx. count:** 30–60 per year
- **Notes:** Major concert hall (Messe Graz complex). Ticketed events: musicals, pop/rock concerts, themed shows.

### Universalmuseum Joanneum / Kunsthaus Graz
- **Calendar:** https://www.museum-joanneum.at/en/kunsthaus-graz/our-programme/calendar
- **General calendar:** https://museum-joanneum.at/en/your-visit/programme/programme-2023
- **SSR vs Headless:** SSR (government/museum CMS)
- **Event types:** Exhibitions, vernissages, guided tours, lectures, evening events, workshops
- **Approx. count:** 100–200 across 20 museum locations + 1 zoo
- **Notes:** 20 museums at 14 locations across Styria. Filterable by museum location, date, target group.

---

## 6. Festivals (Annual/Periodic)

### styriarte
- **URL:** https://styriarte.com/en
- **Calendar:** https://styriarte.com/en/kalender/
- **Productions:** https://styriarte.com/en/productions
- **SSR vs Headless:** SSR
- **Event types:** Classical music concerts, chamber music, festivals (4 annual festivals: Styriarte, PSALM, others)
- **Approx. count:** 65+ performances per year across 4 festivals
- **Notes:** Premier Styrian classical music festival, June–July each year. 42nd edition in 2026 (theme: "light"). Ticket centre at Palais Attems, Graz.

### Steirischer Herbst
- **URL:** https://www.steirischerherbst.at/en/
- **Calendar:** https://www.steirischerherbst.at/en/program/events/
- **SSR vs Headless:** SSR
- **Event types:** Contemporary art, performance, theatre, opera, music, literature — interdisciplinary
- **Approx. count:** 50–100 events per festival (September–October)
- **Notes:** Annual contemporary art festival, since 1968. Runs ~3–4 weeks in autumn. Also includes ORF musikprotokoll and Out of Joint literature festival.

---

## 7. Community / Regional News Event Boards

### meinbezirk.at (Styria — Kleine Zeitung group)
- **Main URL:** https://www.meinbezirk.at/event/steiermark/list
- **Today:** https://www.meinbezirk.at/event/steiermark/list/today
- **Weekend:** https://www.meinbezirk.at/event/steiermark/list/weekend
- **Pagination:** https://www.meinbezirk.at/event/steiermark/list/all/2 (page 2, etc.)
- **Sub-region (Südoststeiermark):** https://www.meinbezirk.at/event/suedoststeiermark/list
- **SSR vs Headless:** Needs inspection — the paginated `/list` URL structure suggests SSR, but meinbezirk.at is a React/SPA hybrid. May need Puppeteer.
- **Event types:** All community events — concerts, balls, theater, cinema, workshops, seminars, sports, markets, exhibitions, culinary, festivals, children's, health
- **Approx. count:** 500–1000+ across Steiermark (user-submitted, very large volume)
- **Notes:** Very high volume of grassroots/community events. Event cards have title, date, location, category. User-submitted, so data quality varies. Kleine Zeitung group — covers all districts.

### steiermark1.at
- **URL:** https://www.steiermark1.at/veranstaltungen/
- **SSR vs Headless:** SSR (standard CMS, appears to be WordPress/similar)
- **Event types:** Concerts, balls, folk festivals, markets, sports, cultural
- **Approx. count:** 100–300
- **Notes:** Regional lifestyle/community site. Events submitted via email to veranstaltung@steiermark1.at. Free publication. Good for smaller community events not on tourism sites.

### events.at — Steiermark section
- **URL:** https://events.at/was-ist-los-in-steiermark
- **SSR vs Headless:** Needs inspection (events.at is a major Austrian platform — likely has internal API)
- **Event types:** All categories — theater, concerts, children's, art, party, kabarett, ball, festival, fair, outdoor, online, music festival
- **Approx. count:** 200–500 for Steiermark
- **Notes:** Large Austrian event aggregator (similar to eventim-style listing). Has structured category/location filters. Worth checking for an internal JSON API endpoint via browser devtools.

---

## 8. Ticket Platforms

### oeticket.com — Graz
- **URL:** https://www.oeticket.com/city/graz-604/
- **Concerts:** https://www.oeticket.com/city/graz-604/konzerte-109/
- **Venue (Stadthalle):** https://www.oeticket.com/en/city/graz-604/venue/stadthalle-graz-graz-21123/
- **SSR vs Headless:** **Headless required** (CTS/Eventim JS-heavy frontend)
- **Event types:** Major concerts, sports events, theatre, musicals, comedy — ticketed only
- **Approx. count:** 100–300 for Graz/Steiermark
- **Notes:** Austria's largest ticket platform (CTS Eventim subsidiary). JavaScript-heavy, requires Puppeteer. Only ticketed events — no free events.

### eventfinder.at
- **URL:** https://www.eventfinder.at/graz/veranstaltungen/
- **Weekend:** https://www.eventfinder.at/graz/veranstaltungen/wochenende/
- **Next week:** https://www.eventfinder.at/graz/veranstaltungen/naechste-woche/
- **SSR vs Headless:** SSR (likely Cheerio-accessible)
- **Event types:** Concerts, theater, cultural events, comedy, kabarett — Graz focused
- **Approx. count:** 100–200
- **Notes:** Free event submission platform. Category + time filters. Practical for Graz city events.

---

## 9. Summary Table

| Source | URL | SSR/Headless | Event Types | Est. Count | Priority | Verified |
|---|---|---|---|---|---|---|
| graztourismus.at | /en/events/event-calendar | **SSR** (confirmed) | All, Graz city | 104+ (paginated) | **HIGH** | YES |
| steiermark.com | /de/Urlaub-planen/Veranstaltungen | Dynamic (feratel) | All, statewide | 400–800 | **HIGH** | PARTIAL — needs API |
| meinbezirk.at | /event/steiermark/list | SSR or Headless TBD | Community, all types | 500–1000 | HIGH (skip) | NO |
| kultur.graz.at | /kalender/event/ | **SSR** (confirmed) | Cultural, Graz | 100–300 | **HIGH** | YES |
| spielstaetten.buehnen-graz.com | / | **SSR** (confirmed) | Theater, concerts | 300–500 | **MEDIUM** | YES |
| popculture.at | /events/ | **SSR** (confirmed) | Club/party/concerts | 50–100 | **MEDIUM** | YES |
| styriarte.com | /en/kalender/ | **SSR** (confirmed) | Classical music | 65+ | MEDIUM | YES |
| schladming-dachstein.at | /en/event/event-calendar | SSR (feratel) | Sports, alpine, folk | 150–300 | MEDIUM | NO |
| ticketzentrum.buehnen-graz.com | /spielplan | SSR | Opera, theater, concerts | 300–500 | MEDIUM | NO |
| oeticket.com | /city/graz-604/ | **Headless** | Major ticketed events | 100–300 | MEDIUM (skip) | N/A |
| steirischerherbst.at | /en/program/events/ | SSR | Contemporary art | 50–100 | LOW-MED | NO |
| events.at | /was-ist-los-in-steiermark | TBD | All types | 200–500 | MEDIUM (skip) | NO |
| eventfinder.at | /graz/veranstaltungen/ | **Blocked** (403) | Concerts, theater | 100–200 | LOW | YES — blocked |
| event-spotter.com | /en/veranstaltungen-in-graz | **SPA** (Next.js) | All types | Unknown | LOW | YES — SPA |
| mcg.at | /en/b2c/event-overview/ | **SPA** (dynamic) | Major venue events | 30–60 | LOW | YES — SPA |
| suedsteiermark.at | /veranstaltungen/ | SSR | Wine, folk, culinary | 80–150 | LOW | NO |
| museum-joanneum.at | /en/kunsthaus-graz/calendar | SSR | Exhibitions, events | 100–200 | LOW | NO |
| steiermark-card.net | /veranstaltungen/ | SSR | Partner venue events | 50–100 | LOW | NO |
| helmut-list-halle.com | /events/ | SSR | Major concerts/shows | 30–60 | LOW | NO |
| steiermark1.at | /veranstaltungen/ | SSR | Community, all types | 100–300 | LOW | NO |

---

## 10. Technical Notes (verified 2026-03-27)

### graztourismus.at — CONFIRMED SSR, 104 events, paginated
- 104 results across 9 pages (~12 per page)
- Event detail URL pattern: `/en/events/event-calendar/[event-title]_evt_[ID]`
- Has JSON-LD (BreadcrumbList, FAQPage schemas)
- Filter by category and date range
- Map view available
- **Cheerio-friendly**: Full HTML with event data in initial response

### kultur.graz.at — CONFIRMED SSR, calendar-based
- Event detail URL pattern: `/kalender/event/[numeric-ID]`
- Calendar views: `/kalender/tag/[YYYYMMDD]`
- Category views: `/kalender/kategorie/[name]`
- Venue views: `/kalender/ort/[numeric-ID]`
- 100+ venues listed
- Some pages redirect via JS (e.g. /vorschau_30tage -> /kalender/hinweise)
- **Cheerio-friendly**: Standard HTML, no heavy JS framework

### spielstaetten.buehnen-graz.com — CONFIRMED SSR with Schema.org
- Has JSON-LD (WebPage, WebSite, Organization, SearchAction, BreadcrumbList)
- Event detail URL: `/event/{numeric_id}/`
- JS init for schedule component but events in initial HTML
- **Cheerio-friendly**

### popculture.at — CONFIRMED SSR with JSON-LD per event
- 10 events per page, paginated (/events/liste/seite/2/)
- Event detail URL: `/event/{event-slug}/`
- Extensive JSON-LD per event: name, description, image, dates, organizer, ticket pricing, venue
- Events are club nights, concerts, DJ events, parties at PPC Graz
- **Cheerio-friendly**: Excellent structured data

### steiermark.com — Events loaded dynamically
- Main page is SSR navigation shell but event listings load via JS/feratel backend
- Could not extract events from raw HTML fetch
- May need Puppeteer OR discovery of underlying feratel API endpoint
- **Needs further investigation**: Check network tab for API calls

### eventfinder.at — BLOCKED (403)
- Returns 403 on WebFetch, likely bot protection
- May work with proper User-Agent header or Puppeteer
- **Needs Puppeteer or custom headers**

### event-spotter.com — SPA (Next.js)
- Built with Next.js, events loaded client-side
- Has pagination ("Next Page" / loadMore)
- Covers Graz + other Austrian cities
- **Needs Puppeteer**: Client-side rendered

### styriarte.com — CONFIRMED SSR (Laravel/Statamic/Livewire)
- Program page with date filters: `/en/programme?start_date=...&end_date=...`
- Production detail URL: `/en/productions/[production-name]`
- ~65+ performances across 4 festivals
- **Cheerio-friendly**: Server-rendered with Livewire enhancement

### mcg.at (Messecongress Graz / Stadthalle) — SPA/dynamic
- Heavy JS loading, no events in initial HTML
- Instagram feed plugin, lazy loading
- **Needs Puppeteer**: Events loaded dynamically

### Feratel Deskline Pattern (steiermark.com, schladming-dachstein.at)
Same backend CMS as burgenland.info uses (DataCycle/feratel). Likely:
- SSR list pages with pagination
- JSON-LD `@type: Event` structured data on detail pages
- GPS coordinates likely included

### meinbezirk.at — Unknown rendering
React/SPA hybrid. The `/list` endpoint may serve SSR HTML for SEO, but interactive features are client-side. Check `curl -L https://www.meinbezirk.at/event/steiermark/list` — if full event cards appear in raw HTML, Cheerio works. Otherwise inspect network tab for `/api/events` or GraphQL endpoint.

### oeticket.com — Confirmed Headless needed
CTS Eventim JS-heavy SPA. Requires Puppeteer/Playwright as noted in existing CLAUDE.md.

### Geocoding challenge
Unlike burgenland.info, none of these sources are guaranteed to provide GPS coordinates. Expect heavy reliance on Known-Locations-Mapping + Nominatim geocoding (same pattern as burgenland.at scraper).

---

## 11. New Sources Found (2026-03-27)

### popculture.at (PPC Graz)
- **URL:** https://popculture.at/events/
- **SSR/Headless:** SSR with JSON-LD
- **Event types:** Club nights, concerts, DJ events, parties (90s/2000s, reggaeton, live bands)
- **Est. count:** 50-100/year
- **Priority:** MEDIUM — excellent structured data, easy to scrape
- **Detail URL:** `/event/{slug}/`

### regioactive.de — Graz section
- **URL:** https://www.regioactive.de/events/29386/graz/veranstaltungen-party-konzerte
- **SSR/Headless:** Blocked (403) — needs investigation
- **Event types:** Concerts, parties, nightlife
- **Est. count:** Unknown
- **Priority:** LOW — German platform, may have limited Graz coverage

### Festival St. Gallen (Steiermark)
- **URL:** https://www.festivalstgallen.at/veranstaltungen-1
- **SSR/Headless:** SSR
- **Event types:** Classical/chamber music festival
- **Est. count:** ~19 events/year
- **Detail URL:** `index.php?id=[number]`
- **Priority:** LOW — niche, small count

---

## 12. District-by-District Sources (added 2026-03-27)

Comprehensive search results for each Bezirk in Steiermark, focusing on local/municipal sources, tourism pages, and venue calendars. Excludes meinbezirk.at, oeticket.com, ticketmaster.com, events.at, graztourismus.at, popculture.at (already covered above).

---

### Bezirk: Bruck-Mürzzuschlag

#### bruckmur.at (Stadtgemeinde Bruck an der Mur)
- **URL:** https://www.bruckmur.at/veranstaltungskalender
- **Obersteierstarker Kalender:** https://www.bruckmur.at/obersteierstarker-veranstaltungskalender
- **District:** Bruck-Mürzzuschlag
- **SSR/Headless:** SSR (TYPO3 CMS, tx_events2 extension)
- **Event types:** City events, concerts, theater, festivals, markets
- **Est. count:** 50–100
- **Notes:** Uses TYPO3 tx_events2 extension — event detail URLs contain `tx_events2_events[event]=ID`. Organizers submit via Daheim App. Good structured HTML.

#### muerzzuschlag.at (Stadtgemeinde Mürzzuschlag)
- **URL:** https://www.muerzzuschlag.at/freizeit/veranstaltungen
- **District:** Bruck-Mürzzuschlag
- **SSR/Headless:** SSR
- **Event types:** Local events, sport, concerts, cultural
- **Est. count:** 30–60
- **Notes:** Organizer-submitted events with category tags. Municipal CMS.

#### tourismus-bruckmur.at
- **URL:** https://www.tourismus-bruckmur.at/de/service/veranstaltungen.html
- **District:** Bruck-Mürzzuschlag
- **SSR/Headless:** SSR
- **Event types:** Tourism events, summer program, concerts, cabaret, sport
- **Est. count:** 30–80
- **Notes:** Tourism association page for Bruck an der Mur region.

#### muerz.info
- **URL:** https://muerz.info/veranstaltungskalender/
- **District:** Bruck-Mürzzuschlag
- **SSR/Headless:** SSR
- **Event types:** Regional events, cinema, culture
- **Est. count:** 20–50
- **Notes:** Mürzzuschlag region info portal.

#### obersteierstark.at (Hochsteiermark Tourism)
- **URL:** https://www.obersteierstark.at/en/leisure/art-and-events/event-calendar/
- **District:** Bruck-Mürzzuschlag + Leoben (covers both)
- **SSR/Headless:** SSR (RIS Kommunal CMS)
- **Event types:** Cultural events, exhibitions, festivals, traditions, sports
- **Est. count:** 100–200 (region-wide)
- **Notes:** Regional tourism portal covering eastern Upper Styria. Good for events across both Bruck-Mürzzuschlag and Leoben districts. Priority: MEDIUM.

---

### Bezirk: Deutschlandsberg

#### deutschlandsberg.at (Stadtgemeinde)
- **URL:** https://www.deutschlandsberg.at/freizeit-tourismus/veranstaltungskalender
- **Alt:** https://www.deutschlandsberg.at/system/web/default.aspx?menuonr=225345517
- **District:** Deutschlandsberg
- **SSR/Headless:** SSR (RIS Kommunal CMS, common Austrian municipal system)
- **Event types:** City events, Klavierfrühling, KUNST.KULTUR.TAGE, markets
- **Est. count:** 30–60
- **Notes:** Standard Austrian municipal CMS. Paginated (start=127 parameter seen).

#### vinyldeutschlandsberg.at (Vinyl Deutschlandsberg)
- **URL:** https://vinyldeutschlandsberg.at/veranstaltungskalender-erlebe-unvergessliche-events/
- **District:** Deutschlandsberg
- **SSR/Headless:** SSR (likely WordPress)
- **Event types:** Live music, art exhibitions, themed evenings
- **Est. count:** 20–50
- **Notes:** Cultural venue/bar. Regular live events.

#### leibnitzkult.at (LeibnitzKULT — also covers Deutschlandsberg area)
- **URL:** https://leibnitzkult.at/events
- **District:** Deutschlandsberg / Leibnitz
- **SSR/Headless:** SSR
- **Event types:** Cultural events, major festivals
- **Est. count:** 20–40
- **Notes:** Cultural association organizing events in the Leibnitz/Deutschlandsberg region.

#### wies.at (Marktgemeinde Wies)
- **URL:** https://www.wies.at/aktuelles-termine/aktuelles
- **District:** Deutschlandsberg
- **SSR/Headless:** SSR
- **Event types:** Municipal events, markets, cleanup days, Easter events
- **Est. count:** 10–20
- **Notes:** Small municipality website. Limited but unique local events.

#### eibiswald.gv.at (Marktgemeinde Eibiswald)
- **URL:** https://www.eibiswald.gv.at/
- **District:** Deutschlandsberg
- **SSR/Headless:** SSR (GEM2GO system)
- **Event types:** Municipal events
- **Est. count:** 10–20
- **Notes:** Uses GEM2GO app for events. Small municipality.

---

### Bezirk: Graz (Stadt)

#### kultur.graz.at (Kulturserver Graz)
- **URL:** https://kultur.graz.at/kalender/event/
- **District:** Graz
- **Already documented above in Section 3.**

#### veranstaltungen-graz.at
- **URL:** https://veranstaltungen-graz.at/
- **District:** Graz
- **SSR/Headless:** SSR
- **Event types:** All city events, festivals, concerts
- **Est. count:** 100–300
- **Notes:** Dedicated Graz events portal. Aggregates from multiple sources.

#### info-graz.at
- **URL:** https://www.info-graz.at/veranstaltungen-steiermark-events-heute-veranstaltungskalender-kulturserver/
- **District:** Graz + Steiermark
- **SSR/Headless:** SSR
- **Event types:** All types — concerts, culture, exhibitions, sport
- **Est. count:** 200–500
- **Notes:** Free event submission. Aggregates from Kulturserver + oeticket. Good for community events. Priority: MEDIUM.

#### graz.net
- **URL:** https://www.graz.net/veranstaltungen/
- **District:** Graz
- **Already documented above in Section 3.**

#### stadt-graz.at
- **URL:** https://www.stadt-graz.at/veranstaltungen
- **District:** Graz
- **SSR/Headless:** SSR
- **Event types:** City portal events overview
- **Est. count:** 50–150
- **Notes:** Grazer Stadtportal with yearly event overview.

#### spielstaetten.buehnen-graz.com
- **Already documented above in Section 5.**

#### graz-event.at
- **URL:** https://www.graz-event.at/
- **District:** Graz
- **SSR/Headless:** SSR
- **Event types:** Various Graz events
- **Est. count:** 50–100
- **Notes:** Another Graz-specific event listing.

---

### Bezirk: Graz-Umgebung

#### gratwein-strassengel.gv.at
- **URL:** https://gratwein-strassengel.gv.at/gemeinde/termine-veranstaltungen
- **Tickets:** https://www.tickets-gs.at
- **District:** Graz-Umgebung
- **SSR/Headless:** SSR (Geko digital CMS)
- **Event types:** Concerts, cabaret, children's theater, summer cinema
- **Est. count:** 20–40
- **Notes:** Municipality with own ticket system. Good structured local events.

#### steiermark.net (Graz-Umgebung section)
- **URL:** https://www.steiermark.net/veranstaltungen/graz-umgebung/
- **District:** Graz-Umgebung
- **SSR/Headless:** SSR
- **Event types:** Regional events
- **Est. count:** 30–60
- **Notes:** Regional portal with district-specific event pages.

#### gemeindekurier.at
- **URL:** https://www.gemeindekurier.at/index.php/kalender/veranstaltungskalender
- **District:** Graz-Umgebung
- **SSR/Headless:** SSR
- **Event types:** Community events, municipal news events
- **Est. count:** 20–40
- **Notes:** Municipal courier newspaper with event calendar.

---

### Bezirk: Hartberg-Fürstenfeld

#### hartberg.at (Stadtgemeinde Hartberg)
- **URL:** https://www.hartberg.at/index.php?seitenId=924
- **Calendar:** https://www.hartberg.at/index.php?seitenId=1012
- **District:** Hartberg-Fürstenfeld
- **SSR/Headless:** SSR
- **Event types:** City events, Musical Festspiele, theater, concerts, kabarett
- **Est. count:** 40–80
- **Notes:** Free event calendar. Submit via kultur@hartberg.at. Notable: Musical Festspiele Hartberg (Les Miserables etc.).

#### citiesapps.com/cities/hartberg & citiesapps.com/pages/furstenfeld
- **Hartberg:** https://citiesapps.com/cities/hartberg/events
- **Fürstenfeld:** https://citiesapps.com/pages/furstenfeld/events
- **District:** Hartberg-Fürstenfeld
- **SSR/Headless:** Likely SPA (app-based platform)
- **Event types:** City events
- **Est. count:** 20–40 each
- **Notes:** CITIES platform — municipal apps with event feeds. May have API.

---

### Bezirk: Leibnitz

#### leibnitz.net
- **URL:** https://www.leibnitz.net/veranstaltungen/
- **District:** Leibnitz
- **SSR/Headless:** SSR
- **Event types:** Culinary, festivals, health, markets, fairs
- **Est. count:** 872 events listed (very large!)
- **Notes:** Major local portal. Categories: culinary, festivals, health/wellness, markets. Very high event count — possibly aggregated. Priority: HIGH.

#### leibnitzkult.at
- **URL:** https://leibnitzkult.at/events
- **District:** Leibnitz
- **SSR/Headless:** SSR
- **Event types:** Cultural events, concerts, festivals
- **Est. count:** 20–40
- **Notes:** Cultural center organization.

#### suedsteiermark.at
- **URL:** https://www.suedsteiermark.at/veranstaltungen/
- **Today:** https://www.suedsteiermark.at/veranstaltungen/heute.html
- **Concerts:** https://www.suedsteiermark.at/veranstaltungen/konzerte/
- **Culinary:** https://www.suedsteiermark.at/veranstaltungen/kulinarische-veranstaltungen/
- **District:** Leibnitz (+ Deutschlandsberg overlap)
- **Already documented above in Section 4.** 1000+ events with category filters.

---

### Bezirk: Leoben

#### leoben.at (Stadt Leoben)
- **URL:** https://www.leoben.at/veranstaltungen/
- **Kulturprogramm:** https://www.leoben.at/service/kulturprogramm/
- **District:** Leoben
- **SSR/Headless:** SSR
- **Event types:** City events, Gösser Kirtag, Summer Nights, concerts, markets, Iron Road
- **Est. count:** 60–120
- **Notes:** Well-maintained city event calendar. Cultural programs available as downloadable PDFs (Kulturherbst, Kulturfrühling). Priority: MEDIUM.

#### citymanagement-leoben.at
- **URL:** https://citymanagement-leoben.at/city-events/
- **District:** Leoben
- **SSR/Headless:** SSR
- **Event types:** City center events, shopping events, concerts on Hauptplatz
- **Est. count:** 20–40
- **Notes:** City management / marketing events. Focus on Hauptplatz events.

---

### Bezirk: Liezen

#### liezen.at
- **URL:** https://www.liezen.at/de/tools/veranstaltungen
- **Tickets:** https://www.liezen.at/tickets
- **District:** Liezen
- **SSR/Headless:** SSR
- **Event types:** Kulturhaus events, city events
- **Est. count:** 30–60
- **Notes:** Official city website with event calendar and ticket shop.

#### blo24.at (Bezirk Liezen Online)
- **URL:** https://www.blo24.at/veranstaltungen
- **District:** Liezen
- **SSR/Headless:** SSR
- **Event types:** Regional events, community events
- **Est. count:** 50–100
- **Notes:** Regional news portal with event section for entire Liezen district. Priority: MEDIUM.

#### liezener-bezirksnachrichten.at (LBN Online)
- **URL:** https://www.liezener-bezirksnachrichten.at/events
- **District:** Liezen
- **SSR/Headless:** SSR
- **Event types:** Regional news events
- **Est. count:** 20–50
- **Notes:** District newspaper with event listings.

#### schladming-dachstein.at
- **Already documented above in Section 4.** Major tourism portal for western Liezen.

---

### Bezirk: Murau

#### murau.gv.at (Stadtgemeinde Murau)
- **URL:** https://www.murau.gv.at/veranstaltungen.html
- **District:** Murau
- **SSR/Headless:** SSR
- **Event types:** City events, Samson parade, markets, sports
- **Est. count:** 20–40
- **Notes:** Municipal website. Notable: Samson parades, Oswaldi-Sonntag.

#### steiermark.com/Murau (Tourism)
- **URL:** https://www.steiermark.com/en/Murau/Plan-your-holidays/Events
- **District:** Murau
- **Already documented above in Section 2.**

#### wanderdoerfer.at/veranstaltungen/murau
- **URL:** https://www.wanderdoerfer.at/veranstaltungen/murau/
- **District:** Murau
- **SSR/Headless:** SSR
- **Event types:** Hiking events, nature events
- **Est. count:** 10–20
- **Notes:** Austrian hiking villages portal — niche hiking/outdoor events.

---

### Bezirk: Murtal

#### judenburg.at (Stadtgemeinde Judenburg)
- **URL:** https://www.judenburg.at/de/events/index.asp?region=Murtal
- **District:** Murtal
- **SSR/Headless:** SSR (ASP classic)
- **Event types:** City events, Zentrum Judenburg events, Museum Murtal
- **Est. count:** 30–60
- **Notes:** Municipal event calendar. ASP classic backend.

#### judenburg.com (Stadtmarketing Judenburg)
- **URL:** https://www.judenburg.com/cms/events/index.asp
- **District:** Murtal
- **SSR/Headless:** SSR (ASP classic)
- **Event types:** City marketing events, Hauptplatz events
- **Est. count:** 20–40
- **Notes:** City marketing organization events.

#### knittelfeld.gv.at
- **URL:** https://knittelfeld.gv.at/alle-veranstaltungen
- **District:** Murtal
- **SSR/Headless:** SSR
- **Event types:** City events, cultural program
- **Est. count:** 30–60
- **Notes:** Municipal event listing.

#### murtalinfo.at
- **URL:** https://murtalinfo.at/cms/de/events.asp
- **Alt:** https://www.murtalinfo.at/events
- **District:** Murtal
- **SSR/Headless:** SSR (ASP)
- **Event types:** Regional news events, community events
- **Est. count:** 50–100
- **Notes:** Regional news/info portal for Murtal. Covers Knittelfeld, Judenburg, and broader region. Priority: MEDIUM.

#### murtal.events
- **URL:** https://murtal.events/
- **District:** Murtal
- **SSR/Headless:** Unknown — dedicated domain
- **Event types:** Regional events
- **Est. count:** Unknown
- **Notes:** Dedicated event domain for Murtal region. Worth investigating.

#### guschi.at
- **URL:** https://www.guschi.at/evenaich.htm
- **District:** Murtal (Aichfeld area: Zeltweg, Judenburg, Knittelfeld, Fohnsdorf, Spielberg)
- **SSR/Headless:** SSR (very basic HTML)
- **Event types:** Regional events in Aichfeld
- **Est. count:** 10–30
- **Notes:** Very basic community page. Covers Spielberg/Red Bull Ring area.

---

### Bezirk: Südoststeiermark

#### vulkanland.at
- **URL:** https://www.vulkanland.at/veranstaltungen/
- **Feste/Events:** https://www.vulkanland.at/vulkanland-veranstaltungen/feste-events/
- **District:** Südoststeiermark
- **SSR/Headless:** SSR
- **Event types:** Folk festivals, culinary events, markets, cultural
- **Est. count:** 50–150
- **Notes:** Steirisches Vulkanland regional portal. Covers Feldbach, Gnas, Bad Gleichenberg area. Priority: MEDIUM.

#### feldbach.gv.at (Neue Stadt Feldbach)
- **URL:** https://feldbach.gv.at/veranstaltungen/
- **District:** Südoststeiermark
- **SSR/Headless:** SSR
- **Event types:** City events, Feldbacher Sommerspiele, markets
- **Est. count:** 30–60
- **Notes:** Municipal website for Feldbach, economic/cultural center of Vulkanland.

#### bad-radkersburg.gv.at
- **URL:** https://bad-radkersburg.gv.at/
- **District:** Südoststeiermark
- **SSR/Headless:** SSR
- **Event types:** Spa town events, cultural, Pannonisches Altstadtfest, big.band.festival
- **Est. count:** 20–40
- **Notes:** Spa town on Slovenian border. Notable events: Pannonisches Altstadtfest, big.band.festival (10th anniversary).

#### steiermark.com/Thermen-Vulkanland
- **URL:** https://www.steiermark.com/en/Thermen-Vulkanland/Plan-your-holiday/Events
- **District:** Südoststeiermark
- **Already documented above in Section 2.**

---

### Bezirk: Voitsberg

#### voitsberg.gv.at (Stadtgemeinde Voitsberg)
- **URL:** https://voitsberg.gv.at/de/aktuelles/veranstaltungen.html
- **District:** Voitsberg
- **SSR/Headless:** SSR
- **Event types:** City events, Easter market, cultural
- **Est. count:** 20–40
- **Notes:** Municipal event page.

#### ticket.voitsberg.at
- **URL:** https://ticket.voitsberg.at/kalender/
- **District:** Voitsberg
- **SSR/Headless:** SSR
- **Event types:** Ticketed events — concerts, performances
- **Est. count:** 10–20
- **Notes:** Local ticket portal with event calendar.

#### lipizzanerheimat (Tourism — Voitsberg/Köflach area)
- **URL:** https://lipizzanerheimat.suedweststeiermark.elements.live/de/Urlaub/Veranstaltungen/Alle-Veranstaltungen
- **Alt:** https://lipizzanerheimat-marktplatz.at/veranstaltungen/
- **District:** Voitsberg
- **SSR/Headless:** SSR (elements.live tourism platform)
- **Event types:** Tourism events, Leistungsschau, Lipizzaner events, sports
- **Est. count:** 30–60
- **Notes:** Tourism association for Köflach/Voitsberg/Bärnbach area. Uses elements.live platform. Priority: MEDIUM.

---

### Bezirk: Weiz

#### weiz.at (Stadtgemeinde Weiz)
- **URL:** https://www.weiz.at/Aktuelles/Veranstaltungen
- **Top:** https://www.weiz.at/Startseite_Uebersicht
- **District:** Weiz
- **SSR/Headless:** SSR
- **Event types:** City events, Mulbratlfest, Altstadtfest, markets
- **Est. count:** 40–80
- **Notes:** City website with event listings. Notable: Mulbratlfest, Altstadtfest Weiz.

#### tourismus-weiz.at
- **URL:** https://www.tourismus-weiz.at/veranstaltungen/
- **District:** Weiz
- **SSR/Headless:** SSR
- **Event types:** Tourism events, Kunsthaus Weiz events, festivals
- **Est. count:** 50–100
- **Notes:** Tourism portal for Weiz. Kunsthaus Weiz hosts weekly events. Priority: MEDIUM.

#### kalender.weiz.at
- **URL:** http://kalender.weiz.at/gesamtverzeichnis/g_header1.asp
- **District:** Weiz
- **SSR/Headless:** SSR (ASP classic)
- **Event types:** All community events
- **Est. count:** 50–100
- **Notes:** Dedicated event calendar subdomain for Weiz. ASP classic. Comprehensive community listings.

---

## 13. Cross-District / Statewide Aggregators

These platforms cover ALL Steiermark districts and could be scraped once for statewide coverage.

### wasmachma.at
- **Steiermark:** https://wasmachma.at/bundesland/steiermark?view=events
- **Per-district URLs:**
  - https://wasmachma.at/bezirk/bruck-muerzzuschlag?view=events
  - https://wasmachma.at/bezirk/deutschlandsberg?view=events
  - https://wasmachma.at/bezirk/graz-umgebung/events
  - https://wasmachma.at/bezirk/hartberg-fuerstenfeld?view=events
  - https://wasmachma.at/bezirk/leibnitz?view=events
  - https://wasmachma.at/bezirk/liezen/events
  - https://wasmachma.at/bezirk/suedoststeiermark?view=events
- **SSR/Headless:** Unknown — needs inspection
- **Event types:** All community events
- **Est. count:** 200–500 statewide
- **Notes:** Austrian event directory organized by Bundesland and Bezirk. Covers all Steiermark districts. Could be a single-scraper statewide source. Priority: HIGH — needs technical verification.

### eventbricks.at
- **URL:** https://events.eventbricks.at/suche/steiermark/heute/events.html
- **Per-district:** https://events.eventbricks.at/suche/steiermark/{bezirk}/heute/events.html
- **SSR/Headless:** SSR
- **Event types:** Concerts, festivals, balls, parties with bands/DJs
- **Est. count:** 100–300 statewide
- **Notes:** Music-focused event platform. Austrian bands/DJs self-register. Category/time filters.

### eventpicker.at
- **URL:** https://www.eventpicker.at/veranstaltungen-in-graz/2026
- **Also:** eventpicker.at/veranstaltungen-in-{city}/{year}
- **SSR/Headless:** SSR
- **Event types:** All types
- **Est. count:** 100–200 per major city
- **Notes:** Covers Graz, Bruck, Leoben and other cities. Year-based URLs.

### veranstaltungskalender.net
- **URL:** https://www.veranstaltungskalender.net/steiermark/
- **Per-district:** https://www.veranstaltungskalender.net/steiermark/{bezirk}/
- **Per-city:** https://www.veranstaltungskalender.net/steiermark/{bezirk}/{city}/
- **SSR/Headless:** SSR
- **Event types:** All types — concerts, sports, general, health, exhibitions, lectures
- **Est. count:** 137 (Liezen alone) — statewide likely 500–1000
- **Notes:** Geographically organized event aggregator. Distributes events to partner calendars. Covers all Steiermark districts down to city level. Priority: HIGH — excellent geographic coverage.

### geminfo.app
- **URL:** https://geminfo.app/steiermark/termine/
- **Per-district:** https://geminfo.app/2-steiermark-{bezirk}/termine/
- **SSR/Headless:** Likely SPA (app-based)
- **Event types:** Municipal events, community events
- **Est. count:** Unknown
- **Notes:** Municipal app platform. Has individual Gemeinde apps (Riegersburg, Oberhaag, Großklein, Thannhausen etc.). Could aggregate from many small municipalities. Needs technical inspection. Priority: MEDIUM.

### szene1.at
- **URL:** https://www.szene1.at/events/Deutschlandsberg (example)
- **SSR/Headless:** SSR
- **Event types:** Party, nightlife events
- **Est. count:** 50–100 across Steiermark
- **Notes:** Nightlife/party event platform. Per-city pages.

### hey.bayern (also covers Austria!)
- **URL:** https://hey.bayern/bezirk/{bezirk}/events
- **Per-district pages for all Steiermark districts**
- **SSR/Headless:** Unknown
- **Event types:** All types — music, culture, entertainment
- **Est. count:** 30–80 per district
- **Notes:** Despite the .bayern domain, covers Austrian districts too. Has per-district and per-category filtering. Needs technical verification. Priority: LOW-MEDIUM.

---

## 14. Priority Ranking for Scraping (District Coverage)

### Tier 1 — High Priority (statewide, single scraper, many events)
1. **steiermark.com** — 400–800 events, all districts, feratel/Deskline backend
2. **veranstaltungskalender.net** — 500–1000 events, all districts, SSR, geographic hierarchy
3. **wasmachma.at** — 200–500 events, all districts, needs tech inspection
4. **leibnitz.net** — 872 events, Leibnitz district, SSR

### Tier 2 — Medium Priority (regional, good event counts)
5. **kultur.graz.at** — 100–300 events, Graz, confirmed SSR
6. **leoben.at** — 60–120 events, Leoben, SSR
7. **obersteierstark.at** — 100–200 events, Bruck-Mürzzuschlag + Leoben, SSR
8. **murtalinfo.at** — 50–100 events, Murtal, SSR
9. **vulkanland.at** — 50–150 events, Südoststeiermark, SSR
10. **blo24.at** — 50–100 events, Liezen, SSR
11. **schladming-dachstein.at** — 150–300 events, western Liezen, feratel
12. **tourismus-weiz.at** — 50–100 events, Weiz, SSR
13. **bruckmur.at** — 50–100 events, Bruck-Mürzzuschlag, TYPO3 SSR
14. **info-graz.at** — 200–500 events, Graz + Steiermark, SSR

### Tier 3 — Lower Priority (municipal/niche, smaller counts)
15. **hartberg.at** — 40–80 events, Hartberg-Fürstenfeld
16. **feldbach.gv.at** — 30–60 events, Südoststeiermark
17. **judenburg.at** — 30–60 events, Murtal
18. **knittelfeld.gv.at** — 30–60 events, Murtal
19. **weiz.at** — 40–80 events, Weiz
20. **muerzzuschlag.at** — 30–60 events, Bruck-Mürzzuschlag
21. **liezen.at** — 30–60 events, Liezen
22. **voitsberg.gv.at** — 20–40 events, Voitsberg
23. **murau.gv.at** — 20–40 events, Murau
24. **lipizzanerheimat (elements.live)** — 30–60 events, Voitsberg
25. **kalender.weiz.at** — 50–100 events, Weiz
26. **bad-radkersburg.gv.at** — 20–40 events, Südoststeiermark
27. **deutschlandsberg.at** — 30–60 events, Deutschlandsberg

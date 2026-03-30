# Austrian Tourism Regions - Event Portal Research

**Date:** 2026-03-29
**Goal:** Find all major Austrian tourism region event portals for potential scraping
**Status:** 48 regions researched

## Key Findings Summary

- **48 tourism regions** researched across all 9 Austrian states
- **~35 regions** have dedicated event calendars with significant event counts
- **Feratel TOSC5/Deskline** is the dominant platform (used by ~15 regions) -- JS-rendered, harder to scrape
- **TYPO3-based custom CMS** is second most common (Gastein, Woerthersee, etc.)
- **WordPress + DataCycle** used in Vorarlberg (Bregenzerwald)
- **Lower Austria** has a centralized portal (veranstaltungen.niederoesterreich.at) covering Wachau, Waldviertel, Weinviertel, Wienerwald, Semmering
- **steiermark.com** is a centralized portal covering ALL Steiermark sub-regions
- **Estimated total new events:** 15,000-25,000+ across all portals

## Platform Categories

### Feratel TOSC5 / Deskline (JS-rendered, needs Puppeteer or API)
These load events dynamically via JavaScript. NOT scrapable with Cheerio alone.
- Schladming-Dachstein (schladming-dachstein.at)
- Zillertal (zillertal.at)
- Salzburger Seenland (salzburger-seenland.at)
- Tennengau (tennengau.com)
- Zell am See-Kaprun (zellamsee-kaprun.com)
- Lungau (lungau.at)
- Innviertel (innviertel-tourismus.at)
- Seefeld (seefeld.com)
- Achensee (achensee.com)
- Nassfeld (nassfeld.at / nlw.at)
- Woerthersee (woerthersee.com) - TYPO3 + Deskline hybrid
- Steiermark.com (all Steiermark sub-regions)

### TYPO3-based Custom CMS (potentially scrapable with Cheerio + pagination)
- Gastein (gastein.com) - **2,552 events!** - TYPO3 + BookingEmo, AJAX pagination
- Kitzbühel (kitzbuehel.com) - TYPO3, SSR + JS pagination, **40+ events visible**
- Woerthersee (woerthersee.com) - TYPO3 + TOSC5

### WordPress / Custom (potentially scrapable)
- Bregenzerwald (bregenzerwald.at) - WordPress + DataCycle widget
- Waldviertel (veranstaltungen.waldviertel.at) - Custom with Leaflet maps
- Weinviertel (veranstaltungen.weinviertel.at) - Same platform as Waldviertel

### Custom/Proprietary (needs individual analysis)
- Oetztal (oetztal.com) - Custom NUI system
- Innsbruck (innsbruck.info) - blocked/403
- St. Anton (stantonamarlberg.com) - Custom
- Ischgl (ischgl.com) - Custom

### Niederösterreich Centralized Portal
- veranstaltungen.niederoesterreich.at covers: Wachau, Waldviertel, Weinviertel, Wienerwald, Semmering-Rax
- Same platform also at: veranstaltungen.waldviertel.at, veranstaltungen.weinviertel.at, veranstaltungen.wienerwald.info

---

## Detailed Region-by-Region Research

---

### STEIERMARK (Styria)

**Note:** steiermark.com is a centralized portal for ALL Steiermark sub-regions. Scraping this single portal could cover all Steiermark tourism events.

#### 1. Mariazellerland
- **Status:** DONE (mariazell.at)

#### 2. Schladming-Dachstein
- **Portal:** https://www.schladming-dachstein.at/en/event/event-calendar
- **Also on:** https://www.steiermark.com/en/Schladming-Dachstein/Vacation-planning/Events
- **Events:** Hundreds (major events: Nightrace, Summer Opening, Ennstal-Classic)
- **Platform:** Feratel TOSC5 (JS-rendered)
- **Cheerio:** NO -- content loads dynamically via JavaScript
- **Notes:** TOSC5 tag ID `8fe09ddf-41be-44ca-bd24-d4d1982b438d`

#### 3. Ausseerland-Salzkammergut
- **Portal:** https://www.ausseerland.at/events/ (redirects to Deskline)
- **Ticket portal:** https://kultur.ausseerland.at/de/events
- **Also on:** steiermark.com
- **Events:** ~100-200 (Narzissenfest, Opera Ballet, Traungeflüster festival)
- **Platform:** Deskline + kultur.ausseerland.at (separate ticket system)
- **Cheerio:** kultur.ausseerland.at possibly yes; main portal NO (Deskline)

#### 4. Thermenland Steiermark (Thermen- & Vulkanland)
- **Portal:** https://www.steiermark.com/en/Thermen-Vulkanland/Plan-your-holiday/Events
- **Legacy:** http://www.thermenland.info/events/allgemein
- **Events:** ~100-300
- **Platform:** steiermark.com centralized (Feratel TOSC5)
- **Cheerio:** NO

#### 5. Suedsteiermark / Steirische Weinstrasse
- **Portal:** https://www.steiermark.com/en/Suedsteiermark/Holiday/events
- **Deskline:** http://web4.deskline.net/suedsteiermark/de/event/list (may be offline)
- **Wine events:** https://steiermark.wine/events/
- **Events:** ~200-400 (wine festivals, Jazz Festival Leibnitz, Welschlauf)
- **Platform:** steiermark.com (TOSC5) + Deskline fallback
- **Cheerio:** steiermark.wine possibly yes; main portal NO

#### 6. Hochsteiermark
- **Portal:** https://www.steiermark.com/en/Hochsteiermark/Plan-your-holiday/Events
- **Events:** ~100-200 (Neuberger Kulturtage, Brahms Festival, ChillHill)
- **Platform:** steiermark.com centralized
- **Cheerio:** NO

#### 7. Murtal
- **Portal:** https://www.steiermark.com/en/Murtal/Events
- **Also:** https://www.murtalinfo.at/events
- **Events:** ~200-400 (Red Bull Ring MotoGP, Farrach Advent, Perchten runs)
- **Platform:** steiermark.com centralized
- **Cheerio:** murtalinfo.at possibly yes; main portal NO

#### 8. Oststeiermark
- **Portal:** https://www.steiermark.com/en/Oststeiermark/Plan-your-holiday/Events
- **Also:** https://www.oststeiermark.info/veranstaltungen/
- **Events:** ~200-400 (Apple Blossom Festival, Blumenkorso, Winzerfest)
- **Platform:** steiermark.com centralized
- **Cheerio:** oststeiermark.info possibly yes; main portal NO

---

### SALZBURG

#### 9. Salzburg Stadt
- **Portal:** https://www.salzburg.info/en/events/events-calendar
- **Events:** 500-1000+ (Salzburger Festspiele, Rupertikirtag, Jazz&TheCity)
- **Platform:** Pimcore CMS, custom implementation
- **Cheerio:** Possibly -- needs testing. Content may be SSR
- **Priority:** HIGH (major city, huge event count)

#### 10. Salzburger Seenland
- **Portal:** https://www.salzburger-seenland.at/en/events/
- **Deskline:** salzburger-seenland.at uses Deskline for booking/events
- **Events:** ~50-150 (Bauernherbst, village festivals)
- **Platform:** Feratel TOSC5 / Deskline
- **Cheerio:** NO

#### 11. Tennengau
- **Portal:** https://www.tennengau.com/en/experience/events/
- **Events:** ~50-150 (Krampuslauf, Christmas events, folk events)
- **Platform:** Feratel TOSC5
- **Cheerio:** NO

#### 12. Pongau / St. Johann
- **Portal:** https://www.josalzburg.com/de/events/veranstaltungen-1.html
- **Also:** https://www.st.johann.at/ (GEM2GO municipal system)
- **Events:** ~100-200
- **Platform:** Custom/mixed
- **Cheerio:** josalzburg.com possibly yes; needs testing

#### 13. Pinzgau / Zell am See-Kaprun
- **Portal:** https://www.zellamsee-kaprun.com/en/events/event-calendar
- **Events:** ~200-400 (Dutchweek, World Rookie Tour, Dance Star Austria)
- **Platform:** Feratel TOSC5
- **Cheerio:** NO
- **Priority:** HIGH (major tourist destination)

#### 14. Lungau
- **Portal:** https://www.lungau.at/en/events-lungau/
- **Events:** ~100-200 (Samson processions, medieval spectacles, choir festivals)
- **Platform:** Feratel/Deskline
- **Cheerio:** NO

#### 15. Gasteinertal
- **Portal:** https://www.gastein.com/events/eventkalender/
- **Events:** **2,552 events!** (huge database)
- **Platform:** TYPO3 + BookingEmo (custom AJAX pagination, 12 events/page)
- **Cheerio:** PARTIALLY -- SSR HTML with AJAX pagination. Could scrape page-by-page
- **Priority:** VERY HIGH (massive event count)
- **Notes:** `EmoAjax_ajaxReloadEvents` function for pagination

---

### OBEROESTERREICH (Upper Austria)

#### 16. Salzkammergut
- **Portal:** https://www.salzkammergut.at/en/things-to-do/events.html
- **Also:** https://www.im-salzkammergut.at/events/
- **Events:** ~300-600 (Corpus Christi Hallstatt, Glöckler runs, Gamsjagatage)
- **Platform:** Custom tourism platform
- **Cheerio:** Needs testing -- im-salzkammergut.at may be SSR
- **Priority:** HIGH (major tourist region)

#### 17. Muehlviertler Alm
- **Portal:** https://muehlviertleralm.at/aktuelles/veranstaltungen/
- **Also:** https://www.muehlviertel.at/en/events.html (broader Mühlviertel)
- **Events:** ~30-80 (carnival parades, harvest festivals, timber symposium)
- **Platform:** Custom/WordPress
- **Cheerio:** Likely YES
- **Priority:** LOW (small event count)

#### 18. Donauregion
- **Portal:** https://www.donauregion.at/en/events.html
- **Also:** https://www.donauregion.at/en/events/events.html
- **Events:** ~100-300 (DONAU.Event Summer concerts, theater, open air)
- **Platform:** Custom
- **Cheerio:** Needs testing
- **Notes:** DONAU.Erlebnis Card partnership with 80+ partners

#### 19. Pyhrn-Priel
- **Portal:** https://www.urlaubsregion-pyhrn-priel.at/en/eventcalendar.html
- **Events:** ~50-150 (Mountain Advent, Niglou parade, hiking events)
- **Platform:** Custom/Feratel
- **Cheerio:** Needs testing

#### 20. Innviertel
- **Portal:** https://www.innviertel-tourismus.at/en/our-events.html
- **Calendar:** https://www.innviertel-tourismus.at/veranstaltungen/veranstaltungskalender.html
- **Events:** ~50-150
- **Platform:** Feratel/Deskline likely
- **Cheerio:** Probably NO

#### 21. Traunviertel / Bad Hall area
- **Portal:** No dedicated tourism portal found. Events listed via oberoesterreich.at
- **Also:** https://www.bergethermestadt.at/en/ (Pyhrn-Priel - Bad Hall - Steyr)
- **Events:** ~100-200
- **Platform:** Via oberoesterreich.at centralized
- **Cheerio:** Needs testing
- **Notes:** oberoesterreich.at is the Upper Austria centralized portal

---

### TIROL (Tyrol)

#### 22. Zillertal
- **Portal:** https://www.zillertal.at/en/information/holiday-info/events.html
- **Also:** https://www.zillertalarena.com/en/winter/events/events-calendar/
- **Events:** ~300-500 (Gauder Fest, Full Metal Mayrhofen, Lederhosen Wedelfinale)
- **Platform:** Feratel TOSC5
- **Cheerio:** NO
- **Priority:** HIGH (major tourist valley)

#### 23. Stubai
- **Portal:** https://www.stubai.at/en/events/calendar-of-events/
- **Events:** ~100-200
- **Platform:** Custom, likely TOSC5
- **Cheerio:** Probably NO

#### 24. Oetztal
- **Portal:** https://www.oetztal.com/en/events-leisure-tips/event-calendar
- **Events:** ~200-400 (Ski World Cups Soelden, Oetztaler Cycle Marathon)
- **Platform:** Custom NUI system (proprietary)
- **Cheerio:** NO (dynamic loading)
- **Priority:** HIGH

#### 25. Innsbruck und Umgebung
- **Portal:** https://www.innsbruck.info/brauchtum-und-events/veranstaltungskalender.html
- **Also:** https://www.innsbrucktermine.at/en
- **Events:** ~500-1000+ (major city)
- **Platform:** Custom (returned 403 on fetch -- may need browser)
- **Cheerio:** Unknown -- needs browser testing
- **Priority:** VERY HIGH (state capital, huge event count)

#### 26. Kitzbuehel
- **Portal:** https://www.kitzbuehel.com/veranstaltungen/
- **Also:** https://www.kitzbueheler-alpen.com/de/kam/events.html
- **Events:** **1,000+ annually** (Hahnenkamm, Snow Polo, Generali Open, PURA VIDA)
- **Platform:** TYPO3 CMS, SSR with JS pagination
- **Cheerio:** PARTIALLY -- initial events SSR, more via "Mehr Laden" button
- **Priority:** VERY HIGH

#### 27. Wilder Kaiser
- **Portal:** https://www.wilderkaiser.info/en/events.html
- **Also:** https://tickets.wilderkaiser.info/ (ticket system)
- **Events:** ~100-200 (Bergdoktor fan days, sport events)
- **Platform:** Custom
- **Cheerio:** Needs testing

#### 28. Seefeld
- **Portal:** https://www.seefeld.com/en/events.html
- **Events:** ~100-200 (Karwendel March, Christmas market, Crafts Festival)
- **Platform:** TOSC5 likely
- **Cheerio:** Probably NO

#### 29. Achensee
- **Portal:** https://www.achensee.com/en/events-tyrol-austria/
- **Events:** ~100-200 (Karwendelmarsch, Achensee Run, Ballooning Days)
- **Platform:** TOSC5 / Deskline likely
- **Cheerio:** Probably NO

#### 30. Paznaun-Ischgl
- **Portal:** https://www.ischgl.com/en/events-experiences/event-calendar
- **Events:** ~100-300 (Top of the Mountain Concerts, Ironbike, PIUT trail, Silvretta Ferwall March)
- **Platform:** Custom
- **Cheerio:** Needs testing
- **Priority:** MEDIUM-HIGH

#### 31. St. Anton am Arlberg
- **Portal:** https://www.stantonamarlberg.com/en/events
- **Events:** ~100-200 (Weisse Rausch, Ski Opening, Tanzcafe, Arlberg Giro)
- **Platform:** Custom
- **Cheerio:** Needs testing

#### 32. Wipptal
- **Portal:** https://www.wipptal.at/en/events
- **Events:** ~50-100 (alpine festivals, Advent markets, Perchten)
- **Platform:** Custom
- **Cheerio:** Needs testing
- **Priority:** LOW

---

### KAERNTEN (Carinthia)

#### 33. Woerthersee Tourismus
- **Portal:** https://www.woerthersee.com/den-woerthersee-erleben/lifestyle-events
- **Also:** https://www.kaernten.at/seen/woerthersee/events/
- **Events:** ~200-400 (Fete Blanche 30k visitors, Triathlon, Yoga Festival, Krimifest)
- **Platform:** TYPO3 + TOSC5/Deskline hybrid
- **Cheerio:** PARTIALLY -- some SSR, some dynamic
- **Priority:** HIGH

#### 34. Villach Tourismus
- **Portal:** https://www.visitvillach.at/en/events-in-villach-2.html
- **Also:** https://villach.at/stadt-erleben/veranstaltungen
- **Events:** ~200-400 (Villacher Kirchtag, Carnival, European Bike Week, Carinthischer Sommer)
- **Platform:** Next.js/React (custom), SSR with JSON-LD
- **Cheerio:** POSSIBLY YES -- Next.js SSR typically has HTML content
- **Priority:** HIGH

#### 35. Millstaetter See
- **Portal:** https://www.millstaettersee.com/de/info-service/reise-planen/top-veranstaltungen.html
- **Also:** https://www.seeundberg.at/planen/veranstaltungen/
- **Events:** ~100-200 (Musi Open Air, Guitar Festival, Nockalmfest)
- **Platform:** Custom
- **Cheerio:** Needs testing

#### 36. Nassfeld-Pressegger See
- **Portal:** https://www.nassfeld.at/en/Service/Events/Veranstaltungskalender
- **Also:** https://nlw.at/de/Service/Events/Veranstaltungskalender
- **Events:** **200+ annually** (skytrail races, Bike Peak, concerts, Kultursommer)
- **Platform:** Bootstrap 4 based, possibly Feratel backend
- **Cheerio:** Needs testing -- HTML structure looks SSR-friendly

#### 37. Bad Kleinkirchheim
- **Portal:** https://www.seeundberg.at/planen/veranstaltungen/ (shared with Millstaetter See)
- **Also:** https://bad-kleinkirchheim.gv.at/unser-bad-kleinkirchheim/termine
- **Events:** ~50-100 (Musi Open Air, Carinthia Cycle Marathon, Bauernmarkt)
- **Platform:** Custom
- **Cheerio:** Needs testing

#### 38. Klopeiner See
- **Portal:** https://www.klopeinersee.at/events/
- **Also:** https://www.suedkaernten.at/ (Suedkaernten portal)
- **Events:** ~50-150 (Lake Festivals, See in Flammen, Alpen Adria Swim Cup, Volksfest 140k visitors)
- **Platform:** Custom
- **Cheerio:** Needs testing

---

### VORARLBERG

#### 39. Bregenzerwald
- **Portal:** https://www.bregenzerwald.at/en/events-in-the-bregenzerwald/
- **External calendar:** https://information.bregenzerwald.at/de/veranstaltungen
- **Events:** ~100-300 (Schubertiade Schwarzenberg, :alpenarte, Kinderschnee)
- **Platform:** WordPress + DataCycle widget
- **Cheerio:** Probably NO (DataCycle widget loads dynamically)
- **Notes:** information.bregenzerwald.at may have a separate API

#### 40. Montafon
- **Portal:** https://www.montafon.at/en/events (redirects to montafon.conecto.rocks)
- **Also:** https://www.silvretta-montafon.at/en/events-experiences
- **Events:** ~100-200 (FIS World Championships 2027, Christmas markets, classic car events)
- **Platform:** Conecto (custom tourism platform)
- **Cheerio:** Probably NO (conecto.rocks is JS-rendered)

#### 41. Kleinwalsertal
- **Portal:** https://www.kleinwalsertal.com/en/Current-and-Service/Up-to-date/Events
- **Events:** ~100-200 (Alpabtrieb cattle drive, weekly markets, concerts)
- **Platform:** Custom
- **Cheerio:** Needs testing

#### 42. Arlberg (Lech/Zuers)
- **Portal:** https://www.lechzuers.com/en/culture-and-lifestyle/events
- **Events:** ~100-200 (Lech Classic Festival, Arlberg Classic Car Rally, Tanzcafe, White Thrill)
- **Platform:** Custom
- **Cheerio:** Needs testing
- **Priority:** MEDIUM

---

### NIEDEROESTERREICH (Lower Austria)

**Note:** niederoesterreich.at runs a centralized event portal covering all sub-regions.
Base URL: https://veranstaltungen.niederoesterreich.at/
This is a custom platform with Leaflet maps, autocomplete, and category filtering.

#### 43. Wachau
- **Portal:** https://veranstaltungen.niederoesterreich.at/cal/wachau
- **Also:** https://www.donau.com/en/wachau-nibelungengau-kremstal/happenings-events/find-events/
- **Events:** ~200-400 (Wachauer Wine Spring, Summer Solstice, Riesling Festival, Wachau Festival)
- **Platform:** NiederOesterreich centralized portal + donau.com (Donau NOE)
- **Cheerio:** NiederOesterreich portal needs testing; donau.com needs testing
- **Priority:** HIGH (UNESCO World Heritage, major wine region)

#### 44. Waldviertel
- **Portal:** https://veranstaltungen.waldviertel.at/
- **Also:** https://www.waldviertel.at/vadb-waldviertel
- **Events:** ~200-400 (Grafenegg Festival, Klangraum Dobra, KulturSommer)
- **Platform:** Same as NiederOesterreich centralized portal (custom, Leaflet, jQuery)
- **Cheerio:** Needs testing -- HTML may be SSR with dynamic filtering
- **Priority:** HIGH (Grafenegg alone has 100+ events)

#### 45. Weinviertel
- **Portal:** https://veranstaltungen.weinviertel.at/
- **Also:** https://www.weinviertel.at/veranstaltungskalender-weinviertel
- **Events:** ~200-400 (Weintour Weinviertel 250 wineries, wine festivals)
- **Platform:** Same as NiederOesterreich centralized portal
- **Cheerio:** Same as above
- **Priority:** MEDIUM

#### 46. Wienerwald
- **Portal:** https://veranstaltungen.wienerwald.info/
- **Events:** ~100-200 (wine festival, gourmet journeys, Easter markets)
- **Platform:** Same as NiederOesterreich centralized portal
- **Cheerio:** Same as above

#### 47. Semmering-Rax
- **Portal:** https://www.semmering-rax.com/
- **Also:** https://www.wieneralpen.at/region-semmering-rax
- **Events:** ~200+ in summer (Kultur.Sommer.Semmering, Festspiele Reichenau, Raimundspiele)
- **Platform:** Custom (semmering-rax.com) + NiederOesterreich portal
- **Cheerio:** semmering-rax.com needs testing
- **Notes:** 2026 is "Year of Jubilees" -- expect extra events

---

### BURGENLAND

#### 48. Neusiedler See
- **Status:** ALREADY HAVE (neusiedlersee.com)
- **Portal:** https://www.neusiedlersee.com/erleben/veranstaltungen/alle-veranstaltungen
- **Deskline:** https://web4.deskline.net/neusiedsee/de/event/list
- **Events:** ~300-500 (Seefestspiele Moerbisch, Oper im Steinbruch, wine events)
- **Platform:** Deskline + custom
- **Notes:** Already scraped? Verify coverage

#### 49. Therme Lutzmannsburg area
- **Portal:** https://www.sonnentherme.at/ (thermal spa, not a tourism region per se)
- **Events:** ~20-50 (Lustspielhaus shows, family entertainment, mermaid courses)
- **Platform:** Custom
- **Cheerio:** Likely YES but very few events
- **Priority:** LOW (not a major event source)
- **Notes:** Better covered by burgenland.info general scraper

---

## Priority Ranking for Scraper Development

### Tier 1 -- Highest Impact (1000+ events each)
1. **gastein.com** -- 2,552 events, TYPO3/AJAX, partially scrapable with Cheerio
2. **steiermark.com** -- Centralized portal for ALL Steiermark regions, TOSC5 (needs Puppeteer)
3. **innsbruck.info** -- Major city, 500-1000+ events (blocked, needs investigation)
4. **salzburg.info** -- Major city, 500-1000+ events, Pimcore CMS
5. **kitzbuehel.com** -- 1,000+ annually, TYPO3, partially SSR

### Tier 2 -- High Impact (200-500 events)
6. **salzkammergut.at / im-salzkammergut.at** -- 300-600 events
7. **zillertal.at** -- 300-500 events (TOSC5)
8. **oetztal.com** -- 200-400 events (NUI system)
9. **zellamsee-kaprun.com** -- 200-400 events (TOSC5)
10. **woerthersee.com** -- 200-400 events (TYPO3 hybrid)
11. **visitvillach.at** -- 200-400 events (Next.js SSR -- promising!)
12. **NiederOesterreich portal** -- Wachau/Waldviertel/Weinviertel combined: 600-1200 events
13. **nassfeld.at** -- 200+ events
14. **donau.com (Wachau)** -- 200-400 events

### Tier 3 -- Medium Impact (100-200 events)
15. **ischgl.com** -- 100-300 events
16. **stantonamarlberg.com** -- 100-200 events
17. **wilderkaiser.info** -- 100-200 events
18. **bregenzerwald.at** -- 100-300 events
19. **montafon.at** -- 100-200 events
20. **kleinwalsertal.com** -- 100-200 events
21. **lechzuers.com** -- 100-200 events
22. **stubai.at** -- 100-200 events
23. **achensee.com** -- 100-200 events
24. **seefeld.com** -- 100-200 events
25. **millstaettersee.com** -- 100-200 events
26. **klopeinersee.at** -- 50-150 events
27. **josalzburg.com** -- 100-200 events
28. **lungau.at** -- 100-200 events
29. **murtalinfo.at** -- 200-400 events (Red Bull Ring!)
30. **oststeiermark.info** -- 200-400 events

### Tier 4 -- Lower Impact
31-48: Regions with <100 events or fully covered by centralized portals

---

## Recommended Scraping Strategy

### Phase 1: Low-hanging fruit (Cheerio-compatible)
1. **gastein.com** -- TYPO3 with SSR HTML + AJAX pagination (2,552 events!)
2. **visitvillach.at** -- Next.js SSR (200-400 events)
3. **kitzbuehel.com** -- TYPO3 SSR initial load (40+ events visible, more via JS)
4. **NiederOesterreich portals** -- Test if veranstaltungen.waldviertel.at renders SSR HTML
5. **murtalinfo.at** -- Test for SSR HTML events
6. **oststeiermark.info** -- Test for SSR HTML events

### Phase 2: Puppeteer/Playwright needed
7. **steiermark.com** -- TOSC5 for all Steiermark sub-regions
8. **zillertal.at** -- TOSC5
9. **oetztal.com** -- NUI system
10. **zellamsee-kaprun.com** -- TOSC5
11. **salzburg.info** -- Pimcore CMS
12. **innsbruck.info** -- Investigate access issues

### Phase 3: API investigation
13. **Feratel/TOSC5 API** -- Many regions share TOSC5 backend. If we can find the API, one scraper covers ~15 regions
14. **DataCycle API** -- bregenzerwald.at uses this, may have REST API
15. **Deskline web4 API** -- Some regions still use web4.deskline.net

### Phase 4: Remaining regions
16-30: Individual scrapers for custom portals

---

## Feratel TOSC5 Deep Dive

TOSC5 is Feratel's standard tourism web application. Key technical details:
- Each region has a unique TOSC5 tag ID (UUID)
- Content rendered via JavaScript into a target div
- Uses REST API internally to fetch event data
- Available in 13 languages
- Deskline is the backend database; TOSC5 is the frontend widget

**Known TOSC5 tag IDs found:**
- Schladming-Dachstein: `8fe09ddf-41be-44ca-bd24-d4d1982b438d`
- Zillertal: `a7cb8d51-e9f7-4c23-bd1e-d1ff715404d4`

**Potential approach:** Reverse-engineer the TOSC5 API by inspecting network requests. One generic scraper could then query any TOSC5-powered region by tag ID.

---

## Summary Statistics

| State | Regions Researched | Est. Total Events | Primary Platform |
|-------|-------------------|------------------|-----------------|
| Steiermark | 8 | 2,000-4,000 | steiermark.com (TOSC5) |
| Salzburg | 7 | 4,000-6,000 | Mixed (TOSC5/Custom) |
| Oberoesterreich | 6 | 700-1,500 | Mixed |
| Tirol | 11 | 3,000-5,000 | TOSC5 dominant |
| Kaernten | 6 | 800-1,500 | TYPO3/Custom mix |
| Vorarlberg | 4 | 400-900 | WordPress/Custom |
| Niederoesterreich | 5 | 1,000-2,000 | Centralized NÖ portal |
| Burgenland | 2 | 300-550 | Already covered mostly |
| **TOTAL** | **49** | **12,200-21,450** | |

**Conservative estimate of new unique events across all portals: 15,000-20,000**
(accounting for overlap between portals and events we already scrape)

This would bring our total from ~41k to potentially **55k-60k+ events**.

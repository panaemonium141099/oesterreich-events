# Regional Coverage Analysis — Niche Event Sources

**Date:** 2026-03-31
**Task:** fn-1-comprehensive-audit-and-feature-upgrade.15

## Overview

Analysis of geographic and category coverage gaps across the existing 44+ scrapers,
and the niche scrapers added in this task to fill them.

## Existing Coverage (pre-task)

### Geographic Coverage
| Region | Scrapers | Notes |
|--------|----------|-------|
| Burgenland | BurgenlandInfoScraper, LandesregierungScraper, EsterházyScraper, OhoScraper, NeusiedlerseeScraper | Strong local coverage |
| Wien | WienGvScraper, WienVADBScraper, FalterScraper, WienInfoScraper, StadthalleScraper, PraterWienScraper, PartytimerScraper, WienClubsScraper, BasiskulturScraper, GanzWienScraper | Good mainstream coverage |
| Niederösterreich | DonauNOEScraper, GemeindeListScraper, Gem2GoScraper | Moderate; community events only |
| Oberösterreich | LinzTermineScraper, PosthofScraper | Limited to Linz area |
| Steiermark | GrazTourismusScraper, PopcultureScraper, KulturGrazScraper, MariazellScraper (×3) | Graz-centric |
| Salzburg | RockhouseScraper, ARGEkulturScraper, SzeneSalzburgScraper, GasteinScraper | Mostly music/culture |
| Tirol | TirolScraper, EventsTTScraper, TourismusPortaleScraper | Tourism-focused |
| Vorarlberg | BodenseeVorarlbergScraper, VorarlbergTravelScraper | Tourism-focused |
| Kärnten | KaerntenLiveScraper | Limited |
| Österreichweit | EventsAtScraper, FeverUpScraper, MeinBezirkScraper, OeticketScraper, TicketmasterScraper, VeranstaltungskalenderNetScraper, FeratelScraper, Gem2GoScraper, GenericGemeindeScraper | Good multi-region |
| Universities | 42 university/FH/PH scrapers | Comprehensive |

### Category Gaps Identified
| Category Gap | Severity | Notes |
|---|---|---|
| Festivals (dedicated) | High | festival.at and festivalguide.at not scraped |
| Club/Nightlife listings | Medium | RA Austria missing; clubmap.at not scraped |
| Outdoor/hiking events | High | naturfreunde.at and alpenverein.at missing |
| Major theaters | Medium | bundestheater.at and theater.at not scraped |
| Farmers' markets | Medium | bauernmarkt.at not scraped |
| Regional food events | Medium | genussregion.at not scraped |
| Family portals | High | familiii.at and familienurlaub.at not scraped |

## Niche Scrapers Added

### Festivals
- **festival.at** — Austria-wide festival listing portal
  - Scrapes: `/festivals` (3 pages)
  - Tags: `['Festival']`
  - Category: Musik (primary for music festivals)

- **festivalguide.at** — Austrian festival guide with event schedule
  - Scrapes: `/festivals/oesterreich` (2 pages)
  - Tags: `['Festival']`
  - Category: Musik

### Nightlife
- **ra.co/austria** — Resident Advisor Austria electronic music events
  - Scrapes: `/events/at`, `/events/at/wien`, `/events/at/graz`
  - Tags: `['Nightlife']`
  - Category: Nightlife

- **clubmap.at** — Austrian club directory with city-level events
  - Scrapes: Wien, Graz, Linz, Salzburg events
  - Tags: `['Nightlife']`
  - Category: Nightlife

### Outdoor & Sport
- **naturfreunde.at** — Naturfreunde Österreich hiking/outdoor events
  - Scrapes: `/veranstaltungen` (2 pages)
  - Tags: `['Outdoor', 'Sport']`
  - Category: Sport (primarily) or Natur

- **alpenverein.at** — Austrian Alpine Club tours and courses
  - Scrapes: `/veranstaltungen`, `/kurse-touren/touren`
  - Tags: `['Outdoor', 'Sport']`
  - Category: Sport

### Culture & Theater
- **bundestheater.at** — Austrian Federal Theaters (Burgtheater, Staatsoper, Volksoper)
  - Scrapes: Spielplan pages for each federal theater
  - Tags: `['Theater', 'Kultur']`
  - Category: Kultur

- **theater.at** — Austria-wide theater listing portal
  - Scrapes: `/spielplan` (2 pages)
  - Tags: `['Theater', 'Kultur']`
  - Category: Kultur

### Food & Markets
- **bauernmarkt.at** — Austrian farmers' markets directory
  - Scrapes: `/maerkte`, `/events`, `/veranstaltungen`
  - Tags: `['Markt']`
  - Category: Märkte

- **genussregion.at** — Austrian culinary regions events
  - Scrapes: `/veranstaltungen`, `/events`
  - Tags: `['Markt', 'Wein & Kulinarik']`
  - Category: Märkte / Wein & Kulinarik

### Family
- **familiii.at** — Austrian family event aggregator
  - Scrapes: `/events`, `/veranstaltungen`, `/ausflugsziele`
  - Tags: `['Familie']`
  - Category: Familie

- **familienurlaub.at** — Austrian family vacation portal
  - Scrapes: `/veranstaltungen`, `/aktivitaeten`
  - Tags: `['Familie']`
  - Category: Familie

## Remaining Coverage Gaps

| Source | Type | Reason Deferred |
|--------|------|----------------|
| oeticket.com festival section | Festival | Requires Puppeteer (JS-rendered) |
| Resident Advisor full listings | Nightlife | Rate limiting, consider API |
| Bergfex.at sport events | Outdoor | Large site, needs pagination analysis |
| Österreichischer Skiverband | Sport | Small event count, low priority |
| zoo.at / schoenbrunn.at | Family | Separate scraper per venue needed |

## New Tag Keywords Added to categorizeEvent()

- **Nightlife**: club event, rave event, line-up, electronic night, night club
- **Sport/Outdoor**: naturfreunde, alpenverein, alpine tour, bergtour, klettersteig, trail run, trailrunning
- **Kultur/Theater**: staatsoper, burgtheater, volksoper, bundestheater, spielplan, kunsthalle, ensemble, schauspiel
- **Märkte**: genussregion, street food, streetfood, bio-markt, food market
- **Familie**: familiii, familienausflug, ausflugsziel, ausflug für kinder, familienfreundlich, erlebnispark

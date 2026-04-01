# Regional Coverage Analysis — Niche Event Sources

**Date:** 2026-04-01
**Task:** fn-4-massive-event-source-expansion-new.8 (updated from fn-1.15)

## Overview

Analysis of geographic and category coverage across 126 registered scraper instances,
including the original 44+ regional scrapers, 41 university scrapers, and 34 niche scrapers added across epics fn-1 and fn-4.

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

## New Sources Added (Epic fn-4, April 2026)

### Tourism APIs
- **TourDataScraper** — tourdata.at / austria.info REST API (all Bundeslaender)
- **WienOGDScraper** — Wien Open Government Data VADB queries (CC-BY 4.0)
- **WienTicketScraper** — wien-ticket.at concerts, theater, sport, exhibitions

### Feratel Expansion (+15 Regions)
71 regions total (up from 56). New regions in Salzburg (Tennengau, Hochkoenig, Fuschlseeregion, Grossarltal, Radstadt, Flachau, Wagrain-Kleinarl, Altenmarkt-Zauchensee, Hallein, Werfen, Abtenau, Golling, Annaberg-Lungoetz, Uttendorf, Krimml).

### Media Portals & RSS
- **TipsAtScraper** — tips.at (OOE, NOE, Stmk, 8 regions)
- **BergfexScraper** — bergfex.at outdoor/sport events (all Bundeslaender)
- **StadtbekanntScraper** — stadtbekannt.at Wien RSS feed
- **RegionewsScraper** — regionews.at multi-region RSS feed

### Concert Houses & Museums
- **KonzerthausScraper**, **MusikvereinScraper** — Wien classical music venues
- **8 Museum scrapers** — KHM, Albertina, MUMOK, Belvedere, NHM, Technisches Museum, Leopold Museum, Ars Electronica Center

### Sport Federations
- **OeAVEventsScraper** — Alpenverein events API
- **LaufenAtScraper** — laufen.at running events
- **RadNetScraper** — rad-net.at cycling events
- **OeFBScraper** — OeFB football match schedule
- **RunnersFunScraper** — runnersfun.at running events

### Business & Trade
- **WKOScraper** — WKO chamber of commerce events (new "Wirtschaft" category)
- **MesseWienScraper**, **MesseWelsScraper**, **MesseGrazScraper** — Trade fair calendars
- **AMSScraper** — AMS job fair / career events

### Community & Ticketing
- **NtryAtScraper** — ntry.at event ticketing platform
- **MeetupScraper** — Meetup GraphQL API community events

## Remaining Coverage Gaps

| Source | Type | Reason Deferred |
|--------|------|----------------|
| oeticket.com festival section | Festival | Requires Puppeteer (JS-rendered) |
| Resident Advisor full listings | Nightlife | Rate limiting, consider API |
| Oesterreichischer Skiverband | Sport | Small event count, low priority |
| zoo.at / schoenbrunn.at | Family | Separate scraper per venue needed |

## New Tag Keywords Added to categorizeEvent()

- **Nightlife**: club event, rave event, line-up, electronic night, night club
- **Sport/Outdoor**: naturfreunde, alpenverein, alpine tour, bergtour, klettersteig, trail run, trailrunning
- **Kultur/Theater**: staatsoper, burgtheater, volksoper, bundestheater, spielplan, kunsthalle, ensemble, schauspiel
- **Märkte**: genussregion, street food, streetfood, bio-markt, food market
- **Familie**: familiii, familienausflug, ausflugsziel, ausflug für kinder, familienfreundlich, erlebnispark

# LassTreffen.at — Scraper-Quellen

**Stand:** 28.03.2026
**Total Events:** ~27.700 (GEM2GO Scrape läuft noch)
**Aktive Scraper:** 38

---

## Quellen-Übersicht

| # | Quelle | URL | Events | Typ | Abdeckung |
|---|--------|-----|--------|-----|-----------|
| 1 | **GEM2GO** | ~2.094 Gemeinde-Websites | 16.319 | Cheerio (ASP.NET CMS) | Ganz AT (513+ Gemeinden) |
| 2 | **meinbezirk.at** | meinbezirk.at/event/list | 3.845 | Cheerio | Ganz AT (alle Bezirke) |
| 3 | **oeticket** | oeticket.com | 2.769 | Cheerio | Ganz AT |
| 4 | **veranstaltungskalender.net** | veranstaltungskalender.net | 696 | Cheerio | Ganz AT (alle BL) |
| 5 | **Gemeinde-Websites** | ~253 Gemeinde-Websites | 671 | Cheerio (generisch) | Ganz AT (130 Gemeinden) |
| 6 | **falter** | falter.at | 632 | Cheerio | Wien + AT |
| 7 | **kultur-graz** | kultur.graz.at | 262 | Cheerio | Graz |
| 8 | **burgenland.at** | burgenland.at | 226 | Cheerio | Burgenland |
| 9 | **Wien Clubs** | 18 Club-Websites | 173 | Cheerio + Puppeteer | Wien |
| 10 | **burgenland.info** | burgenland.info | 167 | Cheerio + JSON-LD | Burgenland |
| 11 | **partytimer** | partytimer.at | 166 | Cheerio | Wien + AT |
| 12 | **ticketmaster** | ticketmaster.at | 155 | Cheerio | Ganz AT |
| 13 | **Stadthalle Wien** | stadthalle.com | 127 | Cheerio | Wien |
| 14 | **tourismus-portale** | 15 Tourismus-Portale | 111 | Cheerio + Puppeteer | Tirol, Sbg, Stmk |
| 15 | **ganz-wien** | ganz-wien.at | 81 | Cheerio (TYPO3) | Wien |
| 16 | **Neusiedlersee** | neusiedlersee.com | 70 | Cheerio | Burgenland |
| 17 | **oeticket.com** | oeticket.com (alt) | 35 | Cheerio | Ganz AT |
| 18 | **kaernten.live** | kaernten.live | 31 | Cheerio + JSON-LD | Kaernten |
| 19 | **Rockhouse** | rockhouse.at | 31 | Cheerio | Salzburg |
| 20 | **events.at** | events.at | 25 | Cheerio + JSON-LD | Wien + AT |
| 21 | **linztermine** | linztermine.at | 18 | Cheerio + JSON-LD | Linz (OOe) |
| 22 | **popculture** | popculture.at | 18 | Cheerio + JSON-LD | Graz |
| 23 | **Wien GV** | wien.gv.at | 15 | Cheerio | Wien |
| 24 | **Esterhazy** | esterhazy.at | 14 | Cheerio | Burgenland |
| 25 | **OHO** | oho.at | 13 | Cheerio | Burgenland |
| 26 | **donau-noe** | donau.com | 12 | Cheerio (TYPO3) | NOe (Donau-Region) |
| 27 | **Posthof** | posthof.at | 12 | Cheerio + JSON-LD | Linz (OOe) |

### Weitere registrierte Scraper (niedriges Volumen / in Entwicklung)
| Quelle | Typ | Status |
|--------|-----|--------|
| FeverUp | Puppeteer (SPA) | Aktiv |
| PraterWien | Puppeteer (AJAX) | Aktiv |
| WienInfo | Puppeteer | Aktiv |
| ARGEkultur Salzburg | Cheerio | Aktiv |
| Szene Salzburg | Cheerio | Aktiv |
| Gastein | Cheerio | Aktiv |
| BasiskulturWien | Cheerio | Aktiv |
| GrazTourismus | Cheerio | Aktiv |
| TirolScraper | Cheerio | Aktiv |
| EventsTT | Cheerio + JSON-LD | Aktiv |
| BodenseeVorarlberg | Cheerio | Aktiv |
| VorarlbergTravel | Cheerio | Aktiv |

---

## Pro Bundesland

| Bundesland | Events | Top-Quellen |
|-----------|--------|-------------|
| Niederoesterreich | 8.397 | GEM2GO, meinbezirk, Gemeinden |
| Oberoesterreich | 4.495 | GEM2GO, meinbezirk, linztermine, Posthof |
| Tirol | 3.612 | GEM2GO, meinbezirk, tourismus-portale |
| Wien | 2.689 | oeticket, falter, Wien Clubs, Stadthalle, partytimer |
| Salzburg | 2.382 | GEM2GO, Rockhouse, tourismus-portale |
| Steiermark | 1.833 | GEM2GO, kultur-graz, popculture, veranstaltungskalender.net |
| Vorarlberg | 1.618 | GEM2GO, meinbezirk, bodensee-vorarlberg |
| Burgenland | 926 | GEM2GO, burgenland.at, burgenland.info, Neusiedlersee |
| Kaernten | 538 | GEM2GO, kaernten.live, meinbezirk |

---

## Wien Clubs (18 Clubs)

| Club | Methode |
|------|---------|
| Grelle Forelle | Cheerio (Divi Portfolio) |
| Flex | Cheerio (Events Calendar, JSON-LD) |
| Praterdome | JSON API (/api/events) |
| Chelsea | Cheerio (concerts.php, table.termindetails) |
| Fluc | Cheerio (li.datum, week navigation) |
| B72 | Cheerio (h4 date + h6 title) |
| U4 | Puppeteer (Elementor SPA) |
| Volksgarten | Puppeteer (Elementor) |
| Sass Music Club | Cheerio |
| Camera Club | Cheerio |
| Rhiz | Cheerio |
| Donau Techno | Cheerio |
| Das Werk | Cheerio |
| Arena Wien | Puppeteer (DNN) |
| WUK | Puppeteer |
| Cafe Leopold | Puppeteer |
| Szene Wien | TLS-Fehler (down) |
| Ottakringer Brauerei | Down |

---

## Tourismus-Portale (15 aktiv)

| Portal | Region | Methode |
|--------|--------|---------|
| zellamsee-kaprun.com | Zell am See / Kaprun | Cheerio (SSR) |
| stubaital.at | Stubaital | Cheerio (SSR) |
| osttirol.com | Matrei / Osttirol | Cheerio (TYPO3 AJAX) |
| achensee.com | Achensee | Cheerio (SSR) |
| kitzbuehel.com | Kitzbuehel | Cheerio (SSR) |
| soelden.com | Sölden | Puppeteer |
| oetztal.com | Ötztal | Puppeteer |
| ischgl.com | Ischgl | Puppeteer |
| saalbach.com | Saalbach | Puppeteer |
| mayrhofen.at | Mayrhofen | Puppeteer |
| serfaus-fiss-ladis.at | Serfaus-Fiss-Ladis | Puppeteer |
| schladming-dachstein.at | Schladming | Puppeteer |
| nassfeld.at | Nassfeld | Puppeteer |
| attersee-attergau.at | Attersee | Puppeteer |
| zillertal.at | Zillertal | Puppeteer |

---

## GEM2GO Gemeinden

Das GEM2GO CMS wird von ~1.300 der 2.094 oesterreichischen Gemeinden genutzt. Alle haben die gleiche URL-Struktur:
- Event-Liste: `{website}/system/web/veranstaltung.aspx?sprache=1`
- 3 Layouts erkannt: Tabelle (va_list_table), Raster (rasterListEntry), Bootstrap Cards (bemCard)
- Pagination: `?page=N`
- Datumsfilter: `?bdatum=DD.MM.YYYY`

**Ergebnis:** 513+ Gemeinden lieferten Events, URL-Fixer korrigierte 60+ falsche/veraltete URLs.

**URL-Fixer (`fix-gem2go-urls.ts`):**
- Blockiert Cross-Domain Redirects (z.B. matrei.at → osttirolerland.com)
- Testet 10 alternative URL-Muster pro Gemeinde
- GEM2GO-Marker Validation: `veranstaltungcmsliste`, `va_list`, `rasterlist`, `bemcard`

---

## npm Scripts

```bash
npm run scrape              # Alle 38 Scraper ausfuehren
npm run scrape:gem2go       # Nur GEM2GO (~50 Min)
npm run scrape:gemeinden    # Nur Gemeinde-Websites (~8 Min)
npm run scrape:meinbezirk   # Nur meinbezirk.at (~15 Min)
npm run scrape:tourismus    # Nur Tourismus-Portale
npm run scrape:wien-clubs   # Nur Wien Clubs
npm run fix-gem2go          # GEM2GO URLs validieren und reparieren
npm run geocode             # Koordinaten für Events ohne Coords
npm run assign-districts    # Bezirk/Bundesland aus Koordinaten berechnen
```

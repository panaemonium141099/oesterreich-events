# Event-Quellen Recherche: Salzburg, Tirol, Kärnten, Vorarlberg

Recherchiert: 2026-03-28

Bereits vorhandene Quellen (NICHT enthalten): meinbezirk.at, oeticket.com, tirol.at, kaernten.live, woerthersee.com, bodensee-vorarlberg.com, rockhouse.at, argekultur.at, szene-salzburg.net

---

## PRIORISIERTE GESAMTLISTE

### Priorität 1 — Hoher Wert, gut scrapbar (SSR, viele Events)

#### 1. gastein.com/events/eventkalender/
- **URL:** https://www.gastein.com/events/eventkalender/
- **Geschätzte Events:** ~2.500+
- **Rendering:** SSR mit AJAX-Enhancement
- **HTML-Struktur:** Event-Cards mit `<img>`, `<a>` für Titel, Ort-Text, Datum/Uhrzeit. Pagination via `EventPaginate()`. AJAX-Endpoint: POST `/index.php?id=389` mit `EmoAjax_ajaxReloadEvents()`
- **Datenfelder:** Titel, Datum, Uhrzeit, Ort, Bild, Kategorie-Tags (Sport/Kultur/Familie), Detail-URL
- **Bezirke:** Zell am See (Gasteinertal: Bad Gastein, Bad Hofgastein, Dorfgastein)
- **Bewertung:** SEHR GUT — SSR, strukturierte Cards, hohe Event-Anzahl, Pagination

#### 2. kitzbuehel.com/veranstaltungen/
- **URL:** https://www.kitzbuehel.com/veranstaltungen/
- **Geschätzte Events:** ~1.000+ (laut Website "mehr als 1000 Events jährlich")
- **Rendering:** SSR
- **HTML-Struktur:** `<a>`-Tags mit Event-Slug-URLs, Swiper-Slider für Featured Events, Cards mit Titel, Datum, Ort, Beschreibung. JSON-LD Schema vorhanden. "Mehr Laden"-Button für Pagination
- **Datenfelder:** Titel, Datumsbereich, Uhrzeit, Ort, Beschreibung, Bild (lazy-loaded), URL, JSON-LD
- **Bezirke:** Kitzbühel
- **Bewertung:** SEHR GUT — SSR, JSON-LD, viele Events, strukturierte Daten

#### 3. osttirol.com/entdecken-und-erleben/alle-veranstaltungen/
- **URL:** https://www.osttirol.com/en/discover-and-experience/events/all-events/
- **Geschätzte Events:** ~55+ (sichtbar), vermutlich saisonal mehr
- **Rendering:** SSR mit AJAX
- **HTML-Struktur:** Event-Cards mit Bild, Titel, Ort, Datum, Uhrzeit. AJAX-Endpoints: `ajaxReloadEvents`, `ajaxReloadEventsMap`, `ajaxMapEventPopUp`
- **Datenfelder:** Titel, Ort, Datum (DD.MM.YYYY), Uhrzeit, Bild, Kategorie, Detail-URL
- **Bezirke:** Lienz (Osttirol)
- **Bewertung:** GUT — SSR, Map-Integration, AJAX-API verfügbar

#### 4. vorarlberg.travel/veranstaltungen/
- **URL:** https://www.vorarlberg.travel/veranstaltungen/
- **Geschätzte Events:** 200+ (via WordPress REST API)
- **Rendering:** SSR (WordPress)
- **HTML-Struktur:** Kategorisierte Übersicht. WordPress REST API: `/wp-json/vt/v1/events`
- **Datenfelder:** via API vermutlich Titel, Datum, Ort, Kategorie, Beschreibung, Bild
- **Bezirke:** Alle Vorarlberg-Bezirke (Bludenz, Bregenz, Dornbirn, Feldkirch)
- **Bewertung:** SEHR GUT — WordPress REST API direkt nutzbar, ganz Vorarlberg abgedeckt

#### 5. salzburg.info/en/events/events-calendar
- **URL:** https://www.salzburg.info/en/events/events-calendar
- **Geschätzte Events:** 200-500
- **Rendering:** SSR (Grundstruktur), Events möglicherweise per AJAX nachgeladen
- **HTML-Struktur:** Bootstrap-basiert, Container-Fluid/Row/Col Layout. Events nicht im initialen HTML — wahrscheinlich AJAX-Load
- **Datenfelder:** Titel, Datum, Ort, Beschreibung, Bild (vermutlich)
- **Bezirke:** Salzburg-Stadt, teilweise Salzburg-Umgebung
- **Bewertung:** MITTEL — Offizielle Quelle, aber Events möglicherweise dynamisch geladen

---

### Priorität 2 — Regionale Tourismusverbände

#### 6. zillertal.at/information/holiday-info/events.html
- **URL:** https://www.zillertal.at/en/information/holiday-info/events.html
- **Geschätzte Events:** 100-200
- **Rendering:** SSR + TOSC5/Deskline Widget (Feratel)
- **HTML-Struktur:** 5-6 Featured Events statisch, Rest via `<div id="tosc5target">` dynamisch geladen. Feratel Deskline System
- **Datenfelder:** Titel, Datum, Link (statische Events); dynamischer Inhalt via Feratel
- **Bezirke:** Schwaz (Zillertal)
- **Bewertung:** MITTEL — Statische Highlights scrapbar, Hauptliste via Feratel/Deskline (SPA)

#### 7. soelden.com/en/events-leisure-tips/event-calendar
- **URL:** https://www.soelden.com/en/events-leisure-tips/event-calendar
- **Geschätzte Events:** 50-100
- **Rendering:** SPA (Vue/React-ähnlich)
- **HTML-Struktur:** Dynamisch geladene Inhalte, keine statischen Event-Cards
- **Datenfelder:** Titel, Datum, Ort (via Client-Side Rendering)
- **Bezirke:** Imst (Ötztal/Sölden)
- **Bewertung:** SCHWACH für Cheerio — braucht Puppeteer oder API

#### 8. oetztal.com/en/events-leisure-tips/event-calendar
- **URL:** https://www.oetztal.com/en/events-leisure-tips/event-calendar
- **Geschätzte Events:** 100-200
- **Rendering:** SPA
- **HTML-Struktur:** Dynamisch, Favorites-API sichtbar: `/en/api/nui/favorites/add`
- **Datenfelder:** Titel, Datum, Ort (Client-Side)
- **Bezirke:** Imst (gesamtes Ötztal)
- **Bewertung:** SCHWACH für Cheerio — SPA, braucht Puppeteer

#### 9. nassfeld.at/en/Service/Events/Veranstaltungskalender
- **URL:** https://www.nassfeld.at/en/Service/Events/Veranstaltungskalender
- **Geschätzte Events:** 200+ pro Jahr
- **Rendering:** SSR (Bootstrap-basiert)
- **HTML-Struktur:** Bootstrap, Google Analytics. Event-Markup im HTML-Body (nicht im Fetch-Excerpt sichtbar, aber SSR-Indikatoren)
- **Datenfelder:** Vermutlich Titel, Datum, Ort, Beschreibung, Bild
- **Bezirke:** Hermagor (Nassfeld-Pressegger See)
- **Bewertung:** MITTEL — SSR, aber HTML-Struktur nicht vollständig verifiziert

#### 10. ischgl.com/en/events-experiences/topevents
- **URL:** https://www.ischgl.com/en/events-experiences/topevents
- **Geschätzte Events:** 20-50 (Top-Events, Konzerte)
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Beschreibung, Bild
- **Bezirke:** Landeck (Paznaun/Ischgl)
- **Bewertung:** MITTEL — Hochwertige Events (Top of the Mountain Konzerte etc.)

---

### Priorität 3 — Stadt/Gemeinde-Websites

#### 11. visitklagenfurt.at/de/veranstaltungen/
- **URL:** https://www.visitklagenfurt.at/de/veranstaltungen/
- **Geschätzte Events:** 100-300
- **Rendering:** WordPress + Feratel TOSC5 Widget (SPA)
- **HTML-Struktur:** `<div id="tosc5target">` — Feratel Deskline Widget lädt Events dynamisch
- **Datenfelder:** Über Feratel-Widget, nicht statisch verfügbar
- **Bezirke:** Klagenfurt
- **Bewertung:** SCHWACH — Feratel-Widget, braucht Puppeteer oder Deskline-API

#### 12. visitbregenz.com/events/eventkalender
- **URL:** https://visitbregenz.com/events/eventkalender
- **Geschätzte Events:** 100-200
- **Rendering:** Nicht verifiziert (vermutlich TYPO3-basiert)
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort, Kategorie
- **Bezirke:** Bregenz
- **Bewertung:** MITTEL — Muss noch geprüft werden

#### 13. villach.at/stadt-erleben/veranstaltungen
- **URL:** https://villach.at/stadt-erleben/veranstaltungen
- **Geschätzte Events:** 50-150
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort
- **Bezirke:** Villach
- **Bewertung:** MITTEL — Stadtgemeinde-Website

#### 14. hallein.com/erleben/veranstaltungen/
- **URL:** https://www.hallein.com/erleben/veranstaltungen/
- **Geschätzte Events:** 50-100
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort
- **Bezirke:** Hallein
- **Bewertung:** MITTEL — Stadtgemeinde

#### 15. reutte.com/event-calendar
- **URL:** https://www.reutte.com/event-calendar
- **Geschätzte Events:** 30-80
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort
- **Bezirke:** Reutte
- **Bewertung:** MITTEL

---

### Priorität 4 — Kulturhäuser & Festspielhäuser

#### 16. festspielhausbregenz.com/en/events/
- **URL:** https://www.festspielhausbregenz.com/en/events/
- **Geschätzte Events:** 250+ pro Jahr
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Beschreibung, Tickets
- **Bezirke:** Bregenz
- **Bewertung:** MITTEL — Hochwertige Kulturevents

#### 17. salzburgerfestspiele.at/en/tickets
- **URL:** https://www.salzburgerfestspiele.at/en/tickets
- **Geschätzte Events:** 150-200 (Festspielsaison Juli-August)
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort (Spielstätte), Tickets
- **Bezirke:** Salzburg-Stadt, Hallein (Pernerinsel)
- **Bewertung:** MITTEL — Saisonal, aber hochwertig

#### 18. stadtkultur.at (Lienz)
- **URL:** https://www.stadtkultur.at/en/
- **Geschätzte Events:** 50-100
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Beschreibung
- **Bezirke:** Lienz
- **Bewertung:** NIEDRIG — Ergänzend

#### 19. cmi.at/de/veranstaltungskalender (Congress Messe Innsbruck)
- **URL:** https://www.cmi.at/de/veranstaltungskalender
- **Geschätzte Events:** 50-100
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort, Beschreibung
- **Bezirke:** Innsbruck
- **Bewertung:** MITTEL — Messen + Kulturevents

---

### Priorität 5 — Lokale Medien mit Eventkalendern

#### 20. events.tt.com (Tiroler Tageszeitung)
- **URL:** https://events.tt.com/veranstaltungen/reutte/alle-kategorien
- **Geschätzte Events:** 500+ (ganz Tirol)
- **Rendering:** SPA (Angular)
- **HTML-Struktur:** Angular-App mit Material Design. API: `https://events.tt.com/api/v1`
- **Datenfelder:** Über API vermutlich Titel, Datum, Ort, Kategorie, Beschreibung
- **Bezirke:** Alle Tirol-Bezirke (filterbar nach Bezirk)
- **Bewertung:** GUT als API-Quelle — Angular SPA, aber REST API `/api/v1` direkt nutzbar!

#### 21. veranstaltungen.kaernten.at (Kärntner Veranstaltungsdatenbank)
- **URL:** https://veranstaltungen.kaernten.at/events/search
- **Geschätzte Events:** 500+
- **Rendering:** Feratel/Deskline-basiert
- **HTML-Struktur:** Deskline-System mit Such-/Filterparametern
- **Datenfelder:** Titel, Datum, Ort, Kategorie
- **Bezirke:** Alle Kärnten-Bezirke
- **Bewertung:** MITTEL — Zentrale Kärnten-Datenbank, Deskline-API möglicherweise nutzbar

#### 22. wohin.vol.at (VOL.AT — Vorarlberg Online)
- **URL:** https://wohin.vol.at
- **Geschätzte Events:** 200-500
- **Rendering:** Nicht verifiziert
- **HTML-Struktur:** Nicht geprüft
- **Datenfelder:** Titel, Datum, Ort, Kategorie
- **Bezirke:** Alle Vorarlberg-Bezirke
- **Bewertung:** MITTEL — Lokales Medium

---

### Weitere Ski-Resort-Quellen (nicht verifiziert)

#### 23. zellamsee-kaprun.com/en/events/event-calendar
- **URL:** https://www.zellamsee-kaprun.com/en/events/event-calendar
- **Geschätzte Events:** 100-200
- **Bezirke:** Zell am See
- **Bewertung:** MITTEL

#### 24. katschberg.at/en/events.html
- **URL:** https://www.katschberg.at/en/events.html
- **Geschätzte Events:** 30-50
- **Bezirke:** Spittal an der Drau
- **Bewertung:** NIEDRIG

#### 25. tirolwest.at/en/events
- **URL:** https://tirolwest.at/en/events
- **Geschätzte Events:** 30-80
- **Bezirke:** Landeck (TirolWest Region)
- **Bewertung:** NIEDRIG

---

## BEZIRKSABDECKUNG

### Salzburg
| Bezirk | Quellen |
|--------|---------|
| Salzburg-Stadt | salzburg.info, salzburgerfestspiele.at |
| Hallein | hallein.com, salzburgerfestspiele.at (Pernerinsel) |
| Salzburg-Umgebung | salzburg.info (teilweise) |
| St. Johann im Pongau | gastein.com (Gasteinertal) |
| Tamsweg (Lungau) | KEINE GUTE QUELLE GEFUNDEN |
| Zell am See | gastein.com, zellamsee-kaprun.com |

### Tirol
| Bezirk | Quellen |
|--------|---------|
| Innsbruck | innsbrucktermine.at (SPA), cmi.at |
| Innsbruck-Land | events.tt.com (API) |
| Kitzbühel | kitzbuehel.com |
| Kufstein | events.tt.com (API) |
| Schwaz | zillertal.at (Feratel), events.tt.com |
| Imst | oetztal.com (SPA), soelden.com (SPA) |
| Landeck | ischgl.com, tirolwest.at |
| Lienz (Osttirol) | osttirol.com |
| Reutte | reutte.com |

### Kärnten
| Bezirk | Quellen |
|--------|---------|
| Klagenfurt | visitklagenfurt.at (Feratel) |
| Klagenfurt-Land | veranstaltungen.kaernten.at |
| Villach | villach.at, visitvillach.at |
| Villach-Land | veranstaltungen.kaernten.at |
| Feldkirchen | veranstaltungen.kaernten.at |
| Hermagor | nassfeld.at |
| Sankt Veit | veranstaltungen.kaernten.at |
| Spittal | nassfeld.at, katschberg.at |
| Völkermarkt | veranstaltungen.kaernten.at |
| Wolfsberg | tourismus-wolfsberg.at, veranstaltungen.kaernten.at |

### Vorarlberg
| Bezirk | Quellen |
|--------|---------|
| Bregenz | visitbregenz.com, festspielhausbregenz.com |
| Dornbirn | events-vorarlberg.at, vorarlberg.travel |
| Feldkirch | events-vorarlberg.at, vorarlberg.travel |
| Bludenz | events-vorarlberg.at, vorarlberg.travel |

---

## EMPFOHLENE IMPLEMENTIERUNGSREIHENFOLGE

### Phase 1 — Höchster ROI (SSR, viele Events, breite Abdeckung)
1. **vorarlberg.travel** — WordPress REST API `/wp-json/vt/v1/events`, alle 4 Vorarlberg-Bezirke
2. **gastein.com** — SSR + AJAX, ~2500 Events, Cheerio-scrapbar
3. **kitzbuehel.com** — SSR mit JSON-LD, ~1000 Events

### Phase 2 — Wichtige Regionen
4. **osttirol.com** — SSR + AJAX, Bezirk Lienz
5. **events.tt.com/api/v1** — REST API, alle Tirol-Bezirke (Angular-Frontend aber API direkt nutzbar)
6. **nassfeld.at** — SSR, Bezirk Hermagor

### Phase 3 — Zentrale Datenbanken (brauchen evtl. Puppeteer)
7. **veranstaltungen.kaernten.at** — Deskline, alle Kärnten-Bezirke
8. **salzburg.info** — Evtl. AJAX-basiert, Salzburg-Stadt

### Phase 4 — Feratel/Deskline-Widget-Seiten (brauchen Puppeteer)
9. **zillertal.at** — TOSC5 Widget
10. **visitklagenfurt.at** — TOSC5 Widget
11. **oetztal.com / soelden.com** — SPA

---

## TECHNISCHE NOTIZEN

### Feratel/Deskline TOSC5 System
Viele österreichische Tourismusverbände nutzen das Feratel Deskline System. Erkennbar an:
- `<div id="tosc5target">`
- Script von `resc.deskline.net/DW5/start/`
- XML/SOAP Web Services verfügbar (Deskline 3.0)
- Möglicherweise REST API über Deskline-Interface nutzbar

Betroffene Seiten: zillertal.at, visitklagenfurt.at, kaernten.at/service/events/, teile von salzburg.info

### WordPress REST API
- vorarlberg.travel bietet `/wp-json/vt/v1/events` — direkt per fetch abrufbar
- Kein Puppeteer nötig, JSON-Response

### events.tt.com API
- Angular-SPA aber REST API unter `https://events.tt.com/api/v1`
- Deckt ganz Tirol ab, filterbar nach Bezirk
- Könnte die beste Single-Source für alle Tirol-Bezirke sein

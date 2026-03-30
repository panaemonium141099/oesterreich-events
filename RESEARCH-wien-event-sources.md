# Recherche: Event-Quellen für die 23 Wiener Bezirke

**Datum:** 2026-03-28
**Status:** Abgeschlossen

## Bereits vorhandene Quellen (NICHT erneut aufnehmen)
meinbezirk.at, oeticket.com, ticketmaster.com, falter.at, events.at, partytimer.at, feverup.com, wien.info, stadthalle.com, praterwien.com, wien.gv.at

---

## PRIORITÄT 1 — Hohe Event-Anzahl, gut scrapbar

### 1. basiskultur.at (BASIS.KULTUR.WIEN)
- **URL:** https://basiskultur.at/
- **Typ:** Grassroots-Kulturplattform, Events von Vereinen aus allen 23 Bezirken
- **Geschätzte Events:** ~201 aktuell gelistet (14 Seiten à 15)
- **Rendering:** WordPress + FacetWP, SSR mit Client-Side-Filtering
- **Scraping:** Cheerio möglich für initiales HTML; FacetWP AJAX-Endpoint `/wp-json/facetwp/v1/refresh` für Pagination/Filterung
- **Bezirksfilter:** Ja, alle 23 Bezirke (1010-1230) via FacetWP-Dropdown
- **Genrefilter:** 21 Kategorien (Musik, Theater, Ausstellung, etc.)
- **Daten pro Event:** Titel, Datum, Bezirk, Genre, Veranstalter, Beschreibung, Link
- **Pagination:** FacetWP AJAX, 15 Events/Seite
- **Priorität:** HOCH — Einzige Quelle mit echtem Bezirks-Mapping für lokale Kulturevents

### 2. ganz-wien.at
- **URL:** https://www.ganz-wien.at/veranstaltungen.html
- **Typ:** Wiener Event-Übersicht (Konzerte, Festivals, Grätzlfeste, Märkte)
- **Geschätzte Events:** ~200-500 (Kategorien: Konzerte, Festival, Märkte, Grätzlfeste)
- **Rendering:** SSR (TYPO3 CMS), jQuery + Swiper.js Karusselle
- **Scraping:** Cheerio — HTML vollständig im Initial Load
- **HTML-Struktur:** `.swiper-slide` Container, Links mit `/veranstaltungen/[kategorie]/[slug].html`
- **JSON-LD:** BreadcrumbList + Organization (kein Event-Schema)
- **Daten pro Event:** Titel, Bild, Kategorie-Tag, Teaser-Text, URL
- **Pagination:** Kategorie-Unterseiten + "Mehr..." Links
- **Grätzlfeste-Seite:** https://www.ganz-wien.at/wien/maerkte/strassenmaerkte/graetzl-u-strassenfeste.html
  - SSR, Text-basiert nach Bezirk gruppiert (h3 = Bezirk, dann Wann/Wo Text)
  - ~40-60 Grätzlfeste mit Bezirk, Datum, Ort
  - Parsing via Regex auf "Wann:" / "Wo:" Pattern
- **Priorität:** HOCH — Breite Abdeckung, SSR, gute Grätzlfest-Liste

### 3. eSeL.at
- **URL:** https://www.esel.at/de/day
- **Typ:** Kuratierter Kunst- & Kulturkalender Wien (seit 1998)
- **Geschätzte Events:** ~30-80 pro Tag, ~500+ laufend
- **Rendering:** Phoenix LiveView (Elixir) — SPA-ähnlich
- **Scraping:** Puppeteer nötig (Phoenix LiveView rendert Client-Side)
- **HTML-Struktur:**
  - Event-Links: `a[href*="/de/event/"]`
  - Bilder: `img[src*="pix.esel.at"]`
  - Locations: `a[href*="/de/location/"]`
- **Daten pro Event:** Titel, Uhrzeit/Zeitraum, Kategorie (12 Kategorien), Location mit Link, Thumbnail
- **Pagination:** Keine — Tagesansicht, Navigation per Datum (`/de/day/YYYY-MM-DD`)
- **Kategorien:** Ausstellung, Performance, Theater, Musik, Diskurs, Design, Film, etc.
- **Priorität:** HOCH — Sehr umfangreich für Kunst/Kultur, aber Puppeteer nötig

### 4. eventfinder.at
- **URL:** https://www.eventfinder.at/wien/veranstaltungen/
- **Typ:** Event-Guide Wien mit 45.000+ Events
- **Geschätzte Events:** 45.000+ (Konzerte, Theater, Comedy, Musicals)
- **Rendering:** Konnte nicht verifiziert werden (403 Forbidden bei WebFetch)
- **Scraping:** Unklar — möglicherweise Bot-Protection aktiv
- **Daten:** Titel, Datum, Kategorie, Tickets
- **Filter:** Nach Zeit (heute, morgen, Wochenende, Monat), Kategorie
- **Priorität:** HOCH (Event-Anzahl) — aber 403-Block könnte Scraping verhindern

---

## PRIORITÄT 2 — Mittlere Event-Anzahl, spezifische Nischen

### 5. bezirksmuseum.at (Wiener Bezirksmuseen)
- **URL:** https://www.bezirksmuseum.at/de/veranstaltungen/
- **Typ:** Veranstaltungen der 23 Wiener Bezirksmuseen
- **Geschätzte Events:** ~50-100 (Führungen, Konzerte, Lesungen, Ausstellungen)
- **Rendering:** SSR — HTML vollständig gerendert
- **Scraping:** Cheerio
- **HTML-Struktur:**
  - Event-Links: `a[href*="/veranstaltung/"]`
  - Datum: `h2.event_date`
  - Titel: `h2.event_preview`
  - Beschreibung: `<p>` nach Titel
- **Bezirksfilter:** Dropdown (alle 23 Bezirke), Monats-/Jahres-/Kategoriefilter
- **Daten pro Event:** Titel, Datum/Uhrzeit, Bezirk, Kategorie, Beschreibung, URL
- **Pagination:** Client-Side-Filter (alle Events wahrscheinlich im DOM)
- **Priorität:** MITTEL — Gute Bezirkszuordnung, aber begrenzte Event-Anzahl

### 6. Wiener Bezirksblatt (wienerbezirksblatt.at)
- **URL:** https://wienerbezirksblatt.at/category/events-online/events/
- **Typ:** Bezirkszeitung mit Event-Archiv
- **Geschätzte Events:** ~50-200 (Blog-Artikel über Events)
- **Rendering:** SSR (WordPress)
- **Scraping:** Cheerio
- **HTML-Struktur:** WordPress Block-Template, `article` Elemente
- **JSON-LD:** CollectionPage, ImageObject, BreadcrumbList
- **Pagination:** AJAX Infinite Scroll via `admin-ajax.php` (`action: load_more_category_posts`)
- **Daten pro Event:** Titel, Bild, Bezirk/Kategorie-Link, URL (Details auf Einzelseite)
- **Priorität:** MITTEL — SSR, aber eher Blog-Artikel als strukturierte Events

### 7. goodnight.at
- **URL:** https://goodnight.at/events
- **Typ:** Wiener Nightlife & Events (18-35 Zielgruppe)
- **Geschätzte Events:** ~100-300 (Parties, Konzerte, Queer Nights, Ausstellungen)
- **Rendering:** SPA — Cookie-Consent-Overlay, dynamisches Content-Loading
- **Scraping:** Puppeteer nötig
- **Bezirksfilter:** Ja, nach Bezirk (1010-1230)
- **Kategorien:** Design, Freizeit, Kultur, Party, Trivia
- **Daten pro Event:** Titel, Datum, Location, Bezirk, Kategorie, Bild
- **Priorität:** MITTEL — Gute Nightlife/Bar-Events, aber Puppeteer nötig

### 8. kultursommer.wien
- **URL:** https://kultursommer.wien/
- **Typ:** Gratis Open-Air-Kulturfestival (Juli-August)
- **Geschätzte Events:** ~200-400 (saisonal, 6 Wochen)
- **Rendering:** SSR
- **Scraping:** Cheerio
- **HTML-Struktur:**
  - Bühnen-Links: `a[href*="/buehnen/"]`
  - Programm-Links: `a[href*="/programm/"]`
- **Daten pro Event:** Bühnenname, Bezirk, Bild, Programmkategorie
- **Saisonal:** Nur Juli-August 2026 (2. Juli - 16. August)
- **Priorität:** MITTEL — Saisonal begrenzt, aber gut für Sommermonats-Events

### 9. wiener-kultur.at
- **URL:** https://www.wiener-kultur.at/
- **Typ:** Kulturkalender Wien (Aufführungen, Konzerte, Ausstellungen)
- **Geschätzte Events:** ~100-300
- **Rendering:** SSR + Client-Side JS (JavaScript-Datenobjekte `de.maxsysteme.culturall`)
- **Scraping:** Hybrid — Basis-HTML via Cheerio, aber JS-Datenobjekte für vollständige Daten
- **HTML-Struktur:** `a[href*="/kultur/wien/"]`, `li > a`, Segment-IDs (`#seg...`)
- **Kategorien:** Aufführungen, Konzerte, Ausstellungen, Ereignisse
- **Priorität:** MITTEL — Umfangreich, aber komplexe JS-basierte Datenstruktur

---

## PRIORITÄT 3 — Nischen-Quellen, kleinere Event-Anzahl

### 10. imGrätzl.at
- **URL:** https://www.imgraetzl.at/region/treffen
- **Typ:** Community-Plattform, Workshops & Events von lokalen Machern
- **Geschätzte Events:** ~50-150
- **Rendering:** SPA (JavaScript-Framework, `APP.components`)
- **Scraping:** Puppeteer nötig — keine Events im Initial HTML
- **Bezirksfilter:** Ja, alle 23 Bezirke (z.B. `/bezirk/ottakring-1160/treffen`)
- **Daten pro Event:** Titel, Datum, Ort, Kategorie, Beschreibung
- **Priorität:** NIEDRIG — SPA, wenig Events, aber gute Bezirkszuordnung

### 11. VolXFest
- **URL:** https://www.volxfest.at/
- **Typ:** Lokale Grätzl-Events (Simmering, Kalvarienberg etc.)
- **Geschätzte Events:** ~20-40 pro Jahr
- **Rendering:** SSR (WordPress + Fusion Builder)
- **Scraping:** Cheerio
- **HTML-Struktur:** `.fusion-blog-layout-grid .fusion-post-grid`, Pagination vorhanden (Page 1, 2...)
- **Daten pro Event:** Titel, Bild, Beschreibung, Termine in separaten Listen
- **Priorität:** NIEDRIG — Sehr wenige Events, aber authentische Grätzl-Events

### 12. VHS Wien (Volkshochschulen)
- **URL:** https://www.vhs.at/de/
- **Typ:** Volkshochschule Wien — Kurse & Veranstaltungen in allen Bezirken
- **Geschätzte Events:** 1000+ (Kurse + öffentliche Events)
- **Rendering:** Nicht verifiziert (404 auf Event-Seite)
- **Scraping:** Unklar
- **Standorte:** In fast allen Bezirken vorhanden
- **Priorität:** NIEDRIG — Hauptsächlich Kurse, nicht klassische Events

### 13. WUK (Werkstätten- und Kulturhaus)
- **URL:** https://www.wuk.at/en/events/
- **Typ:** Soziokulturelles Zentrum (9. Bezirk), 12.000m²
- **Geschätzte Events:** ~100-200 pro Jahr
- **Rendering:** Nicht vollständig verifizierbar (nur CSS im Fetch)
- **Scraping:** Wahrscheinlich Puppeteer (Preloader-Pattern deutet auf JS-Rendering)
- **Daten:** Konzerte, Theater, Tanz, Ausstellungen, Kinder-Events
- **Priorität:** NIEDRIG — Nur ein Bezirk (9.)

---

## NICHT MEHR AKTIV / UNBRAUCHBAR

### veranstaltungen-wien.com
- **Status:** 0 Events — Kalender wird redesigned, "kommt diesen Sommer"
- **Backend:** Events Manager Pro v3.2.6 (WordPress)
- **NICHT VERWENDEN** bis Relaunch

### Wir sind Wien (wirsindwien.com)
- **Status:** Festival nach 17 Jahren eingestellt
- **REST API existiert:** `/wp-json/events_api/v1/get_events` — aber leeres Array
- **NICHT VERWENDEN**

### eventpicker.at
- **Status:** 403 Forbidden bei WebFetch
- **NICHT VERWENDEN** ohne weitere Untersuchung

### stadt-wien.at
- **Status:** ECONNREFUSED bei WebFetch — Server nicht erreichbar
- **NICHT VERWENDEN**

---

## OPEN DATA ANSATZ

### data.gv.at — Veranstaltungen Wien
- **URL:** https://www.data.gv.at/katalog/dataset/stadt-wien_veranstaltungenwien
- **Typ:** Open Government Data — Inhalt der wien.gv.at Veranstaltungsdatenbank
- **Format:** Vermutlich CSV/JSON (konnte nicht direkt verifiziert werden)
- **Letztes Update:** 2020-04-15 (möglicherweise veraltet!)
- **Tags:** Theater, Konzerte, Feste, Events, Ausstellungen
- **Priorität:** ZU PRÜFEN — Falls aktiv gepflegt, wäre dies die beste strukturierte Datenquelle

---

## Zusammenfassung & Empfehlung

### Sofort umsetzbar (Cheerio):
1. **basiskultur.at** — 201+ Events, Bezirksfilter, FacetWP AJAX
2. **ganz-wien.at** — 200-500 Events + Grätzlfeste-Liste, SSR
3. **bezirksmuseum.at** — 50-100 Events, Bezirksfilter, sauberes HTML
4. **wienerbezirksblatt.at** — 50-200 Events, WordPress SSR
5. **kultursommer.wien** — 200-400 Events (saisonal), SSR

### Puppeteer nötig:
6. **eSeL.at** — 500+ Kunst/Kultur-Events, Phoenix LiveView
7. **goodnight.at** — 100-300 Nightlife-Events, SPA
8. **imGrätzl.at** — 50-150 Community-Events, SPA

### Noch zu klären:
9. **eventfinder.at** — 45.000+ Events, aber 403-Block
10. **data.gv.at Open Data** — Strukturierte Daten, aber möglicherweise veraltet

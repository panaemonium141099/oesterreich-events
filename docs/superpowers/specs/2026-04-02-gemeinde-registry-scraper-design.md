# Gemeinde-Registry-Scraper

## Problem

Die bestehenden Gemeinde-Scraper (Gem2Go, GenericGemeinde, GemeindeList) verwenden automatisiertes URL-Probing: 13 Pfade werden durchprobiert und gehofft, dass einer trifft. Das Ergebnis: 79 von 171 Burgenland-Gemeinden haben 0 Events in der DB, obwohl viele davon aktive Veranstaltungskalender auf ihren Websites haben.

Das Kernproblem ist nicht technisch, sondern methodisch: fehlende individuelle Recherche pro Gemeinde.

## Loesung

Ein kuratiertes Registry-System: Jede Gemeinde wird individuell recherchiert (Google-Suche, Website-Besuch, Event-Seite verifizieren). Die Ergebnisse werden in JSON-Registry-Dateien gespeichert. Ein einzelner Scraper konsumiert diese Registry und dispatcht pro Gemeinde an die richtige Parsing-Strategie.

## Registry-Datenstruktur

Pfad: `data/gemeinden-registry/{bundesland}.json`

Erster File: `burgenland.json` mit 171 Eintraegen.

```typescript
interface GemeindeRegistryEntry {
  name: string;              // "Trausdorf an der Wulka"
  website: string;           // "https://www.trausdorf-wulka.at"
  eventUrl: string | null;   // "https://www.trausdorf-wulka.at/aktuelles/veranstaltungen/"
  cms: string;               // "wordpress-mec", "cities", "gem2go", "typo3", "joomla", "custom", "unknown"
  strategy: string;          // "jsonld" | "cities-iife" | "mec-html" | "tribe-html" | "gem2go" | "generic-dates" | "none"
  plz: string;               // "7061"
  bezirk: string;            // "Eisenstadt-Umgebung"
  bundesland: string;        // "Burgenland"
  lat: number;               // 47.8205
  lng: number;               // 16.5406
  status: string;            // "active" | "empty" | "no-calendar" | "facebook-only" | "offline" | "pdf-only" | "covered-by-other"
  notes: string;             // Freitext fuer Besonderheiten
  verifiedAt: string;        // "2026-04-02" ISO date
}
```

### Status-Werte

| Status | Bedeutung | Scraper-Verhalten |
|--------|-----------|-------------------|
| `active` | Verifizierte Event-Seite mit aktuellem Kalender | Wird gescrapt |
| `empty` | Event-Seite existiert, aber aktuell keine Eintraege | Wird gescrapt (koennte sich aendern) |
| `no-calendar` | Website ohne Veranstaltungskalender | Wird uebersprungen |
| `facebook-only` | Events nur auf Facebook-Seite | Wird uebersprungen (anderer Scraper noetig) |
| `offline` | Website nicht erreichbar | Wird uebersprungen |
| `pdf-only` | Events als PDF/Bild (nicht maschinenlesbar) | Wird uebersprungen |
| `covered-by-other` | Bereits von anderem Scraper abgedeckt (z.B. Gem2Go) | Wird uebersprungen |

### Strategy-Werte

| Strategy | Parsing-Methode | Beispiel |
|----------|----------------|----------|
| `jsonld` | JSON-LD `@type: Event` aus HTML extrahieren | Trausdorf (MEC), Pama (Tribe Events) |
| `cities-iife` | `window.INITIAL_DATA` IIFE evaluieren via `vm.runInNewContext` | Oslip, Heugraben |
| `mec-html` | WordPress MEC HTML selectors (`.mec-event-item`) | Gattendorf, Schachendorf |
| `tribe-html` | Tribe Events HTML selectors | - |
| `gem2go` | GEM2GO CMS Tabellen/Raster-Layout | Stoob, Markt Allhau |
| `generic-dates` | Regex `DD.MM.YYYY` + naechste Ueberschrift | Mogersdorf, Bildein |
| `none` | Nicht scrapbar | Gemeinden ohne Kalender |

## Scraper-Architektur

### Neuer Scraper: `GemeindeRegistryScraper`

```
src/lib/scrapers/
  GemeindeRegistryScraper.ts      <- Hauptscraper, laedt Registry, dispatcht
  gemeinde-strategies/
    index.ts                       <- Strategy-Dispatcher
    jsonld.ts                      <- JSON-LD Event Schema Parser
    cities-iife.ts                 <- CITIES IIFE Evaluator
    mec-html.ts                    <- MEC WordPress HTML Parser
    tribe-html.ts                  <- Tribe Events HTML Parser
    gem2go-page.ts                 <- GEM2GO Page Parser
    generic-dates.ts               <- Datums-Pattern + Titel Extractor
```

### Koexistenz mit bestehenden Scrapern

- Bestehende Scraper (Gem2GoScraper, CitiesScraper, GenericGemeindeScraper, BurgenlandWPEventsScraper) bleiben unveraendert
- GemeindeRegistryScraper ergaenzt: fuellt Luecken die andere nicht abdecken
- Dedup via bestehende `upsertEvent()` Logik (UNIQUE constraint auf source_name + source_id)
- Gemeinden die bereits gut durch andere Scraper abgedeckt sind, bekommen `status: "covered-by-other"`
- source_name: `"gemeinde-registry"`

### Strategy-Interface

```typescript
interface ScrapingStrategy {
  name: string;
  scrape(entry: GemeindeRegistryEntry): Promise<ScrapedEvent[]>;
}
```

Jede Strategy erhaelt den Registry-Eintrag mit der verifizierten eventUrl und den Metadaten (PLZ, Bezirk, Koordinaten). Sie liefert ScrapedEvent[] zurueck.

## Recherche-Prozess

### Methode: Browser-gestuetzte individuelle Recherche

Fuer jede der 171 Burgenland-Gemeinden:

1. Google-Suche: `"[Gemeindename] Veranstaltungen Burgenland"` oder `"[Gemeindename] Termine"`
2. Gemeinde-Website besuchen
3. Event-/Veranstaltungsseite finden (Navigation durchgehen, nicht raten)
4. CMS identifizieren (Quelltext pruefen)
5. Scraping-Strategie bestimmen
6. Registry-Eintrag schreiben

### Reihenfolge: Bezirk fuer Bezirk

1. Eisenstadt (Stadt) + Rust (2 Gemeinden)
2. Eisenstadt-Umgebung (24 Gemeinden)
3. Mattersburg (19 Gemeinden)
4. Neusiedl am See (27 Gemeinden)
5. Oberpullendorf (29 Gemeinden)
6. Oberwart (30 Gemeinden)
7. Guessing (24 Gemeinden)
8. Jennersdorf (13 Gemeinden)

Netto: 168 Gemeinden (3 haben website: "https://none" = keine Website)

### Qualitaets-Gates

- Jeder Eintrag hat `verifiedAt` Datum
- Scraper loggt Warnung wenn `active` Gemeinde 0 Events liefert (moeglicher Seitenumbau)
- `notes` Feld fuer alles Ungewoehnliche

## Skalierung auf alle 9 Bundeslaender

Das System ist bundesland-agnostisch designed:
- Pro Bundesland eine eigene Registry-Datei: `data/gemeinden-registry/{bundesland}.json`
- GemeindeRegistryScraper laedt alle `*.json` Dateien aus dem Verzeichnis
- Strategien sind wiederverwendbar (CITIES, WordPress, GEM2GO kommen ueberall vor)
- Neue Bundeslaender erfordern nur Recherche + JSON-File, kein Code

### Gemeinde-Zahlen pro Bundesland

| Bundesland | Gemeinden | Status |
|------------|-----------|--------|
| Burgenland | 171 | Als erstes |
| Kaernten | 132 | Spaeter |
| Niederoesterreich | 573 | Groesstes |
| Oberoesterreich | 438 | |
| Salzburg | 119 | |
| Steiermark | 286 | |
| Tirol | 277 | |
| Vorarlberg | 96 | |
| Wien | 1 (Bezirke stattdessen) | Sonderfall |

Gesamt: ~2.093 Gemeinden. Burgenland als Pilot validiert den Ansatz.

## Akzeptanzkriterien

- [ ] `data/gemeinden-registry/burgenland.json` mit 171 Eintraegen, alle individuell verifiziert
- [ ] Jeder Eintrag hat korrekten Status, Strategy und verifizierte eventUrl (wo vorhanden)
- [ ] `GemeindeRegistryScraper` laedt Registry und dispatcht korrekt an Strategies
- [ ] Alle 6 Strategies implementiert und getestet
- [ ] Scraper registriert in `index.ts` und laeuft erfolgreich
- [ ] Mindestens 80% der `active` Gemeinden liefern Events beim ersten Lauf
- [ ] TypeScript Build und alle 127 Tests bestehen weiterhin

## Bild-Extraction (Vorschaubilder fuer Event-Bubbles)

Jedes Event braucht ein `image_url` fuer die Kartenansicht. Die Bild-Qualitaet variiert stark je nach Quelle.

### Bild-Prioritaet pro Strategy

| Strategy | Primaere Quelle | Fallback |
|----------|----------------|----------|
| `cities-iife` | `bannerImage.url` (S3, hohe Aufloesung) | keiner noetig |
| `jsonld` | `item.image` / `item.image.url` aus JSON-LD | og:image der Event-Detail-Seite |
| `mec-html` | `img` im `.mec-event-item` | Detail-Seite fetchen -> og:image |
| `tribe-html` | `img` im Event-Card | Detail-Seite fetchen -> og:image |
| `gem2go` | `.va_picture img` oder `.rasterListImage img` | keiner |
| `generic-dates` | `img` im naechsten Container | Detail-Seite fetchen -> og:image |

### Fallback-Strategie: Detail-Seiten-Fetch

Wenn die Listing-Seite kein Bild liefert, aber ein Link zur Detail-Seite vorhanden ist:
1. Detail-Seite fetchen (mit Rate-Limiting, max 5 Detail-Fetches pro Gemeinde)
2. `BaseScraper.extractImageUrl()` anwenden (prueft: og:image, twitter:image, JSON-LD image, groesstes Content-Bild)
3. Ergebnis durch `cleanImageUrl()` validieren (filtert Placeholder, Logos, Tracking-Pixel)

### Bild-Validierung

Alle Bild-URLs durchlaufen `BaseScraper.cleanImageUrl()`:
- Keine Data-URIs, SVG-Logos, Tracking-Pixel
- Keine Placeholder-Muster ("noimage", "default", "platzhalter")
- Keine URLs mit Leerzeichen
- Mindestens 15 Zeichen lang

### Bei der Recherche dokumentieren

Im Registry-Eintrag `notes` Feld vermerken wenn:
- Die Gemeinde-Seite grundsaetzlich keine Event-Bilder hat (z.B. nur Text-Listen)
- Bilder nur auf Detail-Seiten verfuegbar sind (Strategy braucht Detail-Fetch)
- Bilder sehr klein oder von schlechter Qualitaet sind

## Grenzen

- Kein Facebook-Scraping (braucht eigene Loesung)
- Kein PDF-Parsing (manche Gemeinden haben nur Bild-PDFs)
- Kein JavaScript-Rendering (Puppeteer nur fuer Gem2Go-Fallbacks, nicht fuer SPA-Gemeinden)
- Registry muss manuell aktualisiert werden wenn Gemeinden ihre Website umbauen

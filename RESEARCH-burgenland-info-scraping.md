# Research: burgenland.info Events Page — HTML Structure & Scraping Strategy

## Empfehlung

**Zweistufiges Scraping mit Cheerio (Server-Side Rendered HTML):**
1. **Listenseite scrapen** → Event-Links + Basisdaten sammeln (alle Paginationsseiten)
2. **Detailseiten scrapen** → JSON-LD Schema.org Daten extrahieren (reich an Feldern inkl. GPS)

Die Seite ist **vollständig server-side gerendert** (TYPO3 + DataCycle V4), kein Puppeteer nötig. Cheerio reicht vollständig aus.

> **Wichtig:** Es existiert eine DataCycle JSON API (`data.burgenland.info/api/v4/universal/`), aber sie ist **401-geschützt** (Authentifizierung erforderlich). Daher muss HTML gescraped werden.

---

## Seitenstruktur

### URL-Schema
| Seite | URL |
|-------|-----|
| **Listenseite (DE)** | `https://www.burgenland.info/erleben/veranstaltungen` |
| **Listenseite (EN)** | `https://www.burgenland.info/en/experience/events` |
| **Detailseite (DE)** | `https://www.burgenland.info/dc/detail/Veranstaltung/{slug}` |
| **Detailseite (EN)** | `https://www.burgenland.info/en/dc/detail/Event/{slug}` |
| **Bilder** | `https://data.burgenland.info/asset/{uuid}/.../{filename}.jpg` |

### Aktueller Datenbestand (Stand: 22.03.2026)
- **~126-132 Events** auf 6-7 Seiten
- **~20 Events pro Seite**
- Events ab dem aktuellen Datum (zukunftsgerichtet)

---

## Listenseite — HTML-Struktur

### Event-Einträge
Events sind als `<a>`-Tags mit Link zum Detail gerendert:

```html
<a href="/dc/detail/Veranstaltung/{event-slug}">
  <img src="https://data.burgenland.info/asset/{uuid}/.../{filename}.jpg">
  <!-- Image Credit Text -->
  <!-- Event Title -->
  <!-- Date: "DD.MM.YYYY" oder "DD.MM - DD.MM.YYYY" -->
  <!-- Location, Region -->
  Jetzt entdecken
</a>
```

### CSS-Selektoren für Extraktion
```css
/* Event-Links (wichtigster Selektor) */
a[href*="/dc/detail/Veranstaltung/"]

/* Event-Bilder */
img[src*="data.burgenland.info/asset"]
```

### Extrahierbare Felder aus Listenseite
| Feld | Verfügbarkeit | Methode |
|------|---------------|---------|
| Titel | ✅ | Textinhalt des Links |
| Datum | ✅ | Format: "DD.MM.YYYY" oder "DD.MM - DD.MM.YYYY" |
| Ort | ✅ | z.B. "Eisenstadt, Nordburgenland" |
| Region | ✅ | Nordburgenland / Mittelburgenland - Rosalia / Südburgenland |
| Bild-URL | ✅ | `img[src*="data.burgenland.info"]` |
| Detail-Link | ✅ | `href` des `<a>`-Tags |
| Beschreibung | ❌ | Nur auf Detailseite |
| Uhrzeit | ❌ | Nur auf Detailseite |
| GPS-Koordinaten | ❌ | Nur auf Detailseite (JSON-LD) |
| Preis | ❌ | Nur auf Detailseite |

---

## Pagination

### URL-Pattern
```
/erleben/veranstaltungen?dtoSeed=0&tx_dc_index[controller]=DataCycleV4&tx_dc_index[page]={pageNumber}&cHash={hash}
```

### Strategie
- **cHash-Parameter**: Wird von TYPO3 generiert — möglicherweise erforderlich. Falls Seite ohne cHash funktioniert, weglassen. Sonst cHash von Paginationslinks auf der Seite extrahieren.
- **Seitenanzahl**: Aus Text `"1 von 7 Seiten"` (DE) oder `"1 of 6 pages"` (EN) extrahieren.
- **Empfohlener Ablauf**: Seite 1 laden → Gesamtseitenzahl ermitteln → alle Paginationslinks von Seite 1 extrahieren → nachfolgende Seiten laden.

---

## Detailseite — JSON-LD (Goldmine!)

Jede Detailseite enthält **reichhaltige JSON-LD Schema.org Daten** im `<script type="application/ld+json">` Tag.

### Beispiel JSON-LD (Weinfrühling Andau)
```json
{
  "@context": [
    "https://schema.org/",
    {
      "@base": "https://data.burgenland.info/api/v4/universal/",
      "dc": "https://schema.datacycle.at/",
      "dcls": "https://data.burgenland.info/schema/",
      "odta": "https://odta.io/voc/"
    }
  ],
  "@type": ["Event", "dcls:Event"],
  "@id": "dc04951a-e5b6-44df-9724-45639632f003",
  "name": "Weinfrühling Andau",
  "startDate": "2026-03-22T10:00:00.000+01:00",
  "endDate": "2026-03-22T18:00:00.000+01:00",
  "description": "...",
  "image": {
    "@type": "ImageObject",
    "contentUrl": "https://data.burgenland.info/asset/{uuid}/.../filename.jpg",
    "width": 1100,
    "height": 825
  },
  "location": {
    "@type": "Place",
    "name": "Participating wineries in Andau",
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 47.7744136660653,
      "longitude": 17.0303864353027
    }
  },
  "organizer": {
    "@type": "Organization",
    "name": "Weingut Hannes Reeh",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Augasse 11a",
      "postalCode": "7163",
      "addressLocality": "Andau",
      "addressCountry": "AT"
    }
  }
}
```

### Verfügbare Felder aus JSON-LD
| Feld | JSON-LD Pfad | Immer vorhanden? |
|------|-------------|-----------------|
| **ID (UUID)** | `@id` | ✅ |
| **Titel** | `name` | ✅ |
| **Start-Datum/Zeit** | `startDate` (ISO 8601) | ✅ |
| **End-Datum/Zeit** | `endDate` (ISO 8601) | ✅ |
| **Beschreibung** | `description` | ✅ |
| **Bild-URL** | `image.contentUrl` | ✅ |
| **Bildgröße** | `image.width`, `image.height` | ✅ |
| **Ort-Name** | `location.name` | ✅ |
| **Latitude** | `location.geo.latitude` | ✅ |
| **Longitude** | `location.geo.longitude` | ✅ |
| **Veranstalter** | `organizer.name` | Teilweise |
| **Adresse** | `organizer.address.*` | Teilweise |
| **PLZ** | `organizer.address.postalCode` | Teilweise |
| **Klassifikationen** | Tags/Kategorien im Markup | ✅ |

---

## Empfohlene Scraping-Architektur

### Schritt 1: Listenseite scrapen
```typescript
// Pseudo-Code
async function scrapeEventList(): Promise<EventLink[]> {
  const baseUrl = 'https://www.burgenland.info/erleben/veranstaltungen';

  // Seite 1 laden
  const page1 = await fetch(baseUrl);
  const $ = cheerio.load(page1);

  // Gesamtseitenzahl aus "1 von 7 Seiten" extrahieren
  const totalPages = extractTotalPages($);

  // Event-Links von Seite 1 sammeln
  const events = extractEventLinks($);

  // Paginationslinks extrahieren und weitere Seiten laden
  for (let page = 2; page <= totalPages; page++) {
    // Paginationslink von Seite 1 extrahieren (mit cHash)
    // oder ohne cHash versuchen
    const pageUrl = `${baseUrl}?dtoSeed=0&tx_dc_index[controller]=DataCycleV4&tx_dc_index[page]=${page}`;
    const pageHtml = await fetch(pageUrl);
    events.push(...extractEventLinks(cheerio.load(pageHtml)));
  }

  return events; // [{url, title, date, location, imageUrl}]
}
```

### Schritt 2: Detailseiten scrapen (JSON-LD)
```typescript
async function scrapeEventDetail(url: string): Promise<Event> {
  const html = await fetch(`https://www.burgenland.info${url}`);
  const $ = cheerio.load(html);

  // JSON-LD extrahieren
  const jsonLd = JSON.parse($('script[type="application/ld+json"]').text());

  return {
    id: jsonLd['@id'],
    title: jsonLd.name,
    startDate: new Date(jsonLd.startDate),
    endDate: new Date(jsonLd.endDate),
    description: jsonLd.description,
    imageUrl: jsonLd.image?.contentUrl,
    location: jsonLd.location?.name,
    lat: jsonLd.location?.geo?.latitude,
    lng: jsonLd.location?.geo?.longitude,
    address: formatAddress(jsonLd.organizer?.address),
    organizer: jsonLd.organizer?.name,
    sourceUrl: `https://www.burgenland.info${url}`,
    sourceName: 'burgenland.info',
  };
}
```

### Rate Limiting
- **Empfehlung**: 1 Request pro Sekunde (höfliches Scraping)
- **~130 Detail-Requests** + 7 Listenseiten = ~137 Requests pro Scrape-Run
- **Gesamtdauer**: ~2-3 Minuten pro vollständigem Scrape

---

## Optionen

### Option A: Cheerio (HTML + JSON-LD) — ✅ EMPFOHLEN
- **Pro:** Schnell, leichtgewichtig, kein Browser nötig, JSON-LD liefert strukturierte Daten mit GPS
- **Pro:** Server-Side Rendering = HTML sofort vollständig
- **Pro:** Keine externen Dependencies außer cheerio + node-fetch
- **Contra:** Zwei Stufen (Liste + Detail) nötig für vollständige Daten
- **Maintenance:** cheerio — 27k+ Stars, wöchentliche Updates, aktiv maintained
- **Lizenz:** MIT

### Option B: Puppeteer (Headless Browser)
- **Pro:** Kann auch JS-generierte Inhalte laden
- **Contra:** Für diese Seite unnötig — alles SSR
- **Contra:** 10x langsamer, ~300MB Chromium-Dependency
- **Contra:** Höhere Ressourcen-Anforderungen
- **Maintenance:** puppeteer — 89k+ Stars, aktiv maintained von Google
- **Lizenz:** Apache 2.0

### Option C: DataCycle API (JSON)
- **Pro:** Saubere, strukturierte Daten
- **Contra:** **401 Unauthorized** — API ist authentifizierungspflichtig
- **Contra:** Kein öffentlicher API-Key verfügbar
- **Nicht nutzbar ohne Zugangsdaten**

---

## Best Practices

1. **JSON-LD bevorzugen**: Detailseiten enthalten Schema.org JSON-LD mit allen relevanten Feldern — robuster als HTML-Parsing
2. **User-Agent setzen**: `BurgenlandEvents-Scraper/1.0 (educational project)` — transparent und höflich
3. **Rate Limiting**: Min. 1 Sekunde Pause zwischen Requests
4. **robots.txt respektieren**: Vor Scraping prüfen
5. **Caching**: Bereits bekannte Events nicht erneut scrapen (UUID als Deduplizierungsschlüssel)
6. **Fehlertoleranz**: Einzelne fehlende Felder im JSON-LD graceful handeln (nicht alle Events haben alle Felder)
7. **Datumsformat**: ISO 8601 aus JSON-LD (`2026-03-22T10:00:00.000+01:00`) direkt parsbar
8. **Deduplizierung**: `@id` (UUID) aus JSON-LD als eindeutiger Schlüssel

## Warnungen

- **❌ Kein API-Zugang**: `data.burgenland.info/api/v4/` gibt 401 zurück — nicht ohne Authentifizierung nutzbar
- **❌ `visit.burgenland.info`**: SSL-Zertifikat ungültig (`ERR_TLS_CERT_ALTNAME_INVALID`) — diese Quelle ist aktuell nicht erreichbar
- **❌ `/freizeit-sport/veranstaltungen/`**: Gibt 404 zurück — alter/falscher URL-Pfad
- **⚠️ cHash-Parameter**: TYPO3 generiert cHash-Werte für Paginationslinks. Falls ohne cHash blockiert wird, müssen die Links dynamisch von der Seite extrahiert werden
- **⚠️ Kein Preis im JSON-LD**: Eintrittspreis ist nicht standardisiert im JSON-LD enthalten — muss ggf. aus dem HTML-Text der Detailseite extrahiert werden
- **⚠️ Kategorie-Mapping**: Klassifikationen kommen als Tags (z.B. "Wine & Culinary", "Spring", "Wine Festival") — müssen auf eigene Kategorien gemappt werden

---

## Getestete URLs & Ergebnisse

| URL | Status | Ergebnis |
|-----|--------|----------|
| `burgenland.info/erleben/veranstaltungen` | ✅ 200 | Funktioniert, ~126 Events, 7 Seiten |
| `burgenland.info/erleben/veranstaltungen?...page=2` | ✅ 200 | Pagination funktioniert |
| `burgenland.info/dc/detail/Veranstaltung/{slug}` | ✅ 200 | JSON-LD vorhanden |
| `burgenland.info/en/experience/events` | ✅ 200 | Englische Version, ~132 Events |
| `burgenland.info/freizeit-sport/veranstaltungen/` | ❌ 404 | Alter/falscher Pfad |
| `visit.burgenland.info/veranstaltungen` | ❌ SSL Error | Zertifikat ungültig |
| `data.burgenland.info/api/v4/universal/` | ❌ 401 | Auth required |
| `data.burgenland.info/api/v4/events` | ❌ 404 | Endpoint existiert nicht |

---

## Beispiel-Events (Verifiziert am 22.03.2026)

1. **Welttag der Fremdenführer "Das jüdische Eisenstadt"** — 22.03.2026, Eisenstadt
2. **Weinfrühling Andau** — 22.03.2026, Andau (€50 inkl. €30 Weingutschein)
3. **Ostermarkt "Frühlingserwachen" im Kremayrhaus** — 22.03-04.04.2026, Rust
4. **classic.Esterhazy: Isidora String Quartet** — 22.03.2026, Eisenstadt
5. **Barock Tage: L'Orfeo Barockorchester** — 22.03.2026, Raiding

## Technologie-Stack der Quellseite
- **CMS:** TYPO3
- **Content-System:** DataCycle V4 (Ruby-basiert, von pixelpoint.at entwickelt)
- **Daten-Backend:** `data.burgenland.info` (PostgreSQL + DataCycle)
- **Assets:** `data.burgenland.info/asset/{uuid}/...`
- **Analytics:** Matomo

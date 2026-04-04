# Einheitliche Geolocation fuer ganz Oesterreich

## Problem

Events mit gleichem Ort landen auf verschiedenen Stellen der Karte weil Ortsnamen nicht normalisiert werden. "Sankt Georgen am Leithagebirge" und "St. Georgen am Leithagebirge" werden als 2 verschiedene Orte behandelt. Es gibt keine kanonische Ortsdatenbank — nur 37 hardcoded Burgenland-Venues und PLZ-Lookup.

Zusaetzlich: Viele Events haben nur einen Gemeindenamen aber keine genaue Adresse. Alle Events einer Gemeinde landen auf exakt dem gleichen Punkt (Gemeinde-Zentrum). Venues wie "Pfarrscheune Trausdorf" haben keine eigenen Koordinaten.

## Loesung: 3-Stufen Geocoding Pipeline

### Stufe 1: Kanonische Ortsdatenbank (GeoNames Austria)

**Datenquelle:** GeoNames AT-Dump (geonames.org/export/, CC-BY-4.0)
- ~47.000 Orte inkl. Gemeinden, Katastralgemeinden, Ortsteile, Siedlungen
- Jeder Ort: kanonischer Name, alternative Namen, PLZ, Bundesland, lat/lng

**Gespeichert als:** `data/geonames-at.json` (Lookup-Tabelle)

**Normalisierungs-Index:**
- Alle Namen werden normalisiert gespeichert fuer Matching:
  - "St." / "St " → "Sankt"
  - "a.d." / "a. d." → "an der"
  - "a." → "am" (wenn gefolgt von Grossbuchstabe)
  - "i." → "im"
  - "b." → "bei"
  - "o." / "ob" → "ob"
  - Case-insensitive
  - Leerzeichen/Bindestriche normalisiert
  - Umlaute: ae/oe/ue ↔ ae/oe/ue (bidirektional)
- Fuzzy-Matching mit Levenshtein-Distance ≤ 2 als Fallback
- Bei Mehrdeutigkeit (z.B. "St. Georgen" gibt es ~15x in AT): PLZ oder Bundesland als Disambiguator

### Stufe 2: Ortsname-Normalisierung

**Funktion:** `normalizeLocation(locationName, postalCode?, bundesland?)`

**Ablauf:**
1. Normalisiere den Input-String (St. → Sankt, etc.)
2. Exaktes Match gegen GeoNames-Index → Koordinaten zurueck
3. Kein Match → Fuzzy-Match (Levenshtein ≤ 2)
4. Mehrere Matches → Disambiguierung via PLZ oder Bundesland
5. Kein Match → Stufe 3

**Ergebnis:** Kanonischer Ortsname + Ortszentrum-Koordinaten

### Stufe 3: Venue-Level Geocoding (Nominatim + Cache)

**Fuer:** Spezifische Adressen ("Pfarrscheune Trausdorf", "Kulturzentrum Mattersburg")

**Ablauf:**
1. Check geocode_cache (SQLite) → Hit = fertig
2. Nominatim-Query: `"Pfarrscheune, Trausdorf an der Wulka, Burgenland, Austria"`
3. Rate-Limit: 1 req/sec
4. Ergebnis in geocode_cache speichern
5. Fallback: Ortszentrum aus Stufe 2

### Integration in Scrape-Pipeline

**Wo:** Nach dem Scrapen, vor dem Supabase-Sync (in `runScraper()` oder als Post-Processing-Step)

```
Scraper liefert ScrapedEvent
  ↓
normalizeLocation(event.location_name, event.postal_code, event.bundesland)
  ↓
Match gefunden? → kanonische Koordinaten + normalisierter Ortsname
  ↓
Spezifische Adresse vorhanden? → Nominatim fuer Venue-Koordinaten
  ↓
Koordinaten zuweisen → lat/lng in Event setzen
  ↓
upsertEvent() + syncToSupabase()
```

**Jedes neue Event durchlaeuft automatisch die Pipeline.**

## Migration bestehender Events

**Einmal-Script:** `src/scripts/normalize-locations.ts`

1. Alle ~56k Events aus Supabase laden
2. Fuer jedes Event: `normalizeLocation()` ausfuehren
3. Wenn Koordinaten sich aendern: Update in Supabase
4. Batchweise (100er Batches) um Supabase nicht zu ueberlasten
5. Logging: wie viele Events korrigiert, welche Ortsnamen normalisiert

**Erwartung:** ~5-15% der Events bekommen korrigierte Koordinaten.

## Normalisierungs-Regeln (vollstaendig)

| Pattern | Normalisiert zu | Beispiel |
|---------|----------------|----------|
| `St.` / `St ` | `Sankt` | St. Poelten → Sankt Poelten |
| `a.d.` / `a. d.` | `an der` | Waidhofen a.d. Ybbs → Waidhofen an der Ybbs |
| `a.` vor Grossbuchstabe | `am` | Zell a. See → Zell am See |
| `i.` / `i. ` | `im` | Bruck i. Muerzt. → Bruck im Muerztal |
| `b.` / `b. ` | `bei` | Kematen b. Innsbruck → Kematen bei Innsbruck |
| `/` in Ortsnamen | ` ` (Leerzeichen) | Bruck/Leitha → Bruck Leitha |
| Mehrfach-Leerzeichen | Einzelnes Leerzeichen | |
| Leading/Trailing Spaces | Entfernt | |

## Dateien

| Datei | Zweck |
|-------|-------|
| `data/geonames-at.json` | GeoNames Ortsdatenbank (~47k Eintraege) |
| `src/lib/location-normalizer.ts` | Normalisierungsfunktionen + GeoNames-Lookup |
| `src/scripts/download-geonames.ts` | Download + Parse des GeoNames AT-Dumps |
| `src/scripts/normalize-locations.ts` | Migration bestehender Events |

## Akzeptanzkriterien

- [x] GeoNames AT-Dump heruntergeladen und als JSON gespeichert
- [x] Normalisierung erkennt "St." = "Sankt", "a.d." = "an der" etc.
- [x] Fuzzy-Matching findet Orte mit Tippfehlern (Levenshtein ≤ 2)
- [x] Disambiguierung bei Mehrdeutigkeit via PLZ/Bundesland
- [x] Pipeline laeuft automatisch bei jedem Scrape
- [x] Migration-Script korrigiert bestehende Events in Supabase
- [x] Venue-Level Geocoding via Nominatim + Cache funktioniert
- [x] Alle Tests bestehen weiterhin

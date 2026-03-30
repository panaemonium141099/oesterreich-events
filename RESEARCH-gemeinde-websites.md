# Recherche: Österreichische Gemeinde-Websites & Veranstaltungskalender

**Datum:** 2026-03-28

## 1. Überblick: CMS-Landschaft österreichischer Gemeinden

### GEM2GO (RIS GmbH) — Marktführer
- **~1.300 von ~2.092 Gemeinden** nutzen GEM2GO (ca. 62%)
- Entwickelt von RIS GmbH (Oberösterreich), vertrieben über GEMDAT-Gesellschaften
- Besteht aus: GEM2GO WEB (CMS), GEM2GO APP (Mobile), GEM2GO KIOSK
- Ehemals "RIS Kommunal", wurde zu GEM2GO WEB umbenannt
- Einheitliches System: Daten werden einmal eingegeben, alle Kanäle bedient

### Andere CMS-Systeme (~800 Gemeinden)
- **TYPO3**: Wird von größeren Städten genutzt (z.B. Eisenstadt)
- **WordPress**: Vereinzelt bei kleineren Gemeinden
- **Eigenentwicklungen**: Größere Städte (Wien, Graz, Linz, Salzburg) haben eigene Systeme
- **Eventjet**: Manche Gemeinden (z.B. Klosterneuburg) nutzen externe Event-Plattformen

## 2. GEM2GO — Technische Analyse

### URL-Muster für Veranstaltungen
Alle GEM2GO-Websites nutzen das gleiche ASP.NET-basierte URL-Schema:

```
# Veranstaltungsliste
https://www.{gemeinde}.at/system/web/veranstaltung.aspx?menuonr={MENU_ID}&sprache=1

# Veranstaltungsdetail
https://www.{gemeinde}.at/system/web/veranstaltung.aspx?detailonr={EVENT_ID}-{GNR}&menuonr={MENU_ID}&sprache=1

# Bilder
https://www.{gemeinde}.at/system/web/GetImage.ashx?fileid={FILE_ID}&width=300&height=200

# Kalender
https://www.{gemeinde}.at/system/web/kalender.aspx?sprache=1&menuonr={MENU_ID}

# News
https://www.{gemeinde}.at/system/web/news.aspx?detailonr={NEWS_ID}-{GNR}&menuonr={MENU_ID}
```

### Query-Parameter
| Parameter | Beschreibung |
|-----------|-------------|
| `detailonr` | Event-ID (Format: `{ID}-{GNR}`) |
| `gnr_search` | Gemeindenummer (z.B. 86 für Hofkirchen, 1045 für Stadtschlaining) |
| `menuonr` | Menü-ID (variiert pro Gemeinde) |
| `sprache` | Sprache (1=Deutsch) |
| `typ` | Event-Typ/Kategorie |
| `page` | Paginierung (0-basiert) |
| `bdatum` / `vdatum` | Datum-Filter (Format: DD.MM.YYYY) |

### HTML-Struktur der Event-Listings
- **Card-basiertes Layout** mit Bild, Titel, Kategorie, Datum, Ort
- Event-Karten enthalten:
  - Thumbnail via `GetImage.ashx`
  - Titel als Link zur Detailseite
  - Kategorie-Badge (z.B. "Fest, Brauchtum")
  - Datum/Uhrzeit
  - Veranstalter, Ort, Adresse
  - Kontaktdaten (E-Mail, Telefon, Website)
- Paginierung mit Seitennummern
- ASP.NET-typische Control-IDs (`ctl00_ctl00_...`)

### GEM2GO Erkennungsmerkmale
Eine Website nutzt GEM2GO wenn:
1. JavaScript-Variable `'gem2go.eyeable'` vorhanden
2. Analytics zu `statistics.gem2go.page` zeigt
3. URL-Pfade mit `/system/web/` beginnen
4. ASP.NET Control-Hierarchie (`ctl00_...`)
5. "GEM2GO APP" Referenz im Footer/Header

### Subdomain-Variante
Manche Gemeinden nutzen auch: `https://{gemeinde}.gem2go.at/`
Beispiele: bregenz.gem2go.at, frohnleiten.gem2go.at, atzbach.gem2go.at

### Keine öffentliche API
- **Keine dokumentierte REST-API** für Veranstaltungen
- Kein RSS-Feed standardmäßig
- Kein JSON-LD oder strukturierte Daten
- Die GEM2GO APP nutzt vermutlich eine interne API, diese ist aber nicht öffentlich dokumentiert

## 3. Datenquelle: Gemeindeverzeichnis

### GitHub-Repository (bresu/oe_gemeinden)
- **Vollständige Liste aller österreichischen Gemeinden** mit:
  - Gemeindekennziffer (5-stellig, 1. Stelle = Bundesland)
  - Gemeindename
  - PLZ
  - Website-URL
  - E-Mail-Adresse
- **Lizenz:** CC-BY-SA-4.0
- **Burgenland:** ~101 Gemeinden (GKZ beginnt mit 1)
- **Format:** CSV, JSON, XLSX
- **Datei:** `gemeinden_CSV.csv`

### GKZ-Schema
```
1. Stelle: Bundesland (1=Burgenland, 2=Kärnten, 3=NÖ, 4=OÖ, 5=Salzburg, 6=Steiermark, 7=Tirol, 8=Vorarlberg, 9=Wien)
2-3. Stelle: Politischer Bezirk
4-5. Stelle: Gemeindenummer
```

## 4. Verifizierte Beispiele

### GEM2GO-Websites (Burgenland)
| Gemeinde | Website | GEM2GO? | Events-URL |
|----------|---------|---------|------------|
| Wallern/Bgld | marktgemeinde-wallern-im-burgenland.at | Ja | /system/web/veranstaltung.aspx |
| Stadtschlaining | stadtschlaining.at | Ja | /system/web/veranstaltung.aspx |

### GEM2GO-Websites (andere Bundesländer)
| Gemeinde | Website | Events-URL |
|----------|---------|------------|
| Stockerau (NÖ) | stockerau.at | /system/web/veranstaltung.aspx |
| Klosterneuburg (NÖ) | klosterneuburg.at | Ja, aber nutzt Eventjet extern |
| Traun (OÖ) | traun.at | /system/web/kalender.aspx |
| Hofkirchen/Trattnach (OÖ) | hofkirchen-trattnach.at | /system/web/veranstaltung.aspx |
| Berndorf (NÖ) | berndorf.gv.at | /system/web/veranstaltung.aspx |

### Nicht-GEM2GO-Websites
| Gemeinde | Website | CMS | Events |
|----------|---------|-----|--------|
| Eisenstadt | eisenstadt.gv.at | TYPO3 | Extern via eisenstadt-leithaland.at |

## 5. Scraping-Strategie

### Empfehlung: Zwei-Phasen-Ansatz

#### Phase 1: GEM2GO-Scraper (hohe Priorität)
**Ein einziger Scraper kann ~1.300 Gemeinden abdecken.**

Vorgehen:
1. **Gemeindeliste laden** aus GitHub-Repo (CSV mit allen Websites)
2. **GEM2GO-Detection**: Für jede Website prüfen ob `/system/web/veranstaltung.aspx` existiert (HTTP HEAD/GET)
3. **Events scrapen** mit einheitlichem Cheerio-Parser:
   - URL: `https://www.{domain}/system/web/veranstaltung.aspx?sprache=1`
   - HTML-Tabelle/Cards parsen
   - Paginierung folgen (`page=0`, `page=1`, ...)
   - Datum, Titel, Ort, Beschreibung, Bild-URL extrahieren
4. **Geocoding**: Adresse aus Event → Nominatim

**Vorteile:**
- Einheitliches HTML-Format (ASP.NET, gleiche CSS-Klassen)
- Gleiche Query-Parameter überall
- Gleiche Paginierung
- ~62% aller Gemeinden mit EINEM Scraper

**Herausforderungen:**
- `menuonr` variiert pro Gemeinde → muss pro Gemeinde ermittelt werden
- Manche Gemeinden haben Events unter verschiedenen Menüpunkten
- Rate-Limiting beachten (2.092+ Requests)
- ASP.NET ViewState kann Scraping erschweren

#### Phase 2: Spezial-Scraper (niedrige Priorität)
Für die verbleibenden ~800 Gemeinden:
- **TYPO3-Scraper**: Für größere Städte
- **WordPress-Scraper**: Für kleinere Gemeinden mit WP
- **Externe Plattformen**: Eventjet, etc.

### Konkreter Implementierungsplan

```
1. Gemeindeliste herunterladen (GitHub CSV)
2. Burgenland filtern (GKZ beginnt mit 1) → ~101 Gemeinden
3. Für jede: GET /system/web/veranstaltung.aspx testen
4. GEM2GO-Gemeinden identifizieren
5. BaseScraper erweitern: Gem2GoScraper
   - parseEventList(html) → Event[]
   - parseEventDetail(html) → EventDetail
   - paginateEvents(baseUrl, maxPages)
6. Erst Burgenland, dann auf andere Bundesländer ausweiten
```

## 6. Zusammenfassung

| Aspekt | Ergebnis |
|--------|----------|
| Dominantes CMS | GEM2GO (~1.300 / 62% aller Gemeinden) |
| Einheitliches URL-Muster | Ja: `/system/web/veranstaltung.aspx` |
| Öffentliche API | Nein, nur HTML-Scraping |
| Strukturierte Daten (JSON-LD) | Nein |
| RSS-Feeds | Nein (standardmäßig) |
| Gemeindeliste verfügbar | Ja (GitHub CSV mit Website-URLs) |
| Ein Scraper für alle GEM2GO | Ja, technisch möglich |
| Burgenland-Gemeinden | ~101 Stück |

**Fazit:** Ein einziger GEM2GO-Scraper kann den Großteil aller österreichischen Gemeinde-Veranstaltungen abdecken. Das einheitliche ASP.NET-Framework mit konsistenten URL-Mustern und HTML-Strukturen macht systematisches Scraping realistisch. Der Ansatz sollte mit Burgenland (~101 Gemeinden) beginnen und dann auf ganz Österreich skaliert werden.

## Quellen
- https://www.gem2go.info/ — GEM2GO Plattform
- https://www.ris.at/Kommunal/GEM2GO_WEB — GEM2GO WEB CMS
- https://github.com/bresu/oe_gemeinden — Gemeindeliste mit Websites
- https://www.gemeinden.at/ — Gemeindeverzeichnis
- https://gemeindebund.at/ — Österreichischer Gemeindebund
- https://www.data.gv.at/application/gem2go-die-gemeinde-info-und-service-app/ — Open Data Portal

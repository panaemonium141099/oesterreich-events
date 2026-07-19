# Freizeitaktivitäten: POI-Bestand, Affiliate-Monetarisierung & Smart-Suche

## Goal & Context

lasstreffen.at hat ~280k Events, aber null dauerhafte Freizeitaktivitäten (Mountaincart-Bahnen, Rodelbahnen, Hochseilgärten, Bäder, Klettersteige, Museen …). Ziel: eine zweite, **nie ablaufende** Content-Säule in vergleichbarer Größenordnung, die (a) die ~2.000 Gemeinde-SEO-Hubs mit Evergreen-Content füllt, (b) via Viator/GetYourGuide-Affiliate monetarisiert (analog Eventim-TicketBox) und (c) Freizeitbetriebe als neues B2B-Outreach-Segment erschließt.

Recherche-Basis (2026-07-19, live verprobt — Details im Session-Memory `project_freizeit_poi_sources.md`):
- **Feratel Deskline WebAPI** (`webapi.deskline.net/{slug}/de/infrastructures`) liefert mit denselben Headern wie der bestehende Event-Sync vollwertige POIs: Name, Topics-Taxonomie, Koordinaten, strukturierte Saison-Öffnungszeiten, Bilder (inkl. Copyright-Feldern), Beschreibungen. Gezählt: blsalzb 11.600, donauooe 4.862, salzkammergut 4.031, burgenland 2.589 … → über die 131 aktiven REGIONS-Slugs (FeratelScraper.ts) mehrere zehntausend POIs.
- **OSM Österreich** (Stand 2026-07-18, taginfo.geofabrik.de): leisure=155.714, tourism=120.735, sport=42.411 Objekte — Volumen-Backbone für Standard-Kategorien (Spielplätze, Bäder, Sommerrodelbahnen 164, Wasserrutschen 669), schwach bei kommerziellen Action-Nischen (mountain_cart: 2).
- **Viator Partner API**: Basic Access sofort, self-service, ohne Minimums; ~8 % Provision, 30-Tage-Attribution. Bulk-Endpoints erst nach Full-Access-Freigabe + Zertifizierung.
- **GetYourGuide**: Affiliate (Links/Widgets) ohne Traffic-Minimum, ~8 %, 31-Tage-Cookie; Partner-API erst ab 100k Besuchen/Monat (Ist laut Masterplan: ~13,9k PV/30d) → nur Widgets/Deeplinks.
- **Verifizierte No-Gos**: Outdooractive (API-Terms verlangen wörtlich `noindex` auf allen Seiten mit API-Inhalten → SEO-K.-o.), Google Places (nur place_id speicherbar + $32/1k Requests), Komoot (keine öffentliche API), Bergfex/AllTrails (kein API-Zugang, Scraping-Risiko).

## Architecture & Data Models

**Neue Tabelle `activities`** (Supabase, bewusst getrennt von `events`/Venue-Registry):
`id, source ('deskline' | künftig weitere), source_region, source_id, name, slug, description, description_short, tags text[] (gemappt auf bestehende Taxonomie), topics_raw jsonb, lat, lng, town, gemeinde_slug, bundesland, opening_times jsonb, open_status int, is_open_now_computable bool, images jsonb (inkl. copyright/license/author!), guest_cards jsonb, price_hint text (deterministischer €-Regex aus Beschreibung, KEIN KI-Enrichment — Masterplan §6), online_bookable bool, affiliate_product jsonb (Viator-Match: product_code, price_from, rating, url), created_at, updated_at`.
Unique-Key: `(source, source_id)` — dedupliziert automatisch die überlappenden Deskline-Regionen (Mirrors liefern dieselben GUIDs).

**Separate Tabelle `osm_pois`** (Slice 4): identisches Anzeigeschema, aber **strikt getrennt befüllt und NIE mit `activities`/Venues gemergt oder dedupliziert** — ODbL-Collective-Database-Regel (OSMF-Guideline: Merge/Dedup mit proprietären Daten macht den Mix Share-Alike-pflichtig). Verknüpfung nur zur Anzeigezeit (Geo-Join im Query). Attribution „© OpenStreetMap contributors" + ODbL-Link auf /quellen und den Detailseiten.

**Ingestion**: Neuer `DesklineInfrastructureScraper` analog `FeratelScraper` (gleiche REGIONS-Liste, gleiche Header, pageSize 400, Feldliste aus dem bekannten Schema). Läuft als eigener GitHub-Actions-Job (wöchentlich reicht — POIs ändern sich langsam), NICHT auf Vercel. Schreibpfad: eigener Upsert (nicht supabase-sync.ts der Events), Batches ≤500 wegen Micro-Instanz. UTF-8-Normalisierung beim Ingest (Deskline liefert teils Mojibake: „fÃ¼r" → „für"). `GESPERRT`-Namenspräfix → open_status ableiten, Präfix aus Anzeigename strippen.

**Taxonomie**: Deskline-`topics` (deutschsprachige Klarnamen wie „Kartsport/Kartbahn", „Weingut/Weinkeller") → deterministische Mapping-Tabelle auf bestehende Tags/Kategorien in `enrichment-taxonomy.ts` (SoT!), neue Activity-Tags dort ergänzen + `npm run regen:taxonomy`. Unmappbare Topics landen in `topics_raw` und werden geloggt (Nachpflege-Liste).

**Smart-Suche** (`/api/search/semantic` + `src/lib/search/smart-query.ts`):
- `SearchIntent` um `contentTypes: ('event'|'activity')[]` erweitern — whitelisted in `validateIntent` wie alle Vokabulare, Default `['event']` (kein Verhaltens-Drift für Bestandsqueries).
- Gemini-Intent-Prompt erkennt Aktivitäts-Absicht („wo kann ich mountaincart fahren", „was tun bei Regen in Graz") und setzt contentTypes.
- Neuer paralleler Query-Zweig auf `activities`: trgm auf name/description + Tag-Filter aus derselben Taxonomie-Whitelist, **ohne Datumsfilter**.
- INVARIANTE bleibt: Event-Queries IMMER `filter_after_date >= NOW()` (Memory `semantic_search_future_only`) — Aktivitäten sind der einzige datumsfreie Zweig. Sortier-Logik der Route nicht anfassen (EXPLAIN-Kommentar beachten).
- Response-Items bekommen `type: 'event' | 'activity'`; /entdecken rendert gemischte Treffer mit Typ-Badge.

**Affiliate**:
- Viator: Partner-Konto registrieren (self-service), API-Key als Secret in **beiden** Stores (Vercel-Env UND GitHub-Actions — getrennte Speicher!). Matching-Job: pro Aktivität mit passender Kategorie+Ort Viator-Produktsuche (Basic: search + single-product pricing), Treffer in `affiliate_product` cachen (täglicher Refresh-Cron für Preise). Später Full Access beantragen (Bulk-Ingest).
- GetYourGuide: Affiliate-Konto, `partner_id` als Env; Deeplinks/Widgets auf Gemeinde-/Themen-Seiten wo kein Viator-Match existiert.
- Klick-Tracking: `data-track="activity_click"` → läuft automatisch über den bestehenden globalen ClickTracker in `analytics_events`.

## API Contracts

- `GET /api/activities?bundesland=&gemeinde=&tag=&cursor=` — Cursor-Pagination analog `/api/events`, count planned, nie exact.
- Seite `/aktivitaet/[slug]` — RSC + ISR (statische Shell, kein cookies()/auth im RSC-Pfad, wie Landing), mit: Hero-Bild (+ Copyright-Anzeige), Fakten-Leiste (Saison, „Jetzt geöffnet"-Badge aus opening_times, Familientauglich, Gästekarten-Hinweis), Beschreibung, Mapbox-Mini-Map, Quelle-Attribution (Pflicht — Memory `event_source_attribution_legal` gilt analog), Viator/GYG-Box, „Events in der Nähe" (Geo-Join).
- Gemeinde-Hubs: Sektion „Freizeit & Ausflüge" mit Kategorie-Chips, rendert ab ≥3 Aktivitäten in der Gemeinde.
- `/api/search/semantic`: Items um `type` erweitert (abwärtskompatibel — bestehende Clients ignorieren das Feld).
- Sitemap: `/aktivitaet/*`-URLs ergänzen.

## Edge Cases & Constraints

- **Supabase Micro**: Initial-Load in Batches, GIN-Index auf tags + trgm-Index auf name erst NACH dem Bulk-Load anlegen; keine breiten Scans; `count: 'planned'`.
- Deskline-Regionen überlappen (Kärnten-Mirrors etc.) → `(source, source_id)`-Unique fängt das ab; Regionen-Rotation nicht nötig (Volumen klein gegen Gemeinde-Scraper).
- Keine strukturierten Preise bei Deskline → `price_hint` nur wenn €-Regex eindeutig; UI zeigt sonst „Preis beim Anbieter".
- Deskline ohne öffentliche Nutzungsbedingungen → bewusst gleiche Grauzonen-Entscheidung wie beim bestehenden Event-Sync; Bilder nur mit intaktem Copyright-Feld anzeigen; Betreiber-Takedown-Prozess wie bei Events.
- Viator Basic hat Rate-Limits und keine Bulk-Endpoints → Matching-Job drosseln (Queue, z. B. 2 req/s), nur Aktivitäten mit kommerziellen Kategorien matchen (nicht 30k Weingüter).
- `openStatus`/`openingTimes` können fehlen → Badge nur rendern wenn berechenbar (`is_open_now_computable`).
- i18n: /en-Variante der Aktivitätsseiten erst nach fn-17-Abschluss (Boundary, nicht blockierend).

## Acceptance Criteria

- [ ] ≥20.000 Aktivitäten mit Koordinaten + Gemeinde-Zuordnung in `activities` (Deskline-Initial-Import, dedupliziert)
- [ ] `/aktivitaet/[slug]` live: Öffnungszeiten-Badge, Karte, Quellen- und Bild-Attribution sichtbar
- [ ] Gemeinde-Hub zeigt „Freizeit & Ausflüge"-Sektion (ab ≥3 Aktivitäten), intern verlinkt auf Detailseiten
- [ ] Smart-Suche: „wo kann ich mountaincart fahren" liefert Aktivitäts-Treffer mit Typ-Badge; Regressionstest belegt, dass Event-Queries weiterhin ausschließlich future Events liefern
- [ ] Viator-Erlebnis-Box rendert bei Produkt-Match mit „ab €"-Preis und `data-track="activity_click"`; Klicks erscheinen in `analytics_events`
- [ ] GYG-Deeplinks tragen `partner_id`; Viator-Links tragen Partner-Ref
- [ ] Sitemap enthält Aktivitäts-URLs; Event-Detail zeigt „In der Nähe"-Aktivitäten
- [ ] Vitest: Topic→Tag-Mapping, validateIntent(contentTypes), Ingest-Dedup, €-Regex (gegen Baseline, nicht absolut grün)
- [ ] OSM-Slice: `osm_pois` befüllt aus Geofabrik-PBF (kuratierte Kategorien-Whitelist), getrennt gehalten, OSM-Attribution auf /quellen + Detailseiten

## Boundaries

**Out of scope:** Overture/Foursquare-Import (Qualität in AT fraglich, erst nach OSM evaluieren) · Karten-Layer auf /map (Follow-up-Epic, map-points-Muster liegt bereit) · On-site-Booking (Viator Full+Booking) · Betreiber-Website-Preis-Scraping · GYG Partner-API (Traffic-Minimum 100k/Monat nicht erreicht) · KI-Enrichment jeglicher Art (Masterplan §6) · Social-Features-Anbindung · Outdooractive/Google Places/Komoot/Bergfex (verifizierte No-Gos, siehe oben).

## Decision Context

- **Deskline zuerst, nicht OSM**: bereits produktiv genutzte API-Familie (FeratelScraper), live verprobt, reichste strukturierte Daten (Saison-Öffnungszeiten, Gästekarten) für genau die kommerziellen Action-POIs, die OSM kaum abdeckt — und ohne ODbL-Komplexität. OSM folgt als Slice 4 mit eigener Tabelle.
- **Viator als Daten-/Geldpfad, GYG nur Links**: Viator Basic = sofortiger API-Zugang ohne Minimums (Primärquelle verifiziert); GYG-API braucht 100k Visits/Monat — Faktor 7 über Ist.
- **Getrennte OSM-Tabelle statt Merge**: OSMF Collective-Database-Guideline — Merge/Dedup würde Share-Alike auf die proprietären Daten ausdehnen; logische Trennung genügt (gleiche Instanz ok).
- **`contentTypes` mit Default `['event']`**: kein Verhaltens-Drift der bestehenden Suche, Whitelist-Guard-Muster von validateIntent bleibt konsistent.
- **Wöchentlicher GH-Actions-Cron statt Vercel**: Masterplan-Linie „Scraping/Feed-Imports weg von Vercel".

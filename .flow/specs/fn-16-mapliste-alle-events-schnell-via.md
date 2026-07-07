# Map/Liste: alle Events schnell via kompaktem Points-Snapshot

## Goal & Context
/map und /entdecken laden heute ALLE ~68.653 publizierbaren Future-AT-Events über ~30 sequenzielle `/api/events?limit=3000`-Cursor-Batches (~45 MB, 30+ s bis komplett). Jede Batch-Query kostet die DB 10-13 s (EXPLAIN ANALYZE verifiziert: BitmapAnd über 40k Heap-Pages = 325 MB Disk-I/O, Instanz-Cache zu klein, Wiederholung wird NICHT schneller). Jede Filteränderung bricht ab und startet die Schleife neu. Ziel: Karte mit allen Events in <2 s interaktiv, Filterwechsel ohne Netzwerk-Roundtrip (instant), DB-Last des Bulk-Pfads eliminiert.

Gemessene Grundlage (2026-07-05):
- Points-Payload aller 68.653 Events (id+lat+lng+category+start_date+score): 4 MB raw ≈ 59 B/Event
- Labels (title+location_name+image_url) zusätzlich: +8 MB raw ≈ 118 B/Event
- Slim-18-Felder: ~600 B/Event = ~40 MB raw für alle
- Partial-Index idx_events_map_publishable_v2 existiert, nutzlos weil Heap-I/O dominiert

## Architecture & Data Models
Zweistufig ("points first, details on demand"):

1. **MV `public.event_map_points`** (narrow, ~68k Zeilen x ~60-80 B = wenige MB, bleibt im Buffer-Cache):
   Spalten: id, latitude, longitude, category, start_date, end_date, bundesland, district, price_tier, is_student_friendly, is_family_friendly, is_boosted, event_score, price_text (kurz, fuer Gratis-Badge).
   Filter: visibility='public' AND country='AT' AND publish_status IN ('published','published_low_confidence') AND lat/lng NOT NULL AND start_date >= now()::date.
   UNIQUE INDEX auf (id) — plain column, damit REFRESH CONCURRENTLY funktioniert (Lektion aus event_stats_cache, #73).
   pg_cron-Refresh alle 15 min CONCURRENTLY.

2. **RPC `get_event_map_points()` RETURNS jsonb**: aggregiert die MV EINMAL pro Aufruf spaltenweise (columnar: ids[], lat[], lng[], cat[] als Dictionary-Indizes + cats[], start[] als day-offset, flags[] als Bitmaske) → ein PostgREST-Roundtrip, kein max_rows-Limit-Problem. STABLE, GRANT anon (nur oeffentliche Daten; 8s-anon-Timeout reicht locker fuer MV-Scan).

3. **API-Route `/api/events/map-points`**: anon-key Client, ruft RPC, `Cache-Control: public, s-maxage=900, stale-while-revalidate=86400`. Wire-Groesse geschaetzt ~1,5-2 MB brotli. warm-cache-Cron warmt den Pfad mit.

4. **Client (/map)**: use-filtered-events bekommt einen points-Modus — EIN Fetch statt Batch-Schleife; Mapbox-GeoJSON aus columnar decodiert; Filter (Kategorie/Datum/Bundesland/District/PriceTier/Student/Family) laufen client-seitig ueber die Points = instant, kein Refetch. Popup/Detail bei Klick via bestehendem /api/events/[id]. Tags-Filter + Textsuche bleiben Server-Pfad (Fallback auf bisherige Batch-Logik, dann aber bbox-begrenzt).

5. **Client (/entdecken Liste)**: Hintergrund-Vollschleife entfaellt; Cursor-Batch wird nur nachgeladen, wenn der IntersectionObserver das Ende der geladenen Menge erreicht (lazy). District-Filter wird dafuer Server-Param (route.ts: .in('district', ...)).

## API Contracts
GET /api/events/map-points → 200 JSON:
{ v: 1, generatedAt: iso, n: int, ids: string[], lat: number[], lng: number[], cat: int[], cats: string[], start: int[] (Tage seit 2026-01-01), end: int[] (0 = null), bl: int[], bls: string[], district: int[], districts: string[], tier: int[], tiers: string[], flags: int[] (bit0 boosted, bit1 student, bit2 family, bit3 gratis), score: int[] }
Alle Arrays gleiche Laenge n; Reihenfolge stabil nach event_score DESC.

## Edge Cases & Constraints
- MV leer/Refresh fehlgeschlagen → RPC liefert n=0; Client faellt auf bisherige Batch-Logik zurueck.
- Events ohne district/tier → Dictionary-Index 0 = ''.
- DE/CH-Toggle (atOnly=false) ist NICHT im Snapshot → weiterhin Server-Pfad.
- Boosted-Events: is_boosted im Snapshot; separate artist-events-Source bleibt unberuehrt.
- sessionStorage-Cache: Points-Payload ist ~5-6 MB raw → NICHT in sessionStorage (5-MB-Quota); stattdessen In-Memory + HTTP-Cache reicht (CDN 900 s).
- Refresh-Drift: Punkte max. 15 min alt + CDN 15 min → max ~30 min Verzoegerung fuer neue Events. Akzeptiert.

## Acceptance Criteria
- [ ] /map zeigt alle ~68k AT-Events nach EINEM Points-Request (<2 s auf Desktop-DSL, Wire <2,5 MB)
- [ ] Filterwechsel (Kategorie/Datum/District/PriceTier) auf /map ohne Netzwerk-Request, Karte aktualisiert <200 ms
- [ ] Keine limit=3000-Batch-Schleife mehr beim /map-Erstbesuch (Network-Tab)
- [ ] pg_stat_statements: keine neuen 10s+-Queries; RPC-Mean <500 ms
- [ ] REFRESH CONCURRENTLY event_map_points laeuft fehlerfrei (pg_cron)
- [ ] /entdecken laedt nicht mehr alle Batches im Hintergrund, sondern lazy beim Scrollen
- [ ] Tags-Filter + Textsuche funktionieren unveraendert (Server-Pfad)

## Boundaries
Out of scope: Vector-Tiles/Mapbox-Tilesets, DE/CH-Snapshot, Aenderungen an EventMap-Markerdesign, Virtualisierung der Liste, /api/events-Refactor (separater Punkt der Perf-Liste), Write-Pfad-Fixes.

## Decision Context
Alternativen erwogen: (a) bbox-basiertes Nachladen pro Viewport — verworfen weil User explizit ALLE Events auf der Karte will und jeder Pan/Zoom neue DB-Round-Trips kostet; (b) Slim-18-Snapshot als eine Datei — verworfen: ~40 MB raw / >6 MB wire, mobil zu schwer; (c) covering INCLUDE-Index auf events — verworfen: repariert nur die DB-Seite, Client laedt weiterhin 45 MB in 30 Requests. Points-MV + columnar RPC folgt dem in #73 etablierten, verifizierten MV-Muster.

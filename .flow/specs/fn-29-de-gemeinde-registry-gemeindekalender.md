# DE-Gemeinde-Registry: Gemeindekalender für lasstreffen.de

## Goal & Context
lasstreffen.de soll die Veranstaltungen jeder deutschen Gemeinde führen, vor allem
Dorffeste, Feuerwehrfeste, Kirchweih, Schützenfeste und Weihnachtsmärkte. Die
Vollerhebung aus fn-28 (`docs/research/de-gemeinden/01-vollerhebung.md`, CSV
`docs/research/de-gemeinden/data/vollerhebung-2026-10.csv`) hat jede der 10.749
Gemeinden (Destatis 30.09.2026) genau einer Integration zugeordnet: 79,0 % über die
eigene Website, 89,0 % zusammen mit Amts/VG-Kalender und meinOrt. Dieses Epic setzt
das um, nach dem Muster von `GemeindeRegistryScraper` in Österreich.

## Architecture & Data Models
1. **DE-Stammdaten** nach dem Ein-System-Prinzip von fn-27: amtliche Gemeindeliste
   (Destatis GV-ISys: AGS/ARS, Name, Verband, Kreis, Land, PLZ, Mittelpunkt) als
   Datei unter `data/`, Zugriff nur über `src/lib/gemeinden/` bzw. `src/lib/location/`
   mit Länderschalter. Keine Parallelwelt, keine Platzhalter-Koordinaten.
2. **Registry-Datei** `data/de-gemeinde-registry.json`: je Gemeinde AGS, Integration
   (Schlüssel wie Spalte `integration` der CSV), Kalender-URL bzw. Feed-URL, Fallback
   (Amt/VG-Host, meinOrt), Prüfdatum. Erzeugt aus der Vollerhebung, gepflegt per
   Wiederholung der Erhebung (Skripte `docs/research/de-gemeinden/vollerhebung/`).
3. **Adapter je Integration** (ein Adapter, viele Gemeinden), Reihenfolge nach
   Abdeckung: ionas `events.json`, NOLIS iCal, The Events Calendar REST, communice
   Atom, Cross7 JSON, Komm.ONE RSS, MEC/JEvents/iCagenda/Events Manager/DPCalendar;
   dann HTML: verwaltungsportal.de (Liste + AJAX + JSON-LD), Hirsch & Wölfl
   `hwveranstaltung`, iKISS, tx_news, Contao, Weblication, cEasy; dann allgemeiner
   Parser (JSON-LD, Liste mit Datum) für Stufe E.
4. Alle Adapter schreiben über `src/lib/db/supabase-sync.ts` mit `country = 'DE'`;
   Ort über den Resolver, Quelle und Link je Event (Attributionspflicht).
5. Scrape-Shards wie AT (`getScrapersForShard`), Fortsetzungs-Cursor wie
   `rotation-cursor.ts`.

## API Contracts
- Registry-Eintrag: `{ ags, name, land, integration, url, feed_url?, fallback?: { host, integration } | { meinort_id }, checked_at }`
- Adapter-Schnittstelle wie bestehende Scraper (`BaseScraper`), Eingabe: Registry-Einträge
  einer Integration, Ausgabe: normalisierte Events mit `source_name`, `source_url`,
  `source_id` (stabil, nie aus gekürzten Strings, siehe CLAUDE.md).

## Edge Cases & Constraints
- Nur lesende Abrufe, robots.txt beachten, Crawl-delay einhalten (GeoCMS 15, Komm.ONE 30).
- Lizenzquellen (meinOrt, Heimat-Info, termine-regional.de, toubiz, RCE, TMV, NUSSBAUM)
  erst nach schriftlicher Zustimmung anbinden; WITTICH-Anfrage läuft seit 27.10.2026.
- Gemeinde-Etiketten sind oft Kalender-Gemeinde, nicht Veranstaltungsort (Dedup-Regel).
- Kalender mit Sitzungen, Müllabfuhr, Sprechstunden: Gemeinde-Dienste-Quarantäne wie AT
  (`municipal_service`).
- ionas: nicht jede Seite nutzt das TVM-Modul; Pfad aus `data-source` lesen.
- Supabase Micro: Write-Batches ≤ 500, `.in()` ≤ 200, keine `count exact`.
- Öffentliche Abfragen filtern `SITE_COUNTRY`; DE-Events bleiben bis zum Start von
  lasstreffen.de unsichtbar.

## Acceptance Criteria
- [ ] DE-Stammdaten im Ein-System (Destatis), Wächter-Test analog `gemeinde-config.test.ts`
- [ ] `data/de-gemeinde-registry.json` aus der Vollerhebung, je Gemeinde genau ein Eintrag
- [ ] Adapter Stufe A (12 Integrationen) mit Golden-Tests aus echten Proben
- [ ] Adapter Stufe B mindestens verwaltungsportal.de, Hirsch & Wölfl, iKISS
- [ ] Allgemeiner Parser für Stufe E
- [ ] Nachtlauf in Shards mit Cursor, Abdeckung je Land im Pipeline-Report
- [ ] Dorffest-Stichprobe: je Land mindestens 5 echte Dorffeste aus der Pipeline in der DB

## Boundaries
Kein Start von lasstreffen.de (Domain, Routing, SEO) in diesem Epic. Keine
Tourismus-/Ticketing-Quellen (destination.one, DZT, Eventim.de, Reservix) außer
eingebetteten Gemeinde-Widgets. Keine Lizenzquellen ohne Zustimmung.

## Decision Context
Registry plus wenige Adapter statt Einzelscraper, weil die Vollerhebung zeigt, dass
rund 40 Integrationen 61 % der Gemeinden tragen und ein allgemeiner Parser weitere 18 %.
Stammdaten zuerst, weil Ort, Bezirk und Land in AT nur über das Ein-System sauber wurden
(fn-25/fn-27).

# DE-Gemeinde-Registry: Gemeindekalender für lasstreffen.de

## Goal & Context
lasstreffen.de soll die Veranstaltungen jeder deutschen Gemeinde führen, vor allem
Dorffeste, Feuerwehrfeste, Kirchweih, Schützenfeste und Weihnachtsmärkte. Die
Vollerhebung aus fn-28 (`docs/research/de-gemeinden/01-vollerhebung.md`, CSV
`docs/research/de-gemeinden/data/vollerhebung-2026-10.csv`) hat jede der 10.749
Gemeinden (Destatis 30.09.2026) genau einer Integration zugeordnet: 79,0 % über die
eigene Website, 89,0 % zusammen mit Amts/VG-Kalender und meinOrt. Dieses Epic setzt
das um, nach dem Muster von `GemeindeRegistryScraper` in Österreich.

**Oberste Priorität ist Datenqualität:** Deutsche Daten müssen genauso gut sein wie
die von lasstreffen.at. Menge kommt danach. Kein Adapter schreibt, bevor der
Qualitätsvertrag (unten) für Deutschland gilt, und kein Adapter geht in den Nachtlauf,
bevor sein Prüfstand die Schwellen erreicht.

## Qualitätsvertrag DE (Rahmenbedingungen, verbindlich für jeden Task)

Grundsatz: Es gibt keine eigenen Regeln für Deutschland. Dieselben Module wie in
Österreich entscheiden, sie werden nur länderfähig gemacht. Unbekanntes bleibt
unbekannt; was nicht sicher ist, wird nicht veröffentlicht.

1. **Ein Freigabevertrag:** `src/lib/quality/admission.ts` entscheidet admit,
   quarantine oder reject auch für DE. Heute prüfen Freigabevertrag und Ortsresolver
   Orte nur für `country === 'AT'` (u. a. `isOutsideAtBox`, `evidence.ts`,
   `resolver.ts`); DE-Zeilen laufen dort ungeprüft durch. Das wird zuerst geschlossen
   (Task 1). Bis dahin schreibt kein DE-Gemeindeadapter in die Datenbank.
2. **Ort nur über den Resolver** (`src/lib/location/`) mit DE-Stammdaten im
   Ein-System (Task 2). Keine Platzhalter-Koordinaten, Gemeinde-Mittelpunkt nur mit
   `coords_precision: 'municipality'`. Etiketten des Kalenders (Gemeinde, Amt, VG)
   sind nicht der Veranstaltungsort; ein Amtskalender ordnet Termine nur der Gemeinde
   zu, die der Termin selbst nennt.
3. **Titel nach `src/lib/scrapers/event-title.ts`:** Datum/Uhrzeit ist nie ein Titel,
   ausgezeichnete Namen vor Überschriften, kein Screenreader-Text, Müll-Titel verwirft
   der Sync (`isGarbageTitle`). Keine Listen verbotener Wörter.
4. **Zeit:** Wandzeit Europe/Berlin mit Offset im Schreibpfad. Quellen ohne Offset
   (z. B. ionas `events.json`) werden als Ortszeit gelesen, Quellen mit `Z` nur dann als
   UTC, wenn die Probe das belegt (NUSSBAUM-`Z` ist Ortszeit). Keine erfundene Uhrzeit:
   ganztägig bleibt ganztägig. Datum nie als Uhrzeit lesen (PR #302).
5. **Gemeinde-Dienste nicht anzeigen:** Sitzungen, Sprechstunden, Müllabfuhr,
   Bekanntmachungen gehen in Quarantäne `municipal_service`
   (`src/lib/category-classifier/municipal-service.ts`), Vokabular um deutsche
   Begriffe ergänzt (z. B. Ortsgemeinderat, Gelber Sack, Bürgersprechstunde), belegt
   aus echten Proben der Adapter.
6. **Inhalt nur aus der Quelle:** keine KI-Beschreibungen (MASTERPLAN §6), Kategorie
   nur über den deterministischen Classifier. Bilder nur mit belegtem Nutzungsrecht,
   im Zweifel ohne Bild.
7. **Identität und Bestand:** `source_id` stabil und nie aus gekürzten Strings;
   bei Wechsel `previous_source_id`. Rückzug (`withdrawal`), Nachprüfung
   (`admission_recheck`) und Dedup (`dedup-engine.ts`, Belege statt Quellenregeln)
   laufen für DE wie für AT; neue Fehlerfälle als Golden-Tests.
8. **Quelle sichtbar:** jede Detailseite nennt `source_name` und verlinkt `source_url`.
9. **Abrufe:** nur lesend, robots.txt beachten, Crawl-delay einhalten, über
   `BaseScraper.fetchHtml`. Lizenzquellen erst nach schriftlicher Zustimmung.
10. **Prüfstand vor Nachtlauf:** Jeder Adapter läuft zuerst auf dem DE-Prüfstand
    (Task 4): Listen einmal laden und cachen, Parser vorher/nachher, Diff nach
    `source_id`, dazu eine manuelle Stichprobe von 30 Events gegen die Quellseite.
    Schwellen je Adapter:
    - Titel, Datum, Uhrzeit: 30 von 30 korrekt
    - Ort korrekt oder in Quarantäne: 30 von 30, nie ein falscher Ort sichtbar
    - sichtbare Gemeinde-Dienste: 0
    - Müll-Titel, Platzhalter-Uhrzeiten, Platzhalter-Koordinaten: nicht schlechter
      als die AT-Referenzwerte (Task 4 misst sie für gem2go, gemeinde-registry,
      gemeinden-generic)
    - Dedup-Audit nach dem ersten Lauf: nicht schlechter als AT
    Ein Adapter, der eine Schwelle reißt, geht nicht in den Nachtlauf.

## Architecture & Data Models
1. **DE-Stammdaten** nach fn-27: amtliche Gemeindeliste (Destatis GV-ISys: AGS/ARS,
   Name, Verband, Kreis, Land, Mittelpunkt) und eine PLZ-Zuordnung mit belegter Lizenz
   als Datei unter `data/`, Zugriff nur über `src/lib/gemeinden/` bzw.
   `src/lib/location/` mit Länderschalter. Keine Parallelwelt.
2. **Registry-Datei** `data/de-gemeinde-registry.json`: je Gemeinde AGS, Integration,
   Kalender- bzw. Feed-URL, Fallback (Amt/VG, meinOrt), Prüfdatum. Erzeugt aus der
   Vollerhebung, gepflegt per Wiederholung (`docs/research/de-gemeinden/vollerhebung/`).
3. **Adapter je Integration** (ein Adapter, viele Gemeinden) in der Reihenfolge der
   Abdeckung aus `01-vollerhebung.md` Abschnitt 2.
4. Schreibweg nur `src/lib/db/supabase-sync.ts` mit `country = 'DE'`.
5. Nachtlauf in eigenen Shards mit Fortsetzungs-Cursor (`rotation-cursor.ts`).

## API Contracts
- Registry-Eintrag: `{ ags, name, land, integration, url, feed_url?, fallback?: { host, integration } | { meinort_id }, checked_at }`
- Adapter wie bestehende Scraper (`BaseScraper`): Eingabe Registry-Einträge einer
  Integration, Ausgabe normalisierte Events mit `source_name`, `source_url`, `source_id`.
- Prüfstand: `npm run pruefstand:de -- --adapter <name> [--sample 30]` mit Bericht
  (Metriken je Schwelle, Stichprobenliste zum Abhaken).

## Edge Cases & Constraints
- Crawl-delay: GeoCMS 15 s, Komm.ONE 30 s, NUSSBAUM 10 s.
- ionas: nicht jede Seite nutzt TVM; Pfad aus `data-source` lesen.
- Amts-/VG-Kalender: Termine mehrerer Gemeinden, Ort aus dem Termin.
- Supabase Micro: Write-Batches ≤ 500, `.in()` ≤ 200, kein `count exact`.
- Öffentliche Abfragen filtern `SITE_COUNTRY`; DE bleibt bis zum Start unsichtbar.

## Acceptance Criteria
- [ ] Qualitätsvertrag gilt für DE: Freigabevertrag, Resolver, Gemeinde-Dienste, Zeit (Golden-Tests mit echten DE-Fällen)
- [ ] DE-Stammdaten im Ein-System, Wächter-Tests
- [ ] Prüfstand DE mit AT-Referenzwerten
- [ ] `data/de-gemeinde-registry.json`, je Gemeinde genau ein Eintrag
- [ ] Jeder Adapter hat seinen Prüfstand-Bericht mit erreichten Schwellen im PR
- [ ] Nachtlauf mit Abdeckung je Land im Pipeline-Report
- [ ] Dorffest-Stichprobe: je Land mindestens 5 echte Dorffeste, gegen die Quelle geprüft

## Boundaries
Kein Start von lasstreffen.de (Domain, Routing, SEO). Keine Tourismus- oder
Ticketing-Quellen außer eingebetteten Gemeinde-Widgets. Keine Lizenzquellen ohne
Zustimmung.

## Decision Context
Qualität vor Menge, weil lasstreffen.at seine Datenqualität über Monate erarbeitet hat
(fn-24 Freigabevertrag, fn-25/fn-27 Ortsdaten, Dedup auf Belegen) und lasstreffen.de
dieselbe Marke trägt. Registry plus wenige Adapter statt Einzelscraper, weil rund 40
Integrationen 61 % der Gemeinden tragen und ein allgemeiner Parser weitere 18 %.

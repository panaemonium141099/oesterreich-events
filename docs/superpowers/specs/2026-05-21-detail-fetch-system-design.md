# Detail-Fetch-System — Universal Extractor + Source Adapters

**Status:** Design • **Datum:** 2026-05-21 • **Author:** Jona + Claude

## Goal & Context

Auf der Plattform fehlt bei **60.730 von ~95.000 zukünftigen Events das `address`-Feld** (Straße + Hausnummer als Text). Die Plattform hat zwar fast überall Koordinaten (Geocoding-Pipeline) und meist Venue-Name + PLZ, aber keine vollständige Anschrift — was Routing-Trust und SEO beschädigt. Ähnliches Problem bei `description` und `price_text`: ~50–95 % Fehlrate je nach Quelle.

**Root Cause:** Die meisten Scraper parsen nur Listing-Seiten, nie die Detailseiten der Veranstaltungen. Auf den Detailseiten sind die Anschriften zuverlässig vorhanden (JSON-LD `Event.location.address.streetAddress`, OpenGraph, vertical-table-Layouts, oder labeled regex). Für die Gemeinde-Familie (`gem2go`, `gemeinde-registry`, `gemeinden-generic`) existiert schon ein 5-Layer-Detail-Extractor (`src/lib/scrapers/gem2go-detail.ts`), der ~49 % der gem2go-Events erfolgreich enrichted. Dieses Pattern muss verallgemeinert und auf alle Scraper ausgerollt werden — ohne KI.

**Top-Verursacher (future events, missing address):**

| Source                | Total | Missing | %    | Status               |
| --------------------- | ----: | ------: | ---: | -------------------- |
| gemeinden-generic     | 14038 |   14038 | 100% | hat Extractor        |
| gemeinde-registry     | 16630 |   14036 |  84% | hat Extractor        |
| feratel-deskline      | 11674 |   11673 | 100% | OUT-OF-SCOPE (s. §9) |
| gem2go                | 17151 |    8405 |  49% | hat Extractor        |
| meinbezirk            |  2043 |    2040 | 100% | braucht Adapter      |
| gemeinden (WP)        |  1018 |    1018 | 100% | braucht Adapter      |
| falter                |   587 |     587 | 100% | braucht Adapter      |
| boudicca:linz termine |  1914 |     537 |  28% | braucht Adapter      |
| boudicca:kupfticket   |   906 |     325 |  36% | braucht Adapter      |
| kultur-graz           |   324 |     324 | 100% | braucht Adapter      |
| ntry.at, partytimer,  |       |         |      |                      |
| innsbruck-clubs, …    |       |         |      | braucht Adapter      |

**Entscheidungen (aus Brainstorming):**

- Adresse = **Straße + Nr + PLZ + Ort** als Text (`address`-Feld).
- Wenn Extraktion trotz Detail-Fetch + Fallbacks fehlschlägt → **Soft-Gate**: Event wird mit `publish_status='published_low_confidence'` + Quality-Flag `missing_address_street` publiziert (nicht versteckt).
- **Reihenfolge:** Erst Pipeline schützen (neue Scrape-Runs sind sauber), dann Backfill der 60k Bestandsevents.
- **Ein Code, zwei Aufrufer:** Sync-Pipeline-Hook in BaseScraper + Offline-Backfill-Skript nutzen denselben Extractor.

---

## 1. Architektur — Module

```
src/lib/scrapers/detail-extract/
├── extract.ts            ← Public API: enrichFromDetailHtml(sourceName, url, html, ctx?)
├── universal.ts          ← Universelle Layer (JSON-LD, OG, vertical table, regex)
├── merge.ts              ← Merge-Regeln pro Feld (detail-wins vs listing-wins)
├── validate.ts           ← isValidAddressText(), isValidHtml(), confidence-mapping
├── registry.ts           ← source_name → Adapter-Resolver
├── types.ts              ← DetailEnrichment, Adapter, MergePolicy, Confidence
├── adapters/
│   ├── gem2go.ts         ← (Refactor von gem2go-detail.ts, CSS-Layer ausgelagert)
│   ├── falter.ts
│   ├── meinbezirk.ts
│   ├── ntry.ts
│   ├── innsbruck-clubs.ts (treibhaus, p.m.k., etc.)
│   ├── events-at.ts
│   ├── eventfrog.ts
│   ├── kultur-graz.ts
│   ├── partytimer.ts
│   └── boudicca.ts        (mehrere boudicca:* sources teilen sich einen Adapter)
└── __tests__/
    ├── universal.test.ts
    ├── merge.test.ts
    ├── validate.test.ts
    └── adapters/
        ├── gem2go.test.ts          (mit fixture-HTMLs)
        ├── falter.test.ts
        └── ...

src/lib/scrapers/BaseScraper.ts
└── enrichFromDetail(events, opts?)   ← opt-in protected hook

src/scripts/
├── backfill-detail-enrich.ts        ← Offline-Backfill (chunked, resume-fähig)
└── probe-adapter.ts                 ← Diagnose: was findet Universal vs. was fehlt

src/lib/scrapers/gem2go-detail.ts    ← legacy export, ruft intern detail-extract auf
                                       (kein Callsite-Bruch)
```

**Boundaries:**

- `detail-extract/` ist eine **reine Library** ohne I/O (kein fetch, kein DB-Zugriff). Input: `(sourceName, url, html, ctx?)`. Output: `DetailEnrichment & { confidence, layersHit }`.
- `BaseScraper.enrichFromDetail()` und `backfill-detail-enrich.ts` sind die einzigen Stellen, die `fetch` + `enrichFromDetailHtml` kombinieren.
- Adapter sind isolierte Funktionen. Ein Adapter darf NUR `$: CheerioAPI` lesen und Felder zurückgeben — kein eigener Layer-2-Stack, der Universal-Layer 1/3/4/5 macht der Caller.

---

## 2. Layered Extraction (5 Layer)

| #   | Layer                                | Wo              | Vertrauen | Bemerkung                                                                                               |
| --- | ------------------------------------ | --------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| 1   | **JSON-LD `Event`**                  | universal       | high      | `location.address.{streetAddress,postalCode,addressLocality}`, `offers.{price,lowPrice,highPrice}`      |
| 2   | **Source-spezifische CSS-Selektoren**| adapter         | high      | Adapter weiß: `.va-adr-strasse` für gem2go, `.event-venue` für falter, etc.                             |
| 3   | **OpenGraph meta**                   | universal       | medium    | `og:image`, `og:description` (fallback wenn Layer 1/2 nichts hatten)                                    |
| 4   | **Microformat / vertical table**     | universal       | medium    | `<th>Ort</th><td>...</td>` Layout — kommt bei sparse gem2go + manchen Gemeinde-WP-Themes vor            |
| 5   | **Labeled-text regex**               | universal       | low       | `Adresse:`, `Eintritt:`, PLZ-City — letztes Mittel im `<main>`-Body. Strenge Regexe gegen False-Positive |

Reihenfolge der Anwendung: 1 → 2 → 3 → 4 → 5. Jeder Layer trägt nur ein wenn der Slot frei ist. Adapter dürfen JSON-LD-Werte ÜBERSCHREIBEN, wenn sie scraper-spezifisch wissen, dass die JSON-LD-Adresse für diese Quelle unzuverlässig ist (rare; opt-in pro Adapter).

`extract.ts` returnt zusätzlich `address_confidence` (high|medium|low) basierend auf dem Layer, der `address` gefunden hat. Wird in `events.address_confidence` (neue Spalte) persistiert.

---

## 3. Source Adapter — Schnittstelle

```ts
// src/lib/scrapers/detail-extract/types.ts
export interface Adapter {
  /** Eindeutige source_name(s) für die dieser Adapter zuständig ist. */
  sourceNames: string[];

  /**
   * CSS-basierte Extraktion (Layer 2).
   * Darf JSON-LD-Werte aus `current` lesen, aber NICHT überschreiben es sei denn
   * `overridesJsonLd === true`.
   */
  extract(
    $: CheerioAPI,
    current: Readonly<DetailEnrichment>,
    url: string,
  ): Partial<DetailEnrichment>;

  /** Default false. Wenn true, gewinnt dieser Adapter über JSON-LD. */
  overridesJsonLd?: boolean;

  /**
   * Optional. Validity-Check: wenn das HTML kein "echtes" Event-Detail ist
   * (Cookie-Wall, Wartungsseite, 404-Soft), false zurückgeben → kein enrichment.
   * Default: universal isValidHtml() reicht für die meisten Adapter.
   */
  isDetailPage?($: CheerioAPI, url: string): boolean;
}
```

**Adapter-Lookup: per `source_name`** (NICHT Hostname / URL-Pattern).

Begründung: gem2go läuft auf 2000+ verschiedenen Gemeinde-Hosts; URL-Matching wäre fragil. Der `source_name` ist in der Scrape-Pipeline bekannt (jeder Scraper kennt seinen Namen) und im Backfill aus der DB lesbar. Eindeutig, robust, debugfreundlich.

`registry.ts` exposed `getAdapter(sourceName) → Adapter | null`. Wenn kein Adapter registriert ist, läuft trotzdem der Universal-Stack — viele Sites haben JSON-LD und OG, das reicht oft.

---

## 4. Merge-Regeln pro Feld

Klar codiert in `merge.ts`, nicht ad-hoc verteilt:

| Feld            | Strategie                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `address`       | **Detail wins** wenn validAddressText (s. §6). Listing fällt sonst zurück.                          |
| `postal_code`   | Detail wins wenn 4-stellig Ziffer.                                                                  |
| `location_name` | Detail wins wenn LÄNGER als Listing (Listing hat oft nur Stadtnamen, Detail hat Venue).             |
| `description`   | **Listing wins wenn schon ≥ 200 chars**, sonst Detail. (Listing-Description ist oft gezielt geschrieben.) |
| `image_url`     | Detail wins (Hi-Res statt Listing-Thumbnail), wenn `cleanImageUrl` passt.                            |
| `price_text` / `price_min` / `price_max` | Detail nur wenn Listing leer war.                                                |
| `organizer`     | Detail nur wenn Listing leer.                                                                       |
| `start_date` / `end_date` | **NIE überschreiben.** Datum-Parsing macht das Listing — Detail darf das nicht verschlimmbessern. |
| `latitude` / `longitude` | NIE überschreiben (Geocoding-Pipeline ist authoritative).                                  |
| `title`         | Detail wins wenn (Listing-Title kontaminiert mit HTML/Newlines) → s. §10 für Erkennung.             |

---

## 5. HTML-Validity-Check (vor Extraction)

`validate.ts` exportiert `isValidHtml(html, $): boolean`:

- Reject wenn `<title>` enthält: "404", "not found", "wartung", "maintenance", "access denied"
- Reject wenn HTML body < 200 chars effective text (nach Strip-Scripts/Styles)
- Reject wenn Cookie-Wall: > 50 % der `<main>` ist "cookie", "datenschutz", "akzeptieren" tokens
- Reject wenn kein `<main>`, kein JSON-LD, KEIN `og:image` und kein structured h1+date Pattern

Wenn invalid → kein Enrichment, kein DB-Update, aber `last_detail_fetch_status='invalid_html'` setzen → 14 Tage Quarantäne im Backfill.

Verhindert dass Wartungsseiten leere Werte über existierende Listings schreiben.

---

## 6. Validity-Regex für `address`

```ts
// detail-extract/validate.ts
const ADDRESS_TEXT_OK = /[A-ZÄÖÜ][A-Za-zäöüß.\- ]{2,}\s+\d+[a-zA-Z]?\b/u;

export function isValidAddressText(s: string | undefined): boolean {
  if (!s || s.trim().length < 4) return false;
  // Reject "12. Bezirk", "Saal 5", "Tisch 5", "ab 18"
  if (/^(saal|tisch|raum|reihe|sitz|bezirk|stock|etage|ab|von|bis)\s+\d/i.test(s.trim())) return false;
  // Require: starts-with-uppercase-word + space + number
  return ADDRESS_TEXT_OK.test(s);
}
```

Wird im Quality-Gate UND im Merge benutzt. Ein "address"-Wert wie "12. Bezirk" wird verworfen.

---

## 7. Pipeline-Hook in BaseScraper

```ts
// BaseScraper.ts (additive — bestehende ~113 Scraper bleiben unangetastet)
protected async enrichFromDetail(
  events: ScrapedEvent[],
  opts?: {
    concurrency?: number;        // default 4
    perHostMaxConcurrent?: number; // default 2
    skipIfComplete?: (e: ScrapedEvent) => boolean;
    detailTimeoutMs?: number;    // default 10000
  },
): Promise<DetailEnrichSummary> {
  // 1. Filter: source_url vorhanden + skipIfComplete?.(e) !== true
  // 2. Group by URL.hostname für per-host rate-limit
  // 3. Parallel fetch (Promise pool, p-limit-style) mit:
  //    - global concurrency
  //    - per-host concurrency
  //    - this.fetchWithTimeout (existing retry + backoff)
  // 4. Pro success: enrichFromDetailHtml(this.name, url, html) → merge.ts apply
  // 5. Pro failure: log, kein throw — Event bleibt mit Listing-Data
  // 6. Return summary { fetched, success, no_change, invalid_html, http_error, timeout }
}
```

Opt-in: ein Scraper fügt am Ende seiner `scrape()`-Methode `await this.enrichFromDetail(events)` ein. Default: nichts passiert (keine breaking change).

**Per-host rate limit** verhindert IP-Blocks: meinbezirk.at hat 2040 events alle auf `meinbezirk.at`. Mit `perHostMaxConcurrent=2` + Inter-Host-Concurrency 4 wird die Gesamtgeschwindigkeit gewahrt ohne einen einzelnen Host zu hämmern.

---

## 8. Quality-Gate (Soft)

In `src/lib/pipeline/quality-flags.ts` (bestehend, wird erweitert):

```ts
import { isValidAddressText } from '@/lib/scrapers/detail-extract/validate';

function flagMissingAddress(e: EventRow): QualityFlag | null {
  if (e.address && isValidAddressText(e.address)) return null;
  return {
    type: 'missing_address_street',
    severity: 'warning',
    detail: e.location_name ? `nur location_name="${e.location_name}"` : 'keine address-info',
  };
}
```

Wenn Flag gesetzt + Koordinaten vorhanden → `publish_status='published_low_confidence'` (existierender Status). Im Admin-Panel filterbar via `?flag=missing_address_street`. Sucess-Pfad: `publish_status='published'`.

Existierende Logik: wenn auch Koordinaten fehlen → `publish_status='needs_review'` (unverändert).

---

## 9. Out-of-Scope (separate Tickets)

- **Feratel (`feratel-deskline`)** — 11.674 events, alle ohne `source_url`. TOSC5-API liefert keine human-readable Detail-URLs. Lösung kommt in eigener Phase: Venue-Master-Lookup via `location_name + postal_code` gegen interne Venue-DB.
- **Partytimer / kultur-graz / mariazell.gv.at Listing-Parser-Bugs** — HTML/Newline-Müll in `title` und `location_name`. Wird durch das Detail-Refetch teilweise korrigiert (Detail wins für saubere Felder), aber die Listing-Parser sollten separat gefixt werden. Bug-Ticket pro Scraper.
- **AI-basiertes Enrichment** — out of scope per User-Request. Diese Spec ist explizit "ohne KI".

---

## 10. Backfill-Skript

`src/scripts/backfill-detail-enrich.ts`:

```bash
npm run backfill-detail                          # alle eligible events
npm run backfill-detail -- --source falter       # nur eine Quelle
npm run backfill-detail -- --source falter --limit 50 --dry-run
npm run backfill-detail -- --since 2026-04-01    # nur events die seit X aktualisiert wurden
npm run backfill-detail -- --concurrency 6 --per-host 2
npm run backfill-detail -- --retry-failed        # last_detail_fetch_status IN ('http_error','timeout','invalid_html') + älter als 14 Tage
```

**Algorithmus:**

1. SELECT future events WHERE `source_url IS NOT NULL` AND eligible:
   - `last_detail_fetch_at IS NULL` ODER
   - `address IS NULL` ODER `description IS NULL` ODER `price_text IS NULL`
   - AND NOT (`last_detail_fetch_status IN ('http_error','timeout','invalid_html') AND last_detail_fetch_at > now() - 14d`)
2. Sortiere nach URL.hostname → erlaubt per-host Throttling
3. Worker-Pool mit Global + Per-Host Concurrency Limits
4. Pro Event: fetch → enrichFromDetailHtml → BulkUpdater (chunks von 500)
5. Persist `last_detail_fetch_at`, `last_detail_fetch_status`, `address_confidence`
6. Resume-Checkpoint nach jedem Chunk: `data/backfill-detail-checkpoint.json`
7. Live-Progress-Log pro Source: `{source, fetched, success, http_error, invalid_html, no_change}`

---

## 11. Datenbank-Änderungen

Migration `20260521_detail_fetch_tracking.sql`:

```sql
ALTER TABLE events
  ADD COLUMN last_detail_fetch_at    timestamptz,
  ADD COLUMN last_detail_fetch_status text
    CHECK (last_detail_fetch_status IN
      ('success','no_change','http_error','timeout','invalid_html','parse_empty')),
  ADD COLUMN address_confidence      text
    CHECK (address_confidence IN ('high','medium','low'));

CREATE INDEX idx_events_detail_fetch_at ON events (last_detail_fetch_at);
CREATE INDEX idx_events_backfill_eligible
  ON events (source_name, last_detail_fetch_at)
  WHERE start_date >= CURRENT_DATE AND source_url IS NOT NULL;
```

Keine Daten-Migration nötig (alle drei Spalten nullable).

---

## 12. Pre-Probe-CLI (Werkzeug für neue Adapter)

`src/scripts/probe-adapter.ts`:

```bash
npx tsx --env-file=.env.local src/scripts/probe-adapter.ts --source meinbezirk --sample 5
```

- Holt 5 random Events der Source aus DB (mit `source_url`, ohne `address`).
- Fetcht je HTML, runs Universal-Stack OHNE Adapter.
- Druckt: was Universal-Extractor fand vs. was im HTML noch da ist (CSS-Klassen-Frequenz, häufige Selektoren, JSON-LD-Presence).
- Output ist die Vorlage für den neuen Adapter — kein blindes Raten nötig.

---

## 13. Backward Compatibility

- `src/lib/scrapers/gem2go-detail.ts` bleibt **als public re-export** bestehen:

  ```ts
  export { extractGem2goDetail } from './detail-extract/legacy-gem2go';
  export type { DetailEnrichment } from './detail-extract/types';
  ```

  `legacy-gem2go.ts` ist ein Thin-Wrapper, der `enrichFromDetailHtml('gem2go', '', html)` aufruft. Die 3 bestehenden Call-Sites (Gem2GoScraper, GenericGemeindeScraper, GemeindeRegistryScraper) bleiben unverändert. Bestehende Tests laufen weiter.
- Andere Scraper bleiben unangetastet, bis sie opt-in `await this.enrichFromDetail(events)` aufrufen.

---

## 14. Test-Strategie

- **`universal.test.ts`** — JSON-LD-Extraction, OG-Meta, vertical table, labeled regex, jeweils mit Fixture-HTML.
- **`merge.test.ts`** — alle Merge-Regeln aus §4 als Tabelle.
- **`validate.test.ts`** — isValidAddressText, isValidHtml mit Edge-Cases ("Tisch 5", "12. Bezirk", Cookie-Walls).
- **Adapter-Tests** — pro Adapter mindestens 3 Fixture-HTMLs (echte gespeicherte Detail-Pages) + erwartete Output-Snapshots.
- **Integration-Test** — `enrichFromDetailHtml` end-to-end für jede Source mit mind. 1 Fixture.

Bestehende Tests für `gem2go-detail.ts` laufen weiter (Backward-Compat-Wrapper).

---

## 15. Acceptance Criteria

- [ ] `detail-extract/` Library existiert und wird von `gem2go-detail.ts` re-exportiert; alle bestehenden Tests laufen grün.
- [ ] `BaseScraper.enrichFromDetail()` ist als opt-in protected method verfügbar mit Per-Host + Global Concurrency.
- [ ] Adapter für mindestens diese 6 Quellen sind implementiert + getestet: `gem2go` (refactored), `falter`, `meinbezirk`, `innsbruck-clubs`, `events.at`, `eventfrog`.
- [ ] Migration `20260521_detail_fetch_tracking.sql` ist applied (3 neue Spalten + 2 Indexes).
- [ ] Pipeline-Hook wird aktiviert in mindestens den 6 oben genannten Scrapern; nach 1 Scrape-Run sinkt `missing_address %` für diese Quellen um ≥ 70 % (gemessen via `inspect-missing-address.ts`).
- [ ] `backfill-detail-enrich.ts` Skript existiert, hat `--source`, `--dry-run`, `--limit`, `--since`, `--retry-failed` Flags und ist resume-fähig.
- [ ] `probe-adapter.ts` Skript existiert und zeigt Universal-Extraction-Coverage einer Source.
- [ ] Quality-Flag `missing_address_street` wird gesetzt + im Admin-Panel sichtbar gemacht.
- [ ] Nach kompletter Pipeline + Backfill-Run für die 6 Quellen ist `missing_address` global um ≥ 50 % reduziert (von 60.730 auf ≤ 30.000). Feratel + sehr kleine Quellen bleiben.

---

## 16. Boundaries

**In scope:**

- Universal + per-source Detail-Extraktion ohne KI
- Pipeline-Hook für sync Scraping + offline Backfill
- 6 erste Adapter (gem2go refactored + 5 neue)
- Quality-Flag + Soft-Gate

**Out of scope:**

- Feratel-Sonderlösung (eigene Phase)
- Bugfix der kaputten Listing-Parser (partytimer, kultur-graz, mariazell.gv.at) — eigene Tickets
- AI-Enrichment (explizit ausgeschlossen)
- Adapter für seltene Quellen mit < 50 Events (lohnt sich nicht — Universal-Stack reicht für die meisten dieser Quellen)
- Address-Normalisierung (ß↔ss, Str.↔Straße) — wenn nötig, eigene Phase

---

## 17. Decision Context

- **Warum `source_name`-basierter Adapter-Lookup statt URL/Hostname?** gem2go läuft auf 2000+ verschiedenen Hosts; URL-Pattern wäre fragil und müsste pro Gemeinde gepflegt werden. `source_name` ist immer eindeutig + bereits in Pipeline + DB bekannt.
- **Warum Adapter pro Source statt eine deklarative YAML-Config?** Reale HTML-Strukturen brauchen Post-Processing (cheerio-Selektor-Komposition, conditional Logic). YAML würde zur Pseudo-Programmiersprache mutieren. Adapter-Code ist 50–80 Zeilen Cheerio — kompakt und debugfähig.
- **Warum Soft-Gate statt Hard-Hide?** User-Entscheidung im Brainstorming. Mehr Reichweite mit Trade-off: low_confidence wird im UI gekennzeichnet.
- **Warum Datum nie überschreiben?** Listing-Datum-Parser sind das Beste an den Scrapern (User-Feedback: "Datum hat immer gut funktioniert"). Detail-Page-Dates aus JSON-LD können in seltenen Fällen falsche Wiederholungs-Termine zeigen.
- **Warum erst Pipeline schützen, dann Backfill?** User-Entscheidung. Verhindert dass während Backfill weiter dreckige Events reinkommen.
- **Warum keine KI?** Explizite Anforderung. Heuristische Layer reichen für 80–95 % der Felder; bei wirklich strukturierten Sites (gem2go JSON-LD = 62 %) sogar weit mehr.

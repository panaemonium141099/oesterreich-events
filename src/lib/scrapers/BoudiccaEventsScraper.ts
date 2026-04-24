import { BaseScraper } from './BaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * boudicca.events scraper — pulls events via their public Search API
 * (https://github.com/boudicca-events/boudicca.events, GPL-3.0).
 *
 * Why this source:
 *   boudicca.events is an open-source Austrian event aggregator out of
 *   JKU Linz that already aggregates from 47+ upstream collectors
 *   (ArenaWien, Posthof, Stadthalle Wien, Flohmarkt, Alpenverein,
 *   Parlament, Brucknerhaus, …). Pulling it gives us most of their
 *   Vienna + OÖ catalog in one swoop — the "goldstück" per our
 *   docs/competitive-wasmachma.md analysis. ~10-25k events/response.
 *
 * API surface:
 *   POST https://search.boudicca.events/queryEntries
 *     body: { query, offset, size }
 *   Response: { result: KV[], totalResults, error }
 *
 * Events are FLAT key-value maps (not typed structs). Key variants use
 * `:` suffixes like `description:lang=de`. This scraper normalises those.
 *
 * Category:
 *   Boudicca has only 5 coarse values (MUSIC, ART, TECH, SPORT, OTHER).
 *   We produce a best-effort v3 mapping (using `type` + `tags` free-text
 *   to split MUSIC → Musik vs. Nightlife & Party), but the final
 *   category is produced by resolveCanonicalCategory() inside the sync
 *   layer — our guess is only persisted as `source_category_raw`.
 *
 * Dedup:
 *   source_name = "boudicca:<collectorName>"  (e.g. "boudicca:arenawien")
 *   source_id   = boudicca.id                  (stable UUID v5 upstream)
 *   So if Boudicca tracks the same ArenaWien show that we also ingest
 *   from a direct ArenaWien scraper, (source_name, source_id) differ
 *   across entries; the content-fingerprint dedup in the pipeline
 *   (title + date + venue) is what will collapse them post-ingest.
 *
 * Geocoding:
 *   Boudicca entries often carry location.coordinates.{lat,lon} but
 *   NO postal_code. That's fine — location-normalizer.ts now derives
 *   the PLZ from the coords via the gemeinde-registry reverse lookup.
 *
 * Licence:
 *   GPL-3.0 obliges us to credit the source. We persist source_url per
 *   event (the Boudicca detail URL) which surfaces on the event page,
 *   and the aggregator name lives in source_name. No source-code is
 *   copied from the repo — this scraper speaks the OpenAPI over HTTP,
 *   which is not a derivative work.
 */
export class BoudiccaEventsScraper extends BaseScraper {
  readonly name = 'boudicca';

  // Polite pacing — their search service refreshes hourly and there's no
  // documented rate-limit, but the default Spring-Boot deployment won't
  // enjoy us hammering it. One second between pages is plenty.
  protected delayMs = 1000;
  protected fetchTimeoutMs = 45_000;
  protected userAgent = 'lasstreffen.at-scraper/1.0 (+https://lasstreffen.at/quellen; source=boudicca-events)';

  private readonly searchUrl = 'https://search.boudicca.events/queryEntries';
  private readonly PAGE_SIZE = 250;
  // Hard safety valve — 40k events is ~80 MB of JSON, more than the
  // whole API is likely to return. Acts as a pagination runaway guard.
  private readonly MAX_PAGES = 200;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Boudicca-API-Scraping …');

    const today = new Date().toISOString().slice(0, 10);
    const query = `"startDate" after "${today}"`;

    const events: ScrapedEvent[] = [];
    let offset = 0;
    let totalResults = 0;

    for (let page = 0; page < this.MAX_PAGES; page++) {
      const body = JSON.stringify({ query, offset, size: this.PAGE_SIZE });
      const result = await this.postJson(this.searchUrl, body);
      if (!result) break;

      const batch = (result.result ?? []) as Array<Record<string, string>>;
      totalResults = typeof result.totalResults === 'number' ? result.totalResults : totalResults;
      if (batch.length === 0) break;

      for (const kv of batch) {
        const ev = this.mapEntry(kv);
        if (ev) events.push(ev);
      }

      this.log(`Seite ${page + 1}: ${batch.length} entries (offset=${offset}, total=${totalResults})`);

      offset += batch.length;
      if (offset >= totalResults) break;
      if (batch.length < this.PAGE_SIZE) break;

      await this.rateLimit();
    }

    this.log(`${events.length} Boudicca-Events erfasst (aus ${totalResults} total)`);
    return events;
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────

  private async postJson(url: string, body: string): Promise<{ result?: unknown; totalResults?: number } | null> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': this.userAgent,
          },
          body,
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        return (await resp.json()) as { result?: unknown; totalResults?: number };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (controller.signal.aborted) lastError = new Error(`Timeout nach ${this.fetchTimeoutMs}ms`);
        this.log(`Versuch ${attempt}/${this.maxRetries} fehlgeschlagen: ${lastError.message}`);
        if (attempt < this.maxRetries) await this.sleep(this.delayMs * 2 ** (attempt - 1));
      } finally {
        clearTimeout(timer);
      }
    }
    this.log(`Endgültig gescheitert: ${lastError?.message ?? '???'}`);
    return null;
  }

  // ─── Entry → ScrapedEvent ─────────────────────────────────────────────

  private mapEntry(rawKv: Record<string, string>): ScrapedEvent | null {
    // Boudicca keys come with a full variant chain suffixed onto the base:
    //   name                              (base)
    //   name:lang=de                      (variant)
    //   startDate:format=date             (almost always the real key)
    //   boudicca.id:format=uuid           (same)
    //   location.coordinates.lat:format=number:source=OSM
    //   tags:format=list                  (comma-joined)
    // Pre-index every entry onto its base key once. Prefer :lang=de when
    // both exist; otherwise first-seen wins.
    const kv = new Map<string, string>();
    for (const [key, value] of Object.entries(rawKv)) {
      if (value == null || value === '') continue;
      const colonAt = key.indexOf(':');
      const base = colonAt === -1 ? key : key.slice(0, colonAt);
      const isGermanVariant = key.includes(':lang=de');
      if (!kv.has(base) || isGermanVariant) kv.set(base, value);
    }
    const readField = (base: string): string | null => kv.get(base) ?? null;

    const boudiccaId = readField('boudicca.id');
    const collector = readField('collectorName');
    const title = readField('name');
    const startDate = readField('startDate');

    // Hard requirements — drop entries that can't be deduped or dated.
    if (!boudiccaId || !collector || !title || !startDate) return null;

    // ISO-8601 check — Boudicca typically emits `2026-04-27T23:59:00+02:00`.
    // If it's a plain date, we leave it — the pipeline accepts both.
    const start = startDate.trim();
    const end = readField('endDate')?.trim() || null;

    // Coordinates may be absent. Empty strings parse to NaN via parseFloat,
    // so we gate on the result being finite.
    const lat = parseFloat(readField('location.coordinates.lat') ?? '');
    const lng = parseFloat(readField('location.coordinates.lon') ?? '');
    const latitude = Number.isFinite(lat) ? lat : null;
    const longitude = Number.isFinite(lng) ? lng : null;

    const description = readField('description');
    const plainDescription = description ? this.markdownToPlain(description) : null;

    const boudiccaCategory = readField('category');         // MUSIC | ART | TECH | SPORT | OTHER
    const boudiccaType = readField('type');                 // free-text: konzert, party, theatre, …
    const rawTags = readField('tags');
    const tags = this.splitTags(rawTags);

    // Best-effort v3 category. The sync layer re-classifies from title +
    // description + source_tags_raw + source_category_raw, so this is
    // only a hint — we don't need to be perfect.
    const v3Category = this.guessV3Category(boudiccaCategory, boudiccaType, tags);

    // Image: inherit BaseScraper.cleanImageUrl filter (rejects data:, tiny
    // spacers, broken URLs).
    const imageUrl = this.cleanImageUrl(readField('pictureUrl'));

    const detailUrl = readField('url')?.trim() || null;

    // Registration → price signal. FREE => kostenlos, TICKET/PRE_SALES_ONLY
    // => leave null (Boudicca doesn't expose the actual price amount).
    const registration = readField('registration');
    const priceText = registration === 'FREE' ? 'Kostenlos' : null;

    // Bundesland / district / postal_code are NOT in Boudicca's schema.
    // We simply leave them off the object; the sync layer's location-
    // normalizer derives all three from coordinates + address (our v3
    // gemeinde-registry reverse-lookup handles PLZ for any AT lat/lng).
    //
    // NOTE: `ScrapedEvent` uses optional-with-undefined (`?: string`),
    // NOT nullable — so we CANNOT assign `null`. Empty values are
    // expressed by omission / `undefined`. The sync layer then stores
    // NULL in the DB columns that allow it.
    //
    // `source_category_raw` / `source_tags_raw` are populated by
    // supabase-sync.ts automatically from `event.category` and
    // `event.tags`, so the scraper only sets the primary fields.
    const locationName = readField('location.name')?.trim();
    const address = readField('location.address')?.trim();
    const organizer = readField('organizer')?.trim();

    const event: ScrapedEvent = {
      source_id: boudiccaId,
      source_name: `boudicca:${collector}`,
      source_url: detailUrl,
      title,
      start_date: start,
      ...(plainDescription ? { description: plainDescription } : {}),
      ...(end ? { end_date: end } : {}),
      ...(locationName ? { location_name: locationName } : {}),
      ...(address ? { address: address } : {}),
      ...(latitude != null ? { latitude } : {}),
      ...(longitude != null ? { longitude } : {}),
      ...(v3Category ? { category: v3Category } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(priceText ? { price_text: priceText } : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(organizer ? { organizer } : {}),
      ...(detailUrl ? { ticket_url: detailUrl } : {}),
    };

    // Reference the raw boudicca category so the linter doesn't complain
    // about the unused var; it's already encoded into v3Category via
    // guessV3Category and persisted by the sync layer as
    // source_category_raw automatically from `event.category`.
    void boudiccaCategory;

    return event;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private splitTags(raw: string | null): string[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0 && t.length < 50);
  }

  /**
   * Best-effort mapping to our 12-category v3 taxonomy.
   *
   * Boudicca's `category` has only 5 values; we drill into `type` and
   * `tags` to split coarse buckets (e.g. MUSIC splits into Musik vs
   * Nightlife & Party depending on "party" / "dj" / "rave" signals).
   * This is a HINT — supabase-sync runs the real classifier on upsert.
   */
  private guessV3Category(
    category: string | null,
    type: string | null,
    tags: string[],
  ): string | null {
    const hay = [
      category?.toLowerCase() ?? '',
      type?.toLowerCase() ?? '',
      tags.join(' ').toLowerCase(),
    ].join(' ');

    const has = (...needles: string[]) => needles.some(n => hay.includes(n));

    // Nightlife has to go first — MUSIC + party should split to Nightlife.
    if (has('party', 'rave', 'club', 'dj set', 'clubbing', 'afterhour')) {
      return 'Nightlife & Party';
    }
    if (category === 'MUSIC' || has('konzert', 'concert', 'musik', 'singer')) {
      return 'Musik';
    }
    if (category === 'SPORT' || has('sport', 'fußball', 'laufen', 'marathon', 'rennen')) {
      return 'Sport & Bewegung';
    }
    // Märkte must check BEFORE TECH — "messe" alone is ambiguous (trade
    // fair vs Genuss-Messe vs catholic mass), and Boudicca's type field
    // often writes "Märkte & Messen" for markets which would otherwise
    // false-match TECH via the "messe" substring. Including "märkte" +
    // "messen" explicitly and dropping "messe" from the TECH needle list
    // keeps the routing clean.
    if (has('flohmarkt', 'markt', 'märkte', 'messen', 'kirtag', 'dorffest', 'adventmarkt', 'christkindl', 'brauchtum')) {
      return 'Märkte & Feste';
    }
    if (category === 'TECH' || has('tech', 'meetup', 'coding', 'workshop', 'seminar', 'kongress', 'karriere')) {
      return 'Wissen & Karriere';
    }
    if (has('heurige', 'weinfest', 'kulinarik', 'essen', 'foodtruck', 'brauerei')) {
      return 'Essen & Trinken';
    }
    if (has('wandern', 'outdoor', 'natur', 'klettern', 'tour', 'bergsteigen')) {
      return 'Natur & Abenteuer';
    }
    if (has('familie', 'kinder', 'jugend', 'eltern', 'baby')) {
      return 'Familie & Kinder';
    }
    if (has('yoga', 'meditation', 'wellness', 'spa', 'therme', 'spirituell', 'kirche', 'gottesdienst')) {
      return 'Wellness & Spiritualität';
    }
    if (category === 'ART' || has('theater', 'kabarett', 'oper', 'musical', 'kunst', 'ausstellung', 'museum', 'literatur', 'lesung', 'film')) {
      return 'Kultur & Bühne';
    }
    // Drop category=OTHER into null so the classifier picks from title/description.
    return null;
  }

  /**
   * Strip Markdown formatting into plain-text. Boudicca descriptions
   * are MD with links, bold/italic, lists, headings. The pipeline
   * stores plain text for SEO + AI enrichment.
   *
   * Intentionally minimal — we don't need a full MD parser, just enough
   * to kill the punctuation and leave the prose readable. Any weird
   * residues will be cleaned up by the normalizer downstream.
   */
  private markdownToPlain(md: string): string {
    return md
      // Links: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Images: ![alt](url) → '' (strip — we already have pictureUrl)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      // Bold/italic/strike wrappers
      .replace(/(\*\*|__|~~)(.*?)\1/g, '$2')
      .replace(/(\*|_)([^\s*_].*?)\1/g, '$2')
      // Inline code
      .replace(/`([^`]+)`/g, '$1')
      // Heading hashes at line start
      .replace(/^#{1,6}\s+/gm, '')
      // Blockquote markers
      .replace(/^>\s?/gm, '')
      // List bullets/dashes
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Collapse 3+ newlines to 2 (preserve paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/**
 * Gem2Go detail-page extractor.
 *
 * Pulls description, address, venue, image, price from a detail page HTML.
 * Layered fallback strategy because gem2go installations differ:
 *
 *   1. JSON-LD Event (Schema.org) — present on ~62% of sites, structured
 *   2. CSS classes `va-adr-strasse`, `va-vaort`, `va-adr-plz`, `va-adr-ort`,
 *      `vatext_container` — present when JSON-LD isn't
 *   3. og:image, og:description meta tags — ~88% coverage
 *   4. Regex patterns inside the description text — last resort for address
 *      ("Rathausplatz 5, 3040 Neulengbach") and price ("kostenlos", "€ 12")
 *
 * Returns only fields it could extract — caller merges with existing event
 * data, keeping current values for fields not extracted.
 */

import * as cheerio from 'cheerio';

export interface DetailEnrichment {
  description?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  address_locality?: string;
  image_url?: string;
  price_text?: string;
  price_min?: number;
  price_max?: number;
  organizer?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function extractGem2goDetail(html: string): DetailEnrichment {
  // Preprocess: cheerio's .text() drops <br> with no separator, so
  // "...3040 Neulengbach<br>Begleitung..." becomes "NeulengbachBegleitung"
  // which then breaks the PLZ regex. Inject a space.
  const preprocessed = html.replace(/<br\s*\/?>/gi, ' <br> ');
  const $ = cheerio.load(preprocessed);
  const out: DetailEnrichment = {};

  applyJsonLd($, out);
  applyCssSelectors($, out);
  applyVerticalTable($, out);
  applyOgMeta($, out);
  applyRegexFallbacks(out);

  // Normalize: empty strings → undefined
  for (const k of Object.keys(out) as Array<keyof DetailEnrichment>) {
    const v = out[k];
    if (typeof v === 'string' && v.trim().length === 0) {
      delete (out as Record<string, unknown>)[k];
    }
  }

  return out;
}

// ─── Layer 1: JSON-LD ─────────────────────────────────────────────────────────

function applyJsonLd($: cheerio.CheerioAPI, out: DetailEnrichment): void {
  const event = findJsonLdEvent($);
  if (!event) return;

  if (event.description && typeof event.description === 'string') {
    out.description = stripHtml(event.description);
  }

  // image: string | string[]
  if (event.image) {
    out.image_url = Array.isArray(event.image) ? event.image[0] : String(event.image);
  }

  // location: object | array
  const loc = Array.isArray(event.location) ? event.location[0] : event.location;
  if (loc) {
    if (loc.name && typeof loc.name === 'string') out.location_name = loc.name.trim();
    const addr = loc.address;
    if (addr && typeof addr === 'object') {
      if (addr.streetAddress && typeof addr.streetAddress === 'string') {
        out.address = addr.streetAddress.trim();
      }
      if (addr.postalCode) out.postal_code = String(addr.postalCode).trim();
      if (addr.addressLocality && typeof addr.addressLocality === 'string') {
        out.address_locality = addr.addressLocality.trim();
      }
    }
  }

  // organizer.name — gaubitsch shipped HTML inside the name, strip it
  if (event.organizer && event.organizer.name && typeof event.organizer.name === 'string') {
    const orgName = stripHtml(event.organizer.name);
    if (orgName) out.organizer = orgName;
  }

  // offers.price — many Schema.org Event pages publish ticket pricing here.
  // Shape can be: object, array of offers, or AggregateOffer with lowPrice/highPrice.
  const offers = event.offers;
  if (offers) {
    applyOffers(offers, out);
  }
}

function applyOffers(offers: JsonLdOffer | JsonLdOffer[], out: DetailEnrichment): void {
  const list = Array.isArray(offers) ? offers : [offers];
  let min: number | undefined;
  let max: number | undefined;
  const labels: string[] = [];
  for (const o of list) {
    // AggregateOffer
    if (typeof o.lowPrice !== 'undefined') {
      const n = toNumber(o.lowPrice);
      if (n !== null) min = min === undefined ? n : Math.min(min, n);
    }
    if (typeof o.highPrice !== 'undefined') {
      const n = toNumber(o.highPrice);
      if (n !== null) max = max === undefined ? n : Math.max(max, n);
    }
    // Single Offer
    if (typeof o.price !== 'undefined') {
      const n = toNumber(o.price);
      if (n !== null) {
        min = min === undefined ? n : Math.min(min, n);
        max = max === undefined ? n : Math.max(max, n);
        const cat = typeof o.name === 'string' ? o.name.trim() : '';
        labels.push(cat ? `${cat} €${n}` : `€${n}`);
      }
    }
  }
  if (min !== undefined && !out.price_min) out.price_min = min;
  if (max !== undefined && !out.price_max) out.price_max = max;
  if (!out.price_text) {
    if (labels.length > 0) {
      out.price_text = labels.join(' / ');
    } else if (min !== undefined && max !== undefined) {
      out.price_text = min === max ? formatEuro(min) : `${formatEuro(min)} – ${formatEuro(max)}`;
    } else if (min !== undefined) {
      out.price_text = `ab ${formatEuro(min)}`;
    }
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) && v >= 0 && v <= 10000 ? v : null;
  if (typeof v === 'string') {
    const m = v.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const n = parseFloat(m[1]);
      if (!isNaN(n) && n >= 0 && n <= 10000) return n;
    }
  }
  return null;
}

interface JsonLdOffer {
  '@type'?: string;
  price?: string | number;
  lowPrice?: string | number;
  highPrice?: string | number;
  priceCurrency?: string;
  name?: string;
}

interface JsonLdEvent {
  '@type'?: string | string[];
  description?: string;
  image?: string | string[];
  location?: JsonLdPlace | JsonLdPlace[];
  organizer?: { name?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
}

interface JsonLdPlace {
  name?: string;
  address?: {
    streetAddress?: string;
    postalCode?: string | number;
    addressLocality?: string;
  };
}

function findJsonLdEvent($: cheerio.CheerioAPI): JsonLdEvent | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    const raw = $(s).text();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON — skip
    }
    const candidates = unwrapJsonLd(parsed);
    for (const c of candidates) {
      const t = c['@type'];
      if (t === 'Event' || (Array.isArray(t) && t.includes('Event'))) {
        return c;
      }
    }
  }
  return null;
}

function unwrapJsonLd(parsed: unknown): JsonLdEvent[] {
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is JsonLdEvent => x !== null && typeof x === 'object');
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj['@graph'])) {
      return obj['@graph'].filter(
        (x): x is JsonLdEvent => x !== null && typeof x === 'object',
      );
    }
    return [parsed as JsonLdEvent];
  }
  return [];
}

// ─── Layer 2: CSS selectors ───────────────────────────────────────────────────

function applyCssSelectors($: cheerio.CheerioAPI, out: DetailEnrichment): void {
  if (!out.location_name) {
    const v = $('.va-vaort').first().text().trim();
    if (v) out.location_name = v;
  }

  if (!out.address) {
    const strasse = $('.va-adr-strasse').first().text().trim();
    if (strasse) {
      // Hausnummer sits in `.va-adr-hnr` which may include a trailing `,` separator
      const hnrRaw = $('.va-adr-hnr').first().text().trim();
      const hnr = hnrRaw.replace(/[,\s]+$/, '').trim();
      out.address = hnr ? `${strasse} ${hnr}` : strasse;
    }
  }

  if (!out.postal_code) {
    const v = $('.va-adr-plz').first().text().trim();
    if (v) out.postal_code = v;
  }

  if (!out.address_locality) {
    const v = $('.va-adr-ort').first().text().trim();
    if (v) out.address_locality = v;
  }

  // Organizer fallback via CSS — gem2go uses `.veranstalter_bez_veranstalter`
  // or the contact name in `.kontakt_box`. Try both.
  if (!out.organizer) {
    const v = $('.veranstalter_bez_veranstalter').first().text().trim()
      || $('.veranstaltername, .organizer_name').first().text().trim();
    if (v) out.organizer = v;
  }

  // Description: target the inner content, NOT the wrapper. `.mehrtext-limiter`
  // holds the actual paragraph; `.mehrtext-toggle` is the "mehr anzeigen" button
  // we don't want. Hollenthon-style image-only events have an empty limiter and
  // we leave description unset rather than capturing the toggle text.
  const existing = out.description ?? '';
  if (existing.length < 120) {
    let candidate = $('.vatext_container .mehrtext-limiter').first().text().trim().replace(/\s+/g, ' ');
    if (!candidate) {
      // Fallback: whole vatext_container minus the toggle
      const $clone = $('.vatext_container').first().clone();
      $clone.find('.mehrtext-toggle, .defaultfontsize').remove();
      candidate = $clone.text().trim().replace(/\s+/g, ' ');
    }
    if (candidate && candidate.length > existing.length && candidate !== 'mehr anzeigen') {
      out.description = candidate;
    }
  }
}

// ─── Layer 2b: Vertical table ─────────────────────────────────────────────────
// Sparse gem2go installations (e.g. st-georgen-laengsee.gv.at) use
//   <table class="verticaltable">
//     <tr><th scope="row">Ort</th><td>Kunsthotel Fuchspalast</td></tr>
//     <tr><th scope="row">Veranstalter</th><td>Musikschule Fröhlich</td></tr>
//   </table>
// instead of va-adr-* / va-vaort classes. This is the minimal layout — usually
// only Ort + Veranstalter + Termin are filled. Extract what we can.

const LABEL_FIELD_MAP: Array<{ labels: RegExp; field: keyof DetailEnrichment }> = [
  { labels: /^(ort|veranstaltungsort)$/i, field: 'location_name' },
  { labels: /^(veranstalter|organisator)$/i, field: 'organizer' },
  { labels: /^(adresse|anschrift)$/i, field: 'address' },
  { labels: /^(plz|postleitzahl)$/i, field: 'postal_code' },
  { labels: /^(eintritt|kosten|preis|gebühr|teilnahmegebühr|kursgebühr)$/i, field: 'price_text' },
  { labels: /^(beschreibung|info|infos|details)$/i, field: 'description' },
];

function applyVerticalTable($: cheerio.CheerioAPI, out: DetailEnrichment): void {
  $('table.verticaltable tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').first().text().trim();
    if (!label) return;

    // Read cell as discrete segments — block-level tags become newline
    // separators so we can distinguish "Sportplatz Mönchdorf" from
    // "Greinerwaldstraße 7" from "4281 Mönchdorf" instead of getting one
    // smushed string.
    const rawHtml = $row.find('td').first().html() ?? '';
    const segments = rawHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|span|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length === 0) return;
    const joinedValue = segments.join(' | ');

    for (const { labels, field } of LABEL_FIELD_MAP) {
      if (!labels.test(label)) continue;

      // Ort/Veranstaltungsort/Adresse cells often pack venue + street + PLZ+city
      // into one block. Parse each segment.
      if (field === 'location_name' || field === 'address') {
        parseLocationSegments(segments, out);
      }

      if (out[field] === undefined) {
        if (field === 'location_name') {
          // First segment is venue name
          if (segments[0]) (out as Record<string, unknown>)[field] = segments[0];
        } else if (field === 'address') {
          // For an explicit Adresse cell, prefer the segment that looks like
          // a street ("Word Nr"); fall back to first segment.
          const streetSeg = segments.find((s) => /\d/.test(s) && !/^\d{4}\s/.test(s));
          if (streetSeg) (out as Record<string, unknown>)[field] = streetSeg;
          else (out as Record<string, unknown>)[field] = joinedValue;
        } else {
          (out as Record<string, unknown>)[field] = joinedValue;
        }
      }
      break;
    }
  });
}

function parseLocationSegments(segments: string[], out: DetailEnrichment): void {
  for (const p of segments) {
    const pm = p.match(/^(\d{4})\s+([A-ZÄÖÜ][A-Za-zäöüß\-\s]+)$/u);
    if (pm) {
      if (!out.postal_code) out.postal_code = pm[1];
      if (!out.address_locality) out.address_locality = pm[2].trim();
      continue;
    }
    const sm = p.match(/^([A-ZÄÖÜ][A-Za-zäöüß.\- ]+?(?:straße|strasse|gasse|platz|weg|allee|ring|markt))\s+(\d+[a-zA-Z]?)$/u);
    if (sm) {
      if (!out.address) out.address = `${sm[1]} ${sm[2]}`;
      continue;
    }
    const fm = p.match(/^([A-ZÄÖÜ][A-Za-zäöüß\-]{2,})\s+(\d+[a-zA-Z]?)$/u);
    if (fm && !out.address) {
      out.address = `${fm[1]} ${fm[2]}`;
    }
  }
}


// Free-text price normalization: "Eintritt frei" / numeric → price_min/max
function normalizePriceText(out: DetailEnrichment): void {
  if (!out.price_text || out.price_min !== undefined) return;
  const t = out.price_text.toLowerCase();
  if (FREE_PATTERNS.test(t)) {
    out.price_min = 0;
    out.price_max = 0;
    return;
  }
  if (DONATION_PATTERNS.test(t)) {
    out.price_min = 0;
    return;
  }
  const m = out.price_text.match(/(\d{1,3}(?:[.,]\d{1,2})?)/);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(v) && v >= 0 && v <= 500) {
      out.price_min = v;
      out.price_max = v;
    }
  }
}

// ─── Layer 3: OG meta ─────────────────────────────────────────────────────────

function applyOgMeta($: cheerio.CheerioAPI, out: DetailEnrichment): void {
  if (!out.image_url) {
    const og = $('meta[property="og:image"]').attr('content');
    if (og) out.image_url = og.trim();
  }
  if (!out.description || out.description.length < 80) {
    const og = $('meta[property="og:description"]').attr('content');
    if (og && og.trim().length > (out.description?.length ?? 0)) {
      out.description = og.trim();
    }
  }
}

// ─── Layer 4: Regex fallbacks ─────────────────────────────────────────────────

// House number is REQUIRED to avoid false positives like "Tennisplatz Lilienfeld"
// where the description names a venue ("meeting at Tennisplatz") but no actual
// street number exists. We'd rather miss a few than emit garbage addresses that
// users would try to route to.
const ADDRESS_REGEX = /([A-ZÄÖÜ][A-Za-zäöüß.\- ]+?(?:straße|strasse|gasse|platz|weg|allee|ring|markt))\s+(\d+[a-zA-Z]?)(?=[,\s\n])/u;

// Rural Austrian addresses: many villages don't have street names — the address
// is just "Dorf 22" or the village name + house number. To avoid false positives
// (the regex would match "Mai 2026" otherwise), only match when label-prefixed.
const LABELED_ADDRESS_REGEX = /(?:Adresse|Anschrift|Wo|Treffpunkt|Veranstaltungsort)\s*[:\-]\s*([^\n,;]{4,80})/iu;

// Labeled price patterns — covers most German/Austrian event-page conventions.
const LABELED_PRICE_REGEX = /(?:Eintritt|Kosten|Preis|Gebühr|Teilnahmegebühr|Kursgebühr|Kosten?beitrag|Tickets?)\s*[:\-]\s*((?:€\s*)?\d+(?:[.,]\d{1,2})?(?:\s*€)?(?:\s*[-–]\s*\d+(?:[.,]\d{1,2})?\s*€?)?|frei|kostenlos|gratis|kostenfrei|Spende[^\n;]*)/iu;
// PLZ + Stadt: only allow a SECOND word if the first is a known multi-word city
// prefix (Bad, Sankt, St., Wiener, Klein, Groß, Ober, Unter, Nieder). Otherwise
// match a single word — prevents "3040 Neulengbach Begleitung" greed.
const PLZ_CITY_REGEX = /\b(\d{4})\s+((?:Bad|Sankt|St\.?|Wiener|Klein|Groß|Ober|Unter|Nieder)\s+[A-ZÄÖÜ][A-Za-zäöüß\-]{2,}|[A-ZÄÖÜ][A-Za-zäöüß\-]{2,})/u;

const FREE_PATTERNS = /eintritt\s+frei|frei(?:er)?\s+eintritt|gratis|kostenlos|kostenfrei|teilnahme\s+(?:ist\s+)?kostenlos|eintritt\s*[:\-]?\s*frei|keine\s+(?:eintritts)?gebühr/i;
const DONATION_PATTERNS = /spende\s*(?:nbasis|n\s+erbeten|n\s+willkommen)?|freiwillige[sn]?\s+(?:beitrag|spende|eintritt)/i;
const EURO_REGEX = /(?:eintritt|kosten|preis|gebühr|teilnahmegebühr|kursgebühr|kurskosten)\s*[:\-]?\s*€?\s*(\d{1,3}(?:[.,]\d{1,2})?)/i;

function applyRegexFallbacks(out: DetailEnrichment): void {
  // Normalize a price that came from the verticaltable layer
  normalizePriceText(out);

  const text = out.description ?? '';

  // Address from description text — only as last resort. Regex requires a
  // house number so we never emit street-name-only matches.
  if (!out.address && text) {
    const m = text.match(ADDRESS_REGEX);
    if (m) {
      out.address = `${m[1].trim()} ${m[2]}`;
    }
  }
  // Label-prefixed address — catches "Adresse: ...", "Wo: ...", "Treffpunkt: ..."
  // Works for rural addresses that don't fit the street-suffix regex
  // ("Dorf 22, Hauptplatz 1, Markt 14").
  if (!out.address && text) {
    const m = text.match(LABELED_ADDRESS_REGEX);
    if (m) {
      const candidate = m[1].trim();
      // Must contain at least one digit (a house number, PLZ, or door number)
      // — otherwise it's just a venue name we already have as location_name
      if (/\d/.test(candidate) && candidate.length >= 4 && candidate.length <= 80) {
        out.address = candidate;
      }
    }
  }

  if ((!out.postal_code || !out.address_locality) && text) {
    const m = text.match(PLZ_CITY_REGEX);
    if (m) {
      if (!out.postal_code) out.postal_code = m[1];
      if (!out.address_locality) out.address_locality = m[2];
    }
  }

  // Price patterns — labeled first (most reliable), then free/donation, then
  // generic euro mentions inside the description.
  if (!out.price_text && text) {
    const labeled = text.match(LABELED_PRICE_REGEX);
    if (labeled) {
      const valRaw = labeled[1].trim();
      if (/^(frei|kostenlos|gratis|kostenfrei)$/i.test(valRaw)) {
        out.price_text = 'Eintritt frei';
        out.price_min = 0;
        out.price_max = 0;
      } else if (/spende/i.test(valRaw)) {
        out.price_text = valRaw.slice(0, 60);
        out.price_min = 0;
      } else {
        // Numeric — could be "10", "10,50", "10-15", "€10", "10€"
        const nums = valRaw.match(/(\d+(?:[.,]\d{1,2})?)/g);
        if (nums && nums.length > 0) {
          const min = parseFloat(nums[0].replace(',', '.'));
          const max = nums[1] ? parseFloat(nums[1].replace(',', '.')) : min;
          if (!isNaN(min) && min >= 0 && min <= 500 && !isNaN(max)) {
            out.price_min = min;
            out.price_max = max;
            out.price_text = min === max ? formatEuro(min) : `${formatEuro(min)} – ${formatEuro(max)}`;
          }
        }
      }
    }
  }
  if (!out.price_text && text) {
    if (FREE_PATTERNS.test(text)) {
      out.price_text = 'Eintritt frei';
      out.price_min = 0;
      out.price_max = 0;
    } else if (DONATION_PATTERNS.test(text)) {
      out.price_text = 'Spende erbeten';
      out.price_min = 0;
    } else {
      const m = text.match(EURO_REGEX);
      if (m) {
        const v = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(v) && v >= 0 && v <= 500) {
          out.price_text = formatEuro(v);
          out.price_min = v;
          out.price_max = v;
        }
      }
    }
  }
}

function formatEuro(v: number): string {
  // "€ 12,–" for whole numbers, "€ 12,50" otherwise
  if (Number.isInteger(v)) return `€ ${v},–`;
  return `€ ${v.toFixed(2).replace('.', ',')}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(s: string): string {
  // Cheerio for HTML decoding + tag stripping
  const $ = cheerio.load(`<div>${s}</div>`);
  return $('div').text().replace(/\s+/g, ' ').trim();
}

// src/lib/scrapers/detail-extract/universal.ts
//
// Universal HTML extraction layers (1, 3, 4, 5) shared by every source.
// Layer 2 (source-specific CSS selectors) lives in adapters/<source>.ts.
//
// Originally part of gem2go-detail.ts; refactored here so all scrapers can
// share the same JSON-LD, OpenGraph, vertical-table and regex logic.

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { DetailEnrichment } from './types';
import { isValidAddressText } from './validate';

// ─── Layer 1: JSON-LD ─────────────────────────────────────────────────────────

export function applyJsonLd($: CheerioAPI, out: DetailEnrichment): void {
  const event = findJsonLdEvent($);
  if (!event) return;

  if (event.description && typeof event.description === 'string') {
    out.description = stripHtml(event.description);
  }

  if (event.image) {
    out.image_url = Array.isArray(event.image) ? event.image[0] : String(event.image);
  }

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

  if (event.organizer && event.organizer.name && typeof event.organizer.name === 'string') {
    const orgName = stripHtml(event.organizer.name);
    if (orgName) out.organizer = orgName;
  }

  if (event.offers) applyOffers(event.offers, out);
}

function applyOffers(offers: JsonLdOffer | JsonLdOffer[], out: DetailEnrichment): void {
  const list = Array.isArray(offers) ? offers : [offers];
  let min: number | undefined;
  let max: number | undefined;
  const labels: string[] = [];
  for (const o of list) {
    if (typeof o.lowPrice !== 'undefined') {
      const n = toNumber(o.lowPrice);
      if (n !== null) min = min === undefined ? n : Math.min(min, n);
    }
    if (typeof o.highPrice !== 'undefined') {
      const n = toNumber(o.highPrice);
      if (n !== null) max = max === undefined ? n : Math.max(max, n);
    }
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

export interface JsonLdOffer {
  '@type'?: string;
  price?: string | number;
  lowPrice?: string | number;
  highPrice?: string | number;
  priceCurrency?: string;
  name?: string;
}

export interface JsonLdPlace {
  name?: string;
  address?: {
    streetAddress?: string;
    postalCode?: string | number;
    addressLocality?: string;
  };
}

export interface JsonLdEvent {
  '@type'?: string | string[];
  description?: string;
  image?: string | string[];
  location?: JsonLdPlace | JsonLdPlace[];
  organizer?: { name?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
}

function findJsonLdEvent($: CheerioAPI): JsonLdEvent | null {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    const raw = $(s).text();
    if (!raw) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    for (const c of unwrapJsonLd(parsed)) {
      const t = c['@type'];
      if (t === 'Event' || (Array.isArray(t) && t.includes('Event'))) return c;
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
      return obj['@graph'].filter((x): x is JsonLdEvent => x !== null && typeof x === 'object');
    }
    return [parsed as JsonLdEvent];
  }
  return [];
}

// ─── Layer 3a: Schema.org Microdata (itemprop) ────────────────────────────────
// Many sites that don't have JSON-LD use HTML microdata. Falter, treibhaus,
// and others mark up address fields with itemprop="streetAddress" etc.

export function applyMicrodata($: CheerioAPI, out: DetailEnrichment): void {
  // streetAddress — accept both first-content-bearing element AND `<meta itemprop>` tags.
  if (!out.address) {
    const v = readMicrodataValue($, 'streetAddress');
    if (v) out.address = v.trim();
  }
  if (!out.postal_code) {
    const v = readMicrodataValue($, 'postalCode');
    if (v) out.postal_code = v.trim();
  }
  if (!out.address_locality) {
    const v = readMicrodataValue($, 'addressLocality');
    if (v) out.address_locality = v.trim();
  }
  if (!out.location_name) {
    // location.name — pick the first itemprop="name" that lives inside an
    // itemprop="location" scope. Falls back to "" so it never picks an
    // unrelated name elsewhere on the page.
    const $loc = $('[itemprop="location"]').first();
    if ($loc.length) {
      const v = $loc.find('[itemprop="name"]').first().attr('content')
        ?? $loc.find('[itemprop="name"]').first().text().trim();
      if (v) out.location_name = v;
    }
  }
}

function readMicrodataValue($: CheerioAPI, prop: string): string | undefined {
  const $el = $(`[itemprop="${prop}"]`).first();
  if (!$el.length) return undefined;
  // <meta itemprop="..." content="..."> is the standard pattern; otherwise text.
  return $el.attr('content') ?? $el.text();
}

// ─── Layer 3: OpenGraph meta ──────────────────────────────────────────────────

export function applyOgMeta($: CheerioAPI, out: DetailEnrichment): void {
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

// ─── Layer 4: Vertical table (<th>label</th><td>value</td>) ──────────────────

const LABEL_FIELD_MAP: Array<{ labels: RegExp; field: keyof DetailEnrichment }> = [
  { labels: /^(ort|veranstaltungsort)$/i, field: 'location_name' },
  { labels: /^(veranstalter|organisator)$/i, field: 'organizer' },
  { labels: /^(adresse|anschrift)$/i, field: 'address' },
  { labels: /^(plz|postleitzahl)$/i, field: 'postal_code' },
  { labels: /^(eintritt|kosten|preis|gebühr|teilnahmegebühr|kursgebühr)$/i, field: 'price_text' },
  { labels: /^(beschreibung|info|infos|details)$/i, field: 'description' },
];

export function applyVerticalTable($: CheerioAPI, out: DetailEnrichment): void {
  $('table.verticaltable tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').first().text().trim();
    if (!label) return;

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

      if (field === 'location_name' || field === 'address') {
        parseLocationSegments(segments, out);
      }

      if (out[field] === undefined) {
        if (field === 'location_name') {
          if (segments[0]) (out as Record<string, unknown>)[field] = segments[0];
        } else if (field === 'address') {
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

// ─── Layer 5: Regex fallbacks ─────────────────────────────────────────────────

const ADDRESS_REGEX =
  /([A-ZÄÖÜ][A-Za-zäöüß.\- ]+?(?:straße|strasse|gasse|platz|weg|allee|ring|markt))\s+(\d+[a-zA-Z]?)(?=[,\s\n])/u;

const LABELED_ADDRESS_REGEX =
  /(?:Adresse|Anschrift|Wo|Treffpunkt|Veranstaltungsort|Ort)\s*[:\-]?\s+([^\n;]{4,160})/iu;

const LABELED_PRICE_REGEX =
  /(?:Eintritt|Kosten|Preis|Gebühr|Teilnahmegebühr|Kursgebühr|Kosten?beitrag|Tickets?)\s*[:\-]\s*((?:€\s*)?\d+(?:[.,]\d{1,2})?(?:\s*€)?(?:\s*[-–]\s*\d+(?:[.,]\d{1,2})?\s*€?)?|frei|kostenlos|gratis|kostenfrei|Spende[^\n;]*)/iu;

const PLZ_CITY_REGEX =
  /\b(\d{4})\s+((?:Bad|Sankt|St\.?|Wiener|Klein|Groß|Ober|Unter|Nieder)\s+[A-ZÄÖÜ][A-Za-zäöüß\-]{2,}|[A-ZÄÖÜ][A-Za-zäöüß\-]{2,})/u;

const FREE_PATTERNS =
  /eintritt\s+frei|frei(?:er)?\s+eintritt|gratis|kostenlos|kostenfrei|teilnahme\s+(?:ist\s+)?kostenlos|eintritt\s*[:\-]?\s*frei|keine\s+(?:eintritts)?gebühr/i;
const DONATION_PATTERNS =
  /spende\s*(?:nbasis|n\s+erbeten|n\s+willkommen)?|freiwillige[sn]?\s+(?:beitrag|spende|eintritt)/i;
const EURO_REGEX =
  /(?:eintritt|kosten|preis|gebühr|teilnahmegebühr|kursgebühr|kurskosten|tickets?|karte[ns]?|erwachsene|ermäßigt|ermaessigt|vvk|ak|abendkasse|kostet)\s*[:\-]?\s*(?:ab\s+)?€?\s*(\d{1,3}(?:[.,]\d{1,2})?)/i;
const GENERIC_EURO_REGEX =
  /(?:€\s*(\d{1,3}(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:€|EUR|Euro))(?!\s*\d)/i;

function normalizePriceText(out: DetailEnrichment): void {
  if (!out.price_text || out.price_min !== undefined) return;
  const t = out.price_text.toLowerCase();
  if (FREE_PATTERNS.test(t)) { out.price_min = 0; out.price_max = 0; return; }
  if (DONATION_PATTERNS.test(t)) { out.price_min = 0; return; }
  const m = out.price_text.match(/(\d{1,3}(?:[.,]\d{1,2})?)/);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(v) && v >= 0 && v <= 500) { out.price_min = v; out.price_max = v; }
  }
}

export function applyRegexFallbacks(out: DetailEnrichment, $?: CheerioAPI): void {
  normalizePriceText(out);

  let text = out.description ?? '';
  if (text.length < 80 && $ && !out.address && !out.postal_code) {
    const $main = $('main, article, .main-content, #content, .event-detail, .entry-content').first();
    if ($main.length) {
      const body = $main.text().replace(/\s+/g, ' ').trim();
      if (body.length > 30 && body.length < 5000) {
        text = (text + ' ' + body).slice(0, 5000);
      }
    }
  }

  if (!out.address && text) {
    const m = text.match(ADDRESS_REGEX);
    if (m) out.address = `${m[1].trim()} ${m[2]}`;
  }

  if (!out.address && text) {
    const m = text.match(LABELED_ADDRESS_REGEX);
    if (m) {
      const value = m[1].trim();
      const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1 && /\d/.test(parts[0]) && parts[0].length >= 4 && parts[0].length <= 80) {
        out.address = parts[0];
      } else if (parts.length >= 2) {
        for (const p of parts) {
          const pm = p.match(/^(\d{4})\s+([A-ZÄÖÜ][A-Za-zäöüß\-\s]+)$/u);
          if (pm) {
            if (!out.postal_code) out.postal_code = pm[1];
            if (!out.address_locality) out.address_locality = pm[2].trim();
            continue;
          }
          if (/^\d{4}$/.test(p)) { if (!out.postal_code) out.postal_code = p; continue; }
          const sm = p.match(/^([A-ZÄÖÜ][A-Za-zäöüß.\- ]+?(?:straße|strasse|gasse|platz|weg|allee|ring|markt))\s+(\d+[a-zA-Z]?)$/u);
          if (sm) { if (!out.address) out.address = `${sm[1]} ${sm[2]}`; continue; }
          const fm = p.match(/^([A-ZÄÖÜ][A-Za-zäöüß\-]{2,})\s+(\d+[a-zA-Z]?)$/u);
          if (fm && !out.address) { out.address = `${fm[1]} ${fm[2]}`; continue; }
          if (!out.location_name && p.length > 3 && !/^\d/.test(p)) out.location_name = p;
        }
        if (!out.address) {
          const candidate = parts.find((p) => /\d/.test(p) && !/^\d{4}\b/.test(p));
          if (candidate) out.address = candidate;
        }
      }
    }
  }

  if ((!out.postal_code || !out.address_locality) && text) {
    const re = new RegExp(PLZ_CITY_REGEX.source, 'gu');
    const labelWords = /^(Ort|Termin|Datum|Wann|Wo|Zeit|Uhr|Adresse|Kontakt|Veranstalter|Beitrag|Gebühr|Eintritt|Preis|Kosten)$/i;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(text)) !== null) {
      const plz = mm[1];
      const city = mm[2].trim();
      if (parseInt(plz, 10) >= 2024 && parseInt(plz, 10) <= 2030) continue;
      if (labelWords.test(city)) continue;
      if (!out.postal_code) out.postal_code = plz;
      if (!out.address_locality) out.address_locality = city;
      break;
    }
  }

  if (!out.price_text && text) {
    const labeled = text.match(LABELED_PRICE_REGEX);
    if (labeled) {
      const valRaw = labeled[1].trim();
      if (/^(frei|kostenlos|gratis|kostenfrei)$/i.test(valRaw)) {
        out.price_text = 'Eintritt frei'; out.price_min = 0; out.price_max = 0;
      } else if (/spende/i.test(valRaw)) {
        out.price_text = valRaw.slice(0, 60); out.price_min = 0;
      } else {
        const nums = valRaw.match(/(\d+(?:[.,]\d{1,2})?)/g);
        if (nums && nums.length > 0) {
          const min = parseFloat(nums[0].replace(',', '.'));
          const max = nums[1] ? parseFloat(nums[1].replace(',', '.')) : min;
          if (!isNaN(min) && min >= 0 && min <= 500 && !isNaN(max)) {
            out.price_min = min; out.price_max = max;
            out.price_text = min === max ? formatEuro(min) : `${formatEuro(min)} – ${formatEuro(max)}`;
          }
        }
      }
    }
  }
  if (!out.price_text && text) {
    if (FREE_PATTERNS.test(text)) { out.price_text = 'Eintritt frei'; out.price_min = 0; out.price_max = 0; }
    else if (DONATION_PATTERNS.test(text)) { out.price_text = 'Spende erbeten'; out.price_min = 0; }
    else {
      const m = text.match(EURO_REGEX);
      if (m) {
        const v = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(v) && v >= 0 && v <= 500) { out.price_text = formatEuro(v); out.price_min = v; out.price_max = v; }
      }
    }
  }
  if (!out.price_text && text) {
    const m = text.match(GENERIC_EURO_REGEX);
    if (m) {
      const raw = m[1] ?? m[2];
      const v = parseFloat(raw.replace(',', '.'));
      if (!isNaN(v) && v >= 2 && v <= 500) { out.price_text = formatEuro(v); out.price_min = v; out.price_max = v; }
    }
  }

  // Address validity guard — reject false-positives that universal regexes
  // can produce ("Tisch 5", "12. Bezirk").
  if (out.address && !isValidAddressText(out.address)) {
    delete out.address;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(v: number): string {
  if (Number.isInteger(v)) return `€ ${v},–`;
  return `€ ${v.toFixed(2).replace('.', ',')}`;
}

function stripHtml(s: string): string {
  const $ = cheerio.load(`<div>${s}</div>`);
  return $('div').text().replace(/\s+/g, ' ').trim();
}

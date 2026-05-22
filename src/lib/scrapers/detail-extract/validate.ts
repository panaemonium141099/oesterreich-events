// src/lib/scrapers/detail-extract/validate.ts
// Validity checks used by both the extractor (gate inputs) and the merge
// layer (gate outputs). See spec §5 + §6.

import type { CheerioAPI } from 'cheerio';

const NON_ADDRESS_PREFIX =
  /^(saal|tisch|raum|reihe|sitz|bezirk|stock|etage|ab|von|bis|tor|halle)\s+\d/i;
const NUMBER_PREFIX_BEZIRK = /^\d+\.\s*bezirk/i;
const STREET_WITH_NUMBER = /[A-ZÄÖÜ][A-Za-zäöüß.\- ]{2,}\s+\d+[a-zA-Z]?\b/u;

/**
 * Strict address validator. Returns true only when the string looks like
 * an actual street + house number — not "Tisch 5" or "12. Bezirk".
 */
export function isValidAddressText(s: string | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 4) return false;
  if (t.length > 80) return false; // real addresses don't exceed 80 chars
  if (NUMBER_PREFIX_BEZIRK.test(t)) return false;
  if (NON_ADDRESS_PREFIX.test(t)) return false;
  // Reject obvious junk: pipes, multiple punctuation, sentence patterns
  if (/[|]/.test(t)) return false;
  if (/[.!?]\s+\w/.test(t)) return false; // sentence boundary inside
  if ((t.match(/\s/g) ?? []).length > 4) return false; // address has at most 4 spaces
  // Reject collapsed concatenations like "WiesmathSchulstraße" or
  // "AdresseTeichweg" — those come from <br>/tag boundaries that got
  // squashed into one token. Real street names don't have lowercase+UPPER
  // mid-word (Bindestrich-Kompositionen use dashes, not CamelCase).
  if (/[a-zäöüß][A-ZÄÖÜ]/.test(t)) return false;
  if (!STREET_WITH_NUMBER.test(t)) return false;
  // Strip common prefix-noise that the body scan can leak in
  return true;
}

const BAD_TITLE_TOKENS = /(404|not\s*found|fehler|wartung|maintenance|access\s*denied|forbidden)/i;
const COOKIE_TOKENS = /(cookie|datenschutz|akzeptieren|consent|wir\s+verwenden\s+cookies)/gi;

/**
 * Reject HTML that obviously isn't a real event-detail page: 404 / maintenance,
 * empty body, or cookie-wall content. Saves the extractor from filling fields
 * with garbage from boilerplate.
 */
export function isValidHtml(_html: string, $: CheerioAPI): boolean {
  const title = $('title').first().text();
  if (BAD_TITLE_TOKENS.test(title)) return false;

  // Strong structural signal: if the page has a JSON-LD Event block, it's
  // unambiguously an event detail page — even if our body-text fallback
  // selectors miss the main content (e.g. SPA-rendered sidebars dominate).
  if (hasEventJsonLd($)) return true;

  // Microdata signal (Schema.org itemprop="streetAddress" or itemprop="location")
  // also unambiguously marks an event page.
  if ($('[itemprop="streetAddress"], [itemprop="location"]').length > 0) return true;

  const $main = $('main, article, [role="main"], .main-content, #content').first();
  const body = ($main.length ? $main : $('body'))
    .text()
    .replace(/\s+/g, ' ')
    .trim();
  if (body.length < 200) return false;

  // Cookie wall heuristic: >50% of words match cookie/consent tokens
  const words = body.toLowerCase().split(/\s+/);
  if (words.length > 20) {
    const matches = body.match(COOKIE_TOKENS);
    if (matches && matches.length / words.length > 0.5) return false;
  }
  return true;
}

function hasEventJsonLd($: CheerioAPI): boolean {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    const txt = $(s).text();
    if (!txt) continue;
    // Cheap string check first to avoid parsing every JSON block.
    if (!txt.includes('"Event"')) continue;
    try {
      const parsed = JSON.parse(txt);
      const items = Array.isArray(parsed) ? parsed : (parsed?.['@graph'] ?? [parsed]);
      for (const item of items) {
        if (!item) continue;
        const t = item['@type'];
        if (t === 'Event' || (Array.isArray(t) && t.includes('Event'))) return true;
      }
    } catch { /* skip malformed */ }
  }
  return false;
}

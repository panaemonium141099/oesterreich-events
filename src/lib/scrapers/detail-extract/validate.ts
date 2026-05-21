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
  if (NUMBER_PREFIX_BEZIRK.test(t)) return false;
  if (NON_ADDRESS_PREFIX.test(t)) return false;
  return STREET_WITH_NUMBER.test(t);
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

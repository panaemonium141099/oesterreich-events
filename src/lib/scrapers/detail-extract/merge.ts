// src/lib/scrapers/detail-extract/merge.ts
// Per-field merge rules. See spec §4 for the rule table — keep them in sync.

import type { ScrapedEvent } from '@/types/events';
import type { DetailEnrichment } from './types';
import { isValidAddressText } from './validate';

export function mergeEnrichment(e: ScrapedEvent, d: Partial<DetailEnrichment>): void {
  // address — detail wins when valid. Strip trailing punctuation noise.
  if (d.address && isValidAddressText(d.address)) {
    e.address = d.address.replace(/[\s,;]+$/, '');
  }

  // postal_code — detail wins when exactly 4 digits
  if (d.postal_code && /^\d{4}$/.test(d.postal_code)) {
    e.postal_code = d.postal_code;
  }

  // location_name — detail wins when longer than listing
  if (d.location_name) {
    const cur = e.location_name ?? '';
    if (d.location_name.length > cur.length) e.location_name = d.location_name;
  }

  // description — listing wins when already substantial (>= 200 chars)
  if (d.description) {
    const cur = e.description ?? '';
    if (cur.length < 200) e.description = d.description;
  }

  // image_url — detail wins (hi-res over thumbnail) when present
  if (d.image_url) e.image_url = d.image_url;

  // price_text / price_min / price_max — only when listing was empty
  if (!e.price_text && d.price_text) e.price_text = d.price_text;
  if (e.price_min === undefined && d.price_min !== undefined) e.price_min = d.price_min;
  if (e.price_max === undefined && d.price_max !== undefined) e.price_max = d.price_max;

  // organizer — only when listing was empty
  if (!e.organizer && d.organizer) e.organizer = d.organizer;

  // title — detail wins ONLY when listing title is corrupted (HTML/newline garbage)
  if (d.title && e.title && isCorruptedTitle(e.title)) {
    e.title = d.title;
  }

  // Explicitly NOT overwritten: start_date, end_date, latitude, longitude
}

function isCorruptedTitle(t: string): boolean {
  if (/<[a-z][^>]*>/i.test(t)) return true; // contains HTML tags
  if (t.split('\n').length > 3) return true; // multi-line title
  if (t.length > 200) return true; // suspiciously long
  return false;
}

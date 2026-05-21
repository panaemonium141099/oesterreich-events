// src/lib/scrapers/detail-extract/extract.ts
// Public API: pure function (sourceName, url, html) → EnrichmentResult.
// No I/O, no DB. Composes the 5 layers + adapter lookup.

import * as cheerio from 'cheerio';
import type { EnrichmentResult, DetailEnrichment, AddressConfidence } from './types';
import { isValidHtml } from './validate';
import {
  applyJsonLd,
  applyMicrodata,
  applyOgMeta,
  applyVerticalTable,
  applyRegexFallbacks,
} from './universal';
import { getAdapter } from './registry';

const TRACKED_KEYS: ReadonlyArray<keyof DetailEnrichment> = [
  'description',
  'location_name',
  'address',
  'postal_code',
  'address_locality',
  'image_url',
  'price_text',
  'price_min',
  'price_max',
  'organizer',
  'title',
];

export function enrichFromDetailHtml(
  sourceName: string,
  url: string,
  html: string,
): EnrichmentResult {
  const result: EnrichmentResult = { layersHit: [] };

  // Preprocess: inject spaces around <br> for cheerio .text() (gem2go regression)
  const preprocessed = html.replace(/<br\s*\/?>/gi, ' <br> ');
  const $ = cheerio.load(preprocessed);

  if (!isValidHtml(html, $)) return result;

  const adapter = getAdapter(sourceName);
  if (adapter?.isDetailPage && !adapter.isDetailPage($, url)) return result;

  // Layer 1: JSON-LD
  const snap0 = snapshot(result);
  applyJsonLd($, result);
  if (changed(snap0, result)) result.layersHit.push('jsonld');

  // Layer 2: Adapter (source-specific)
  if (adapter) {
    const partial = adapter.extract($, result, url);
    const snapA = snapshot(result);
    for (const k of Object.keys(partial) as Array<keyof DetailEnrichment>) {
      const v = partial[k];
      if (v === undefined) continue;
      if (result[k] !== undefined && !adapter.overridesJsonLd) continue;
      (result as unknown as Record<string, unknown>)[k] = v;
    }
    if (changed(snapA, result)) result.layersHit.push('adapter');
  }

  // Layer 3a: Schema.org Microdata (itemprop)
  const snapM = snapshot(result);
  applyMicrodata($, result);
  if (changed(snapM, result)) result.layersHit.push('microdata');

  // Layer 3: OpenGraph
  const snap3 = snapshot(result);
  applyOgMeta($, result);
  if (changed(snap3, result)) result.layersHit.push('og');

  // Layer 4: Vertical table
  const snap4 = snapshot(result);
  applyVerticalTable($, result);
  if (changed(snap4, result)) result.layersHit.push('vtable');

  // Layer 5: Regex
  const snap5 = snapshot(result);
  applyRegexFallbacks(result, $);
  if (changed(snap5, result)) result.layersHit.push('regex');

  // Address confidence from highest-priority layer that produced an address
  result.address_confidence = computeAddressConfidence(result.layersHit, !!result.address);

  // Drop empty strings → undefined
  for (const k of TRACKED_KEYS) {
    const v = result[k];
    if (typeof v === 'string' && v.trim().length === 0) {
      delete (result as unknown as Record<string, unknown>)[k];
    }
  }

  return result;
}

function snapshot(r: EnrichmentResult): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TRACKED_KEYS) out[k] = r[k];
  return out;
}

function changed(before: Record<string, unknown>, after: EnrichmentResult): boolean {
  for (const k of TRACKED_KEYS) if (before[k] !== after[k]) return true;
  return false;
}

function computeAddressConfidence(layers: string[], hasAddress: boolean): AddressConfidence | undefined {
  if (!hasAddress) return undefined;
  if (layers.includes('jsonld') || layers.includes('adapter')) return 'high';
  if (layers.includes('microdata')) return 'high';
  if (layers.includes('vtable')) return 'medium';
  if (layers.includes('regex')) return 'low';
  return undefined;
}

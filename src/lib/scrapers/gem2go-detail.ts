// src/lib/scrapers/gem2go-detail.ts
//
// LEGACY shim — kept for backward compatibility with three production
// call sites (Gem2GoScraper, GenericGemeindeScraper, GemeindeRegistryScraper)
// and the in-tree probe / coverage-report scripts.
//
// New code should use `enrichFromDetailHtml()` from `detail-extract/extract`.

import { enrichFromDetailHtml } from './detail-extract/extract';
import type { DetailEnrichment } from './detail-extract/types';

export type { DetailEnrichment };

export function extractGem2goDetail(html: string): DetailEnrichment {
  const r = enrichFromDetailHtml('gem2go', '', html);
  // Strip the meta fields that EnrichmentResult adds — historic callers
  // only see the plain DetailEnrichment shape.
  const { layersHit: _l, address_confidence: _c, title: _t, ...fields } = r;
  return fields;
}

// src/lib/scrapers/detail-extract/types.ts
// Shared types for the detail-extract subsystem.
// See docs/superpowers/specs/2026-05-21-detail-fetch-system-design.md

import type { CheerioAPI } from 'cheerio';

export type AddressConfidence = 'high' | 'medium' | 'low';

export type DetailFetchStatus =
  | 'success'
  | 'no_change'
  | 'http_error'
  | 'timeout'
  | 'invalid_html'
  | 'parse_empty';

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
  /** Detail can also correct corrupted titles (e.g. partytimer listings). */
  title?: string;
}

export interface EnrichmentResult extends DetailEnrichment {
  address_confidence?: AddressConfidence;
  layersHit: string[];
}

export interface Adapter {
  /** All source_name values this adapter handles. */
  sourceNames: string[];

  /**
   * Source-specific CSS / DOM extraction (Layer 2).
   * `current` lets the adapter inspect what JSON-LD already produced — but
   * the composer decides whether the adapter's output is allowed to
   * override (`overridesJsonLd`).
   */
  extract(
    $: CheerioAPI,
    current: Readonly<DetailEnrichment>,
    url: string,
  ): Partial<DetailEnrichment>;

  /** When true, adapter values override JSON-LD even when JSON-LD found them. */
  overridesJsonLd?: boolean;

  /**
   * Optional gate: return false if this URL/HTML is not actually a detail
   * page (e.g. redirect to listing). Default behaviour relies on
   * `isValidHtml()` in validate.ts.
   */
  isDetailPage?($: CheerioAPI, url: string): boolean;
}

/**
 * Server-only classifier wrappers.
 *
 * This module exists solely to keep the full classifier (GeoNames DB,
 * in-memory AI cache, OpenAI SDK) out of the Turbopack client bundle.
 * Scrapers and pipeline scripts import `categorizeEvent` /
 * `categorizeEventMulti` from here; client components import pure
 * constants from `src/lib/categories.ts` instead.
 *
 * Both wrappers are thin adapters around `classifyDeterministic`. They do
 * NOT open any accept gate that the central classifier would not — the
 * scraper-provided value is persisted as `source_category_raw` and the
 * real canonical category is re-computed on upsert by
 * `resolveCanonicalCategory`.
 */

import type { Category } from '@/types/events';
import { classifyDeterministic } from '@/lib/category-classifier';

/**
 * @deprecated Prefer `resolveCanonicalCategory` from `@/lib/category-classifier`.
 * This wrapper remains for scraper compatibility — its result is stored as
 * a raw signal only; the sync layer re-runs the full classifier.
 */
export function categorizeEvent(
  title: string,
  description?: string,
  tags?: string[],
): Category {
  const outcome = classifyDeterministic({
    title,
    description: description ?? null,
    source_tags_raw: tags ?? null,
  });
  return outcome.category;
}

/**
 * @deprecated See note on `categorizeEvent`.
 */
export function categorizeEventMulti(
  title: string,
  description?: string,
  tags?: string[],
): Category[] {
  const outcome = classifyDeterministic({
    title,
    description: description ?? null,
    source_tags_raw: tags ?? null,
  });
  const result = outcome.tags.length > 0 ? outcome.tags : [outcome.category];
  return result.slice(0, 3);
}

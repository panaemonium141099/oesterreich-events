import type { Category } from '@/types/events';
import { classifyDeterministic } from '@/lib/category-classifier';

export { CATEGORIES, PRIORITY_ORDER } from '@/lib/category-classifier/taxonomy';

/**
 * Categorize an event into a single primary category.
 *
 * @deprecated Prefer `classifyDeterministic()` or `classifyWithAiFallback()`
 * from `@/lib/category-classifier`. This wrapper exists for backwards
 * compatibility only — it does NOT produce an authoritative result; the
 * scraper-provided value is persisted as `source_category_raw` and the real
 * categorization is re-computed on upsert by the central classifier.
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
 * Categorize an event into multiple tags.
 *
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

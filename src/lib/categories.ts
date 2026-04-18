/**
 * Client-safe categories module.
 *
 * This file deliberately imports ONLY from `taxonomy.ts` — a pure TypeScript
 * file with no filesystem or database dependencies. Client React components
 * (CategoryFilter, TagFilter, PopularCategories) import `CATEGORIES` from here.
 *
 * Server-only code (scrapers, pipeline, batch scripts) must use
 * `src/lib/categorize.ts` for the `categorizeEvent` / `categorizeEventMulti`
 * wrappers — those transitively pull in the GeoNames DB and the AI client,
 * which are Node-only and would break the Turbopack client bundle.
 */

export { CATEGORIES, PRIORITY_ORDER } from '@/lib/category-classifier/taxonomy';
export type { Category } from '@/types/events';

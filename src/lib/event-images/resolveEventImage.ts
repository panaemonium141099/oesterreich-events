import { normalizeEventCategory, getCategoryMeta } from './categoryMeta';

/** Simple deterministic hash for varied image selection. */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Lightweight check whether a URL string looks like a usable image candidate.
 * No network requests — just filters out obvious garbage.
 */
export function isUsableImageCandidate(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed === 'null' || trimmed === 'undefined') return false;
  // Must look like a URL
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) return false;
  return true;
}

/**
 * Get a category-specific local fallback image.
 * Deterministically picks one of N variants per category using the seed —
 * the variant count lives on each category's meta so we can bump it to 20-50+
 * once additional images are dropped into public/images/categories/ (see
 * `npm run download-category-images`).
 */
export function resolveCategoryFallbackImage(
  category: string | null | undefined,
  seed?: string,
): string {
  const meta = getCategoryMeta(category);
  const count = Math.max(1, meta.imageCount);
  const variant = seed ? (simpleHash(seed) % count) + 1 : 1;
  return `/images/categories/${meta.fallbackSlug}-${variant}.jpg`;
}

/**
 * Generic fallback — used when even the category fallback fails.
 */
export function resolveGenericFallbackImage(): string {
  return '/images/categories/default-1.jpg';
}

/**
 * Primary resolver: returns the best available image URL for an event.
 *
 * Priority:
 * 1. event's own image_url (if it passes the usability check)
 * 2. category-specific fallback
 */
export function resolvePrimaryEventImage(opts: {
  imageUrl?: string | null;
  category?: string | null;
  title?: string | null;
}): string {
  if (isUsableImageCandidate(opts.imageUrl)) {
    return opts.imageUrl!.trim();
  }
  return resolveCategoryFallbackImage(opts.category, opts.title ?? undefined);
}

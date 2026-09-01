import { normalizeEventCategory, getCategoryMeta, bundeslandToRegionKey } from './categoryMeta';

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
 *
 * If the event's bundesland maps to a regional pool (`bgld` for
 * Burgenland/NÖ — pannonian landscapes, `wien` for Vienna — urban), the
 * resolver uses that pool so a Burgenland event never shows an alpine
 * mountain photo. Falls back to the alpine default when no region matches
 * or no regional pool is configured for the category.
 */
export function resolveCategoryFallbackImage(
  category: string | null | undefined,
  seed?: string,
  bundesland?: string | null,
): string {
  const meta = getCategoryMeta(category);
  let slug = meta.fallbackSlug;
  let count = Math.max(1, meta.imageCount);

  const region = bundeslandToRegionKey(bundesland);
  if (region && meta.regions?.[region]) {
    slug = meta.regions[region]!.slug;
    count = Math.max(1, meta.regions[region]!.imageCount);
  }

  const variant = seed ? (simpleHash(seed) % count) + 1 : 1;
  return `/images/categories/${slug}-${variant}.jpg`;
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
 * 2. category + region specific fallback (bundesland-aware)
 */
/**
 * SEO-Bilder-Fix (2026-09-01): Google zeigt dank max-image-preview:large
 * GROSSE Thumbnails aus dem Seiten-/Schema-Bild — gescrapte Mini-Bilder
 * (Stichprobe: 222×222) wirken hochskaliert verpixelt und kosten CTR.
 * Bilder unterhalb dieser Breite (per probe-image-widths.ts vermessen,
 * events.image_width) werden deshalb durch die großen lokalen
 * Kategorie-/Region-Fallbacks ersetzt statt hochskaliert.
 * image_width null/-1 = (noch) nicht vermessen → Original behalten.
 */
export const MIN_TRUSTED_EVENT_IMAGE_WIDTH = 600;

export function resolvePrimaryEventImage(opts: {
  imageUrl?: string | null;
  category?: string | null;
  title?: string | null;
  bundesland?: string | null;
  /** Gemessene Breite aus events.image_width (null/-1 = unbekannt). */
  imageWidth?: number | null;
}): string {
  const tooSmall =
    opts.imageWidth != null &&
    opts.imageWidth > 0 &&
    opts.imageWidth < MIN_TRUSTED_EVENT_IMAGE_WIDTH;
  if (!tooSmall && isUsableImageCandidate(opts.imageUrl)) {
    return opts.imageUrl!.trim();
  }
  return resolveCategoryFallbackImage(opts.category, opts.title ?? undefined, opts.bundesland);
}

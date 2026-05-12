// NOTE: NO 'use client' — EventImage is a pure Server Component.
//
// Why: per fn-15.1 (Performance-Renovierung Landing) we need this to
// stay an RSC so:
//   1. Above-fold cards stay server-rendered (Pillar 9 — RSC above-fold).
//   2. next/image's automatic <link rel="preload"> emission for LCP
//      candidates works without a client-component boundary.
//
// Even though there's no 'use client' here, EventImage gets transparently
// pulled into client bundles by callers like EventCard, CalendarPageClient,
// StoriesViewer (all `'use client'`). The bundle splitter inlines this
// file into those chunks, so anything that touches a Node-only global
// (Buffer, fs, process.env.SECRETS, …) at module scope WILL break the
// browser at runtime. Keep this file isomorphic — pure constants and
// React+next/image only.
//
// Consequence: no useState, no useEffect, no onError. If a remote URL
// breaks at runtime, next/image shows nothing / the alt-text. Image
// health-check is out-of-scope (see fn-15.11/12). What we DO handle
// server-side:
//   - empty / null / garbage src → fall back to local category image
//     resolved by resolvePrimaryEventImage()
//   - generic blur placeholder data: URL while loading
//
// Caller compatibility:
// Old callers passed `src`, `category`, `title`, `bundesland`,
// `wrapperClassName`, `className`, `showGradientOverlay`,
// `objectPosition`, `objectFit`, `loading`, `fetchPriority`. We keep
// all of those working. New spec-mandated props are added on top.
//
// fn-15.2 removed the deprecated `showSkeleton` prop entirely. It was
// a no-op since fn-15.1 (RSC cannot dismiss a shimmer via onLoad). CLS
// stability is now owned by container-level Suspense skeletons in
// src/components/Landing/SectionSkeletons.tsx + next/image's built-in
// `placeholder="blur"` for the in-flight remote-image window. All 20
// call-sites were updated in the same commit.

import Image, { type ImageProps } from 'next/image';
import { resolvePrimaryEventImage } from '@/lib/event-images';

/**
 * Single, generic blur placeholder used for ALL remote images.
 * 10×10 dark gradient SVG as data:URI — pre-encoded so this file stays
 * isomorphic (no Buffer / TextEncoder needed in client bundles).
 *
 * Original SVG payload (decoded):
 *   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"
 *        preserveAspectRatio="none">
 *     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
 *       <stop offset="0" stop-color="#1a1a1a"/>
 *       <stop offset="1" stop-color="#0d0d0d"/>
 *     </linearGradient></defs>
 *     <rect width="10" height="10" fill="url(#g)"/>
 *   </svg>
 *
 * Per fn-15.1 (Codex-Round-2 Decision): one strategy, not pro-image
 * plaiceholder generation. Per-image LQIP belongs in fn-15.11.
 */
export const GENERIC_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMWExYTFhIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGQwZDBkIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+';

/**
 * Slug-normalization per epic spec — Latin transliteration for German
 * compound category names so they map to /images/categories/<slug>-N.jpg.
 *
 * Examples:
 *   'Märkte & Feste'   → 'maerkte-feste'
 *   'Kultur & Bühne'   → 'kultur-buehne'
 *   'Wein & Kulinarik' → 'wein-kulinarik'
 *
 * NOTE: this is the new normalization helper required by the fn-15.1 spec
 * (`normalizeCategory()` in the API contract). For the actual fallback-image
 * resolution we still delegate to resolveCategoryFallbackImage() which
 * uses the bundesland-aware pool. This helper is exported for tests
 * and for callers that need a deterministic slug.
 */
/**
 * Returns a class string that augments the caller-supplied wrapper with
 * the defaults EventImage needs (`relative overflow-hidden`), but DROPS
 * the `relative` default if the caller already specified a positioning
 * utility (`absolute`, `fixed`, `sticky`, `static`, or explicit `relative`).
 *
 * Why this exists (Codex review round 2 fix):
 * Several landing callers pass `wrapperClassName="absolute inset-0"`
 * because their wrapper sits inside an aspect-ratio container. With
 * Tailwind v4, the WINNER between `.relative` and `.absolute` in a
 * conflicting class set is decided by generated-CSS order, NOT by
 * className string order. So `"relative overflow-hidden absolute inset-0"`
 * can resolve to `position: relative;` and break the next/image fill
 * layout. We avoid the collision by not emitting `relative` when the
 * caller already chose a positioning class.
 */
function buildWrapperClassName(callerClass: string): string {
  const POSITION_RE = /(^|\s)(static|fixed|absolute|relative|sticky)(\s|$)/;
  const hasOwnPosition = POSITION_RE.test(callerClass);
  const base = hasOwnPosition ? 'overflow-hidden' : 'relative overflow-hidden';
  return callerClass ? `${base} ${callerClass}` : base;
}

export function normalizeCategoryToSlug(input: string | null | undefined): string {
  if (!input) return 'sonstiges';
  const slug = input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // collapse ampersands and surrounding whitespace to a single dash
    .replace(/\s*&\s*/g, '-')
    // remaining whitespace becomes a dash
    .replace(/\s+/g, '-')
    // strip any other non-slug characters
    .replace(/[^a-z0-9-]/g, '')
    // collapse repeated dashes, trim ends
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  // If sanitization stripped everything (e.g. input was '!!!' or ' & '),
  // fall back to 'sonstiges' so the resolver always has a valid pool
  // slug to look up.
  return slug.length > 0 ? slug : 'sonstiges';
}

// ─── Props ───────────────────────────────────────────────────────────
//
// Per fn-15.1 acceptance criterion: discriminated union — caller passes
// EITHER `fill: true` OR `width + height`. TypeScript compiler enforces
// this; we never have to runtime-check.

type SharedProps = {
  /** External image URL from the event (event.image_url) or null. */
  src?: string | null;
  /** Event category — used to pick a local fallback image. */
  category?: string | null;
  /** Alias for `category` — preferred new name per spec. If both are
   *  given, `category` wins for backwards compat with existing callers. */
  fallbackCategory?: string | null;
  /** Event title — seed for deterministic fallback variant. */
  title?: string | null;
  /** Event bundesland — picks region-specific fallback pool. */
  bundesland?: string | null;
  /** REQUIRED. CSS sizes attribute. Must reflect actual rendered size
   *  in the layout so next/image picks the right srcset entry. */
  sizes: string;
  /** Accessible name for the image. Default: empty string. */
  alt?: string;
  /** Class for the <img> element itself. */
  className?: string;
  /** Class for the wrapping <div> (only used in fill mode). */
  wrapperClassName?: string;
  /** Loading strategy. Default: 'lazy'. */
  loading?: 'eager' | 'lazy';
  /** fetchpriority hint. Set 'high' for above-fold non-LCP cards. */
  fetchPriority?: 'high' | 'auto' | 'low';
  /**
   * Emit `<link rel="preload" as="image">` for THIS image. Use for the
   * single LCP-candidate image per page (Next.js 16 replaces deprecated
   * `priority` with this). Only one image per landing should have it.
   */
  preload?: boolean;
  /** Optional gradient overlay (kept for callers like EventCard). */
  showGradientOverlay?: boolean;
  /** object-position for cropping. Forwarded as style. */
  objectPosition?: string;
  /** object-fit. Forwarded as style. Default: 'cover'. */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Override the auto-blur placeholder. Pass `false` to disable blur. */
  placeholder?: 'blur' | 'empty';
};

// Fill mode is the default — callers who pass neither `fill` nor explicit
// width+height get fill behavior. Explicit `fill: true` is also accepted
// (and recommended for clarity in landing-card components).
type FillProps = SharedProps & {
  fill?: true;
  width?: never;
  height?: never;
};

// Fixed-pixel-size mode — caller MUST pass `fill: false` AND both
// width and height. The TypeScript compiler enforces both being supplied
// together (you can't pass width without height or vice versa).
type FixedSizeProps = SharedProps & {
  fill: false;
  width: number;
  height: number;
};

export type EventImageProps = FillProps | FixedSizeProps;

/**
 * Central event image component (Server Component).
 *
 * Resolves the best available image URL server-side: caller's `src` if
 * usable, otherwise a category-specific local fallback. Wraps next/image
 * with a generic SVG blur placeholder.
 *
 * Sizing:
 *   • Default fill={true} — image fills wrapperClassName container.
 *     Caller is responsible for giving the wrapper a defined
 *     aspect-ratio or explicit width+height (Tailwind classes work).
 *   • fill={false} + width+height — fixed pixel dimensions, no wrapper
 *     div needed.
 *
 * LCP guidance:
 *   • Pass `preload={true}` on exactly ONE image per page (the LCP
 *     candidate above the fold).
 *   • Pass `fetchPriority="high"` on at most ~2 additional above-fold
 *     images. Below-fold cards: leave both at defaults (lazy + auto).
 */
export function EventImage(props: EventImageProps) {
  const {
    src,
    category,
    fallbackCategory,
    title,
    bundesland,
    alt = '',
    className = '',
    wrapperClassName = '',
    loading,
    fetchPriority,
    preload = false,
    showGradientOverlay = false,
    objectPosition,
    objectFit = 'cover',
    sizes,
    placeholder,
  } = props;

  // Resolve to a usable URL server-side. If src is a valid http(s) URL
  // or local /-path it passes through; otherwise we fall back to the
  // category-pool image. resolveCategoryFallbackImage() is bundesland-
  // aware and seeds variant selection by title.
  const resolvedSrc = resolvePrimaryEventImage({
    imageUrl: src,
    // category takes precedence; fallbackCategory is the new spec name.
    category: category ?? fallbackCategory ?? null,
    title,
    bundesland,
  });

  // Local /images/... paths don't need blur — they're already optimized
  // by next/image's static pipeline and the placeholder adds bytes for
  // no perceived win. We only blur remote URLs.
  const isRemote = resolvedSrc.startsWith('http://') || resolvedSrc.startsWith('https://');
  const effectivePlaceholder: 'blur' | 'empty' =
    placeholder ?? (isRemote ? 'blur' : 'empty');

  // Build the next/image props payload.
  const imageProps: Partial<ImageProps> = {
    src: resolvedSrc,
    alt,
    sizes,
    className,
    placeholder: effectivePlaceholder,
    ...(effectivePlaceholder === 'blur' ? { blurDataURL: GENERIC_BLUR_DATA_URL } : {}),
    style: {
      objectFit,
      ...(objectPosition ? { objectPosition } : {}),
    },
  };

  // Next.js 16 exposes both `preload` (new, recommended) and `priority`
  // (deprecated alias). We forward `preload` directly so the modern
  // contract is what reaches next/image — the framework still maps it to
  // the LCP `<link rel="preload" as="image">` emission. The deprecated
  // `priority` is intentionally never touched here.
  if (preload) {
    imageProps.preload = true;
  } else if (loading) {
    imageProps.loading = loading;
  }

  if (fetchPriority) {
    imageProps.fetchPriority = fetchPriority;
  }

  // Discriminated-union branch. Default (no `fill` prop OR `fill: true`)
  // is fill mode. Only `fill: false` selects fixed-pixel-size mode.
  const isFillMode = props.fill !== false;

  if (isFillMode) {
    // Default branch — fill mode. Caller MUST set wrapperClassName with
    // explicit dimensions or aspect-ratio.
    imageProps.fill = true;
    return (
      <div className={buildWrapperClassName(wrapperClassName)}>
        <Image {...(imageProps as ImageProps)} />
        {showGradientOverlay && (
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  // Fixed-size branch — no wrapper required, but caller can still pass
  // wrapperClassName to wrap for layout reasons. Cast is safe because
  // the discriminated union guarantees width+height when fill is false.
  const fixed = props as FixedSizeProps;
  imageProps.width = fixed.width;
  imageProps.height = fixed.height;

  if (wrapperClassName || showGradientOverlay) {
    return (
      <div className={buildWrapperClassName(wrapperClassName)}>
        <Image {...(imageProps as ImageProps)} />
        {showGradientOverlay && (
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  return <Image {...(imageProps as ImageProps)} />;
}


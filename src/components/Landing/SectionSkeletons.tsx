/**
 * Pixel-perfect Suspense fallbacks for the four async landing sections
 * (fn-15.2 — CLS-Stabilität).
 *
 * Each skeleton MIRRORS the loaded section's DOM structure 1:1 — same
 * section padding, same header heights, same grid breakpoints, same
 * card aspect-ratios. By using the exact same layout primitives the
 * browser computes identical box dimensions for "skeleton" and "loaded"
 * states, so the Suspense fallback → real-content swap produces ZERO
 * Cumulative Layout Shift.
 *
 * Animation strategy: a single CSS class `cls-skel` (defined in
 * globals.css) paints a low-contrast shimmer via a translated
 * pseudo-element. compositor-only, no JS, respects
 * `prefers-reduced-motion`. Per task acceptance: "CSS-only, kein JS".
 *
 * IMPORTANT — header rendering:
 * The section headers (title + subtitle line) are rendered LITERAL,
 * not as shimmer bars. They:
 *  1. Survive the JS-disabled scenario (Lighthouse "no-JS" audits)
 *  2. Give crawlers / Googlebot a hint at the section topic even before
 *     the section's data loads
 *  3. Match the loaded section's first-paint exactly, so when Suspense
 *     unwraps the real component the header doesn't pop in.
 *
 * NOTE: all skeletons are pure server-component-friendly — no hooks,
 * no client-only deps, no `'use client'` directive.
 *
 * A11y — Codex CLS-review (round 3):
 * The `<section>` wrappers are NOT marked `aria-hidden="true"`. Because the
 * underlying sections load via `dynamic({ ssr: false })`, these skeletons
 * are the ONLY server-rendered markup for landing sections. Hiding them
 * from assistive tech would leave SR users (or anyone with JS disabled)
 * with zero section context. The literal section headings ("Empfohlen für
 * dich", "Österreichs Events entdecken", "Beliebte Kategorien", "Regionen")
 * remain in the a11y tree. The decorative `cls-skel` rectangles have no
 * text content, so they don't trigger screen readers regardless.
 */

import { CATEGORIES } from '@/lib/categories';

// ─── shared bits ────────────────────────────────────────────────────

function HeaderEyebrow({
  eyebrow,
  className = '',
}: {
  eyebrow: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 mb-3 ${className}`}>
      <div className="h-px w-6 bg-white/20" />
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
        {eyebrow}
      </span>
    </div>
  );
}

// ─── WeeklyHighlights ───────────────────────────────────────────────
//
// Loaded section is `<motion.section className="w-full py-8">`
// Header: subtitle "Empfohlen für dich" + h2 "Top Events diese Woche"
// Card row: 5 cards × { w-60 (240px) × [img 160px + content 100px] }
//
// We render literal header text + 5 placeholder cards. Cards use the
// SAME w-60 / h-40 / h-[100px] dimensions as the loaded section so the
// container box height is identical.

function HighlightSkeletonCard() {
  return (
    <div className="flex-none w-60 snap-start rounded-2xl overflow-hidden border border-white/8 bg-[#111]">
      <div className="cls-skel w-full h-40" />
      <div className="p-3.5 h-[100px] flex flex-col justify-between overflow-hidden">
        <div className="space-y-1.5">
          <div className="cls-skel h-3.5 w-[85%] rounded" />
          <div className="cls-skel h-3.5 w-[60%] rounded" />
        </div>
        <div className="space-y-1.5">
          <div className="cls-skel h-2.5 w-[40%] rounded" />
          <div className="cls-skel h-2.5 w-[55%] rounded" />
        </div>
      </div>
    </div>
  );
}

export function WeeklyHighlightsSkeleton() {
  return (
    <section className="w-full py-8">
      {/* Same header layout as the loaded WeeklyHighlights so the
          subtitle + h2 paint in the exact same spot. The h2 has the
          identical min-h-* values so the geolocation-driven label
          swap ("diese Woche" → "in deiner Nähe") cannot wrap the
          heading and shift the carousel down on narrow viewports.
          Codex CLS-review (fn-15.2 round 2). */}
      <div className="flex items-center justify-between mb-5 px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-1">
            Empfohlen für dich
          </p>
          <h2 className="text-white font-bold text-xl md:text-2xl min-h-[2rem] md:min-h-[2.25rem]">
            Top Events diese Woche
          </h2>
        </div>
      </div>

      {/* Same scroll container as the loaded WeeklyHighlights: the
          mv3-h-scroll style reserves 8px of scrollbar gutter below the
          cards via ::-webkit-scrollbar { height: 8px }. The skeleton
          MUST use overflow-x-auto + the same class so that gutter is
          reserved at first paint — otherwise the cards would shift up
          by 8px when the real component mounts. */}
      <div
        className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 mv3-h-scroll"
        style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <HighlightSkeletonCard key={i} />
        ))}
      </div>
    </section>
  );
}

// ─── FestivalBlogSection ────────────────────────────────────────────
//
// Loaded section: `<motion.section className="w-full py-14">`
// Layout: 1 featured card (md:col-span-2, min-h-[440px]) + 2 stacked
// secondary cards on the right (each min-h-[180px], in a flex-col with
// gap-5 ⇒ stack = 180 + 20 + 180 = 380px on mobile, but on md the
// stack should equal featured's 440px → 440 = 180 + 180 + gap → that's
// 80px gap visually, BUT the actual layout uses `flex flex-col gap-5`
// without explicit equalization, so the cards stretch with `flex-1`.
// Then a 3-col row of 3 more secondary cards (min-h-[180px]).
//
// To keep the skeleton stable across breakpoints we mirror the EXACT
// grid/flex tree from FestivalBlogSection.

function BlogFeaturedSkeleton() {
  return (
    <div className="cls-skel relative overflow-hidden rounded-2xl h-full min-h-[440px]" />
  );
}

function BlogSecondarySkeleton() {
  return (
    <div className="cls-skel flex-1 relative overflow-hidden rounded-2xl min-h-[180px]" />
  );
}

export function FestivalBlogSectionSkeleton() {
  return (
    <section className="w-full py-14">
      {/* Section header — literal text, same classes as loaded version */}
      <div className="mb-8">
        <HeaderEyebrow eyebrow="Event-Guide 2026" className="mb-4" />
        <div className="flex items-end justify-between">
          <h2 className="text-white font-extrabold text-2xl md:text-3xl leading-tight tracking-tight">
            Österreichs Events
            <br className="hidden sm:block" /> entdecken
          </h2>
        </div>
      </div>

      {/* Same grid as loaded version: 1col mobile → 3col md (featured spans 2). */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          <BlogFeaturedSkeleton />
        </div>
        <div className="flex flex-col gap-5">
          <BlogSecondarySkeleton />
          <BlogSecondarySkeleton />
        </div>
      </div>

      {/* Additional posts row — 3 cards on sm+. The loaded section
          renders this conditionally on rest.length > 2; in practice
          ALL_POSTS has 52 posts so this row is always present. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
        <BlogSecondarySkeleton />
        <BlogSecondarySkeleton />
        <BlogSecondarySkeleton />
      </div>
    </section>
  );
}

// ─── PopularCategories ──────────────────────────────────────────────
//
// Loaded section: `<motion.section className="w-full py-10">`
// Header: eyebrow "Kategorien" + h2 "Was interessiert dich?"
// Grid: 2col mobile / 3col tablet / 4col desktop, aspect-[3/2], gap-3
// Tiles: CATEGORIES.length (12 in current taxonomy) → 6 rows mobile,
// 4 rows tablet, 3 rows desktop. We render the same count of tiles so
// the grid height matches exactly.

function CategoryTileSkeleton() {
  return <div className="cls-skel relative block overflow-hidden rounded-xl aspect-[3/2]" />;
}

export function PopularCategoriesSkeleton() {
  return (
    <section className="w-full py-10">
      <div className="mb-6">
        <HeaderEyebrow eyebrow="Kategorien" />
        <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">
          Was interessiert dich?
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* CATEGORIES is the source of truth used by PopularCategories;
            using the same array guarantees the tile count matches and
            the grid height is identical. */}
        {CATEGORIES.map(category => (
          <CategoryTileSkeleton key={category} />
        ))}
      </div>
    </section>
  );
}

// ─── RegionExplorer ─────────────────────────────────────────────────
//
// Loaded section: `<motion.section className="w-full py-10">`
// Header: eyebrow "Bundesländer" + h2 "Events nach Region"
// Grid: 2col mobile / 3col sm+, aspect-[4/3], gap-3
// 9 regions (one per Bundesland).

function RegionTileSkeleton() {
  return (
    <div className="cls-skel relative overflow-hidden rounded-2xl aspect-[4/3]" />
  );
}

export function RegionExplorerSkeleton() {
  return (
    <section className="w-full py-10">
      <div className="mb-6">
        <HeaderEyebrow eyebrow="Bundesländer" />
        <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">
          Events nach Region
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <RegionTileSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

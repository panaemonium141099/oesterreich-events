'use client';

import dynamic from 'next/dynamic';

const WeeklyHighlights = dynamic(
  () => import('@/components/Landing/WeeklyHighlights').then(m => ({ default: m.WeeklyHighlights })),
  { ssr: false }
);

const FestivalBlogSection = dynamic(
  () => import('@/components/Landing/FestivalBlogSection').then(m => ({ default: m.FestivalBlogSection })),
  { ssr: false }
);

const PopularCategories = dynamic(
  () => import('@/components/Landing/PopularCategories').then(m => ({ default: m.PopularCategories })),
  { ssr: false }
);

const RegionExplorer = dynamic(
  () => import('@/components/Landing/RegionExplorer').then(m => ({ default: m.RegionExplorer })),
  { ssr: false }
);

/**
 * Client wrapper that lazy-loads all landing sections with ssr: false
 * to avoid hydration issues with Framer Motion.
 *
 * Order:
 *  1. WeeklyHighlights    — top-scored / location-aware event carousel
 *  2. FestivalBlogSection — 3 big festival blog cards (WordPress-style)
 *  3. PopularCategories   — category grid
 *  4. RegionExplorer      — Bundesland grid
 */
export function LandingSections() {
  return (
    <div className="w-full max-w-5xl px-6 pb-10">
      <WeeklyHighlights />
      <FestivalBlogSection />
      <PopularCategories />
      <RegionExplorer />
    </div>
  );
}

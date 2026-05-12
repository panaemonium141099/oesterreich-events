'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  WeeklyHighlightsSkeleton,
  FestivalBlogSectionSkeleton,
  PopularCategoriesSkeleton,
  RegionExplorerSkeleton,
} from '@/components/Landing/SectionSkeletons';

// fn-15.2 — CLS-Stabilität:
// Each async section is `dynamic({ ssr: false })` because the sections
// use framer-motion + browser-only data fetching (geolocation, fetch).
// Two layered fallback mechanisms guarantee a zero-CLS first paint:
//
//   1. `loading: () => <Skeleton/>`
//      Renders during SSR (next/dynamic ssr:false emits this in the
//      server HTML) AND on the client while the chunk JS is loading.
//      → reserves exact box dimensions before any JS runs.
//   2. `<Suspense fallback={<Skeleton/>}>`
//      Outer safety-net for the React render boundary in case the
//      client transitions through a Suspense state on mount.
//
// Each skeleton mirrors the loaded section's layout 1:1 (same padding,
// same grid, same aspect-ratios) so the swap to real content does not
// move a single pixel. See SectionSkeletons.tsx for the contract.

const WeeklyHighlights = dynamic(
  () => import('@/components/Landing/WeeklyHighlights').then(m => ({ default: m.WeeklyHighlights })),
  { ssr: false, loading: () => <WeeklyHighlightsSkeleton /> }
);

const FestivalBlogSection = dynamic(
  () => import('@/components/Landing/FestivalBlogSection').then(m => ({ default: m.FestivalBlogSection })),
  { ssr: false, loading: () => <FestivalBlogSectionSkeleton /> }
);

const PopularCategories = dynamic(
  () => import('@/components/Landing/PopularCategories').then(m => ({ default: m.PopularCategories })),
  { ssr: false, loading: () => <PopularCategoriesSkeleton /> }
);

const RegionExplorer = dynamic(
  () => import('@/components/Landing/RegionExplorer').then(m => ({ default: m.RegionExplorer })),
  { ssr: false, loading: () => <RegionExplorerSkeleton /> }
);

/**
 * Client wrapper that lazy-loads all landing sections.
 *
 * Order on the landing page:
 *  1. WeeklyHighlights    — top-scored / location-aware event carousel
 *  2. FestivalBlogSection — 3+3 festival blog cards (WordPress-style)
 *  3. PopularCategories   — category grid
 *  4. RegionExplorer      — Bundesland grid
 *
 * Each section is wrapped in its own Suspense boundary with a pixel-
 * perfect skeleton so the four sections stream independently — a slow
 * `/api/stats/counts` doesn't hold up the carousel.
 */
export function LandingSections() {
  return (
    <div className="w-full max-w-5xl px-6 pb-10">
      <Suspense fallback={<WeeklyHighlightsSkeleton />}>
        <WeeklyHighlights />
      </Suspense>
      <Suspense fallback={<FestivalBlogSectionSkeleton />}>
        <FestivalBlogSection />
      </Suspense>
      <Suspense fallback={<PopularCategoriesSkeleton />}>
        <PopularCategories />
      </Suspense>
      <Suspense fallback={<RegionExplorerSkeleton />}>
        <RegionExplorer />
      </Suspense>
    </div>
  );
}

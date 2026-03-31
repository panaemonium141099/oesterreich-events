'use client';

import dynamic from 'next/dynamic';

const WeeklyHighlights = dynamic(
  () => import('@/components/Landing/WeeklyHighlights').then(m => ({ default: m.WeeklyHighlights })),
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
 * Client wrapper that lazy-loads all three landing sections with ssr: false
 * to avoid hydration issues with Framer Motion.
 * This wrapper must be a Client Component because next/dynamic with ssr:false
 * is only allowed inside Client Components in Next.js App Router.
 */
export function LandingSections() {
  return (
    <div className="w-full max-w-5xl px-6 pb-10">
      <WeeklyHighlights />
      <PopularCategories />
      <RegionExplorer />
    </div>
  );
}

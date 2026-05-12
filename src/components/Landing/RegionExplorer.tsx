'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EventImage } from '@/components/Events/EventImage';

// Region tiles are 2-col on mobile (≈50vw) / 3-col on sm+ (≈33vw). The
// tile aspect is 4:3 so width drives the actual fetched size.
const REGION_TILE_SIZES = '(max-width: 640px) 50vw, 33vw';

interface Region {
  name: string;
  slug: string;
  image: string;
}

const REGIONS: Region[] = [
  {
    name: 'Wien',
    slug: 'wien',
    image: 'https://images.unsplash.com/photo-1578400889704-bbd63485d516?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Niederösterreich',
    slug: 'niederoesterreich',
    image: 'https://images.unsplash.com/photo-1722352453146-2526151c8a2c?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Oberösterreich',
    slug: 'oberoesterreich',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Steiermark',
    slug: 'steiermark',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Salzburg',
    slug: 'salzburg',
    image: 'https://images.unsplash.com/photo-1759765098596-0c1bef505555?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Tirol',
    slug: 'tirol',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Vorarlberg',
    slug: 'vorarlberg',
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Kärnten',
    slug: 'kaernten',
    image: 'https://images.unsplash.com/photo-1544198365-f5d60b6d8190?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Burgenland',
    slug: 'burgenland',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=75&auto=format&fit=crop',
  },
];

// fn-15.5: motion-lib stagger replaced by CSS `.stagger-children`
// helper (globals.css) — paints each direct child with a stepped
// animation-delay. Container kicks off the cascade on mount via
// `.animate-section-in`.

export function RegionExplorer() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/counts')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.regions) setCounts(data.regions);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="w-full py-10 animate-section-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-px w-6 bg-white/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
            Bundesländer
          </span>
        </div>
        <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">
          Events nach Region
        </h2>
      </div>

      {/* Grid — 3 cols desktop, 2 col mobile. `stagger-children` cascades the
          tiles in with a 60ms step (fn-15.5: replaced motion variants
          stagger). region-tile-hover scales the image 1.07 on :hover via
          pure CSS. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger-children">
        {REGIONS.map(region => {
          const count = counts[region.name];

          return (
            <button
              key={region.name}
              onClick={() => router.push(`/${region.slug}`)}
              className="group relative overflow-hidden rounded-2xl aspect-[4/3] focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {/* Background image — scale up 1.07 on group:hover via CSS. */}
              <div
                className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.07] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              >
                {/* RegionExplorer sits below the WeeklyHighlights fold,
                    so all 9 tiles are lazy by default. No preload, no
                    fetchPriority="high". */}
                <EventImage
                  src={region.image}
                  alt={region.name}
                  sizes={REGION_TILE_SIZES}
                  fill
                  wrapperClassName="absolute inset-0"
                  loading="lazy"
                />
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/5 group-hover:from-black/80 transition-all duration-300" />

              {/* Text */}
              <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                <p className="text-white font-extrabold text-base leading-tight">
                  {region.name}
                </p>
                <p className="text-white/50 text-xs mt-0.5 tabular-nums">
                  {loading ? (
                    <span className="inline-block w-16 h-2.5 bg-white/15 rounded animate-pulse" />
                  ) : count !== undefined ? (
                    `${count.toLocaleString('de-AT')} Events`
                  ) : (
                    'Events'
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

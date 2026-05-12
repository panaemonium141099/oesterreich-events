'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ALL_POSTS } from '@/content/blog';
import type { FestivalPost } from '@/content/blog/types';
import { EventImage } from '@/components/Events/EventImage';

// Featured card spans md:col-span-2 in a 3-col grid → ~60vw on desktop;
// full-width on mobile. SecondaryCards are 1 of 3 on desktop, full-width
// on mobile. These sizes mirror the previous explicit `sizes` props.
const FEATURED_SIZES = '(max-width: 768px) 100vw, 60vw';
const SECONDARY_SIZES = '(max-width: 768px) 100vw, 30vw';

// fn-15.5: motion-lib stagger replaced with the global
// `.stagger-children` CSS helper. Cards animate-in on mount with a
// 60ms-step cascade.

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Categories that qualify for the large featured card */
const FESTIVAL_CATEGORIES = new Set([
  'Musik & Festival',
  'Festivals & Feste',
  'Festivals',
  'Musik',
  'Open-Air & Feste',
]);

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Select posts for the landing page:
 * - Featured: random festival post (from FESTIVAL_CATEGORIES)
 * - Rest: random mix with max 2 per category for diversity
 */
function selectRandomPosts(posts: FestivalPost[]): { featured: FestivalPost; rest: FestivalPost[] } {
  // Pick a random festival post for the featured slot
  const festivalPosts = posts.filter(p => FESTIVAL_CATEGORIES.has(p.category));
  const shuffledFestivals = shuffle(festivalPosts);
  const featured = shuffledFestivals[0] || posts[0];

  // Pick 5 diverse posts for the remaining slots (exclude featured)
  const remaining = shuffle(posts.filter(p => p.slug !== featured.slug));
  const rest: FestivalPost[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const post of remaining) {
    if (rest.length >= 5) break;
    const cat = post.category;
    if ((categoryCounts[cat] ?? 0) < 2) {
      rest.push(post);
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
  }

  // Fill if diversity was too strict
  for (const post of remaining) {
    if (rest.length >= 5) break;
    if (!rest.includes(post)) rest.push(post);
  }

  return { featured, rest };
}

/** Large featured card — left column */
function FeaturedCard({ post }: { post: FestivalPost }) {
  return (
    <article className="group relative h-full">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl h-full min-h-[440px]">
          {/* fn-15.1 Priority-Strategie: FestivalBlogSection sits below
              WeeklyHighlights, so the featured-card is NOT the LCP. We
              drop the previous `priority` and let it lazy-load like the
              rest. Only WeeklyHighlights[0] gets the preload. */}
          <EventImage
            src={post.heroImage}
            alt={post.title}
            sizes={FEATURED_SIZES}
            fill
            wrapperClassName="absolute inset-0"
            className="transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          <div className="absolute inset-x-0 bottom-0 p-7 md:p-9">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 rounded-sm ${post.categoryColor}`}>
                {post.category}
              </span>
              <span className="text-white/40 text-[11px] uppercase tracking-wider">
                {post.keyFacts.dates}
              </span>
              <span className="text-white/30 text-[11px]">
                &middot; {post.readingTime} Min.
              </span>
            </div>

            <h3 className="text-white font-extrabold text-2xl md:text-3xl leading-[1.15] tracking-tight mb-2 group-hover:text-white/90 transition-colors">
              {post.title}
            </h3>

            <p className="text-white/50 text-sm font-normal mb-5 line-clamp-2 max-w-lg">
              {post.excerpt}
            </p>

            <span className="inline-flex items-center gap-2 text-white text-sm font-semibold border-b border-white/30 pb-0.5 group-hover:border-white/70 transition-colors">
              Weiterlesen
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

/** Smaller card — right column & bottom row */
function SecondaryCard({ post }: { post: FestivalPost }) {
  return (
    <article className="group flex-1">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl h-full min-h-[180px]">
          <EventImage
            src={post.heroImage}
            alt={post.title}
            sizes={SECONDARY_SIZES}
            fill
            wrapperClassName="absolute inset-0"
            className="transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />

          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-sm ${post.categoryColor}`}>
                {post.category}
              </span>
              <span className="text-white/35 text-[10px] uppercase tracking-wider">
                {post.keyFacts.dates}
              </span>
            </div>
            <h3 className="text-white font-extrabold text-lg leading-tight group-hover:text-white/85 transition-colors mb-1">
              {post.title}
            </h3>
            <p className="text-white/40 text-xs line-clamp-1">
              {post.excerpt}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function FestivalBlogSection() {
  // Randomize on each mount (page load)
  const { featured, rest } = useMemo(() => selectRandomPosts(ALL_POSTS), []);

  return (
    <section
      id="event-guide"
      className="w-full py-14 animate-section-in"
      aria-labelledby="event-guide-heading"
    >
      {/* Section header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px w-8 bg-white/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
            Event-Guide 2026
          </span>
        </div>

        <div className="flex items-end justify-between">
          <h2
            id="event-guide-heading"
            className="text-white font-extrabold text-2xl md:text-3xl leading-tight tracking-tight"
          >
            Österreichs Events
            <br className="hidden sm:block" /> entdecken
          </h2>

          <Link
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors group"
          >
            Alle Event-Guides
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Layout: 1 large card left + 2 stacked cards right. The
          stagger-children helper cascades them in. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger-children">
        <div className="md:col-span-2">
          <FeaturedCard post={featured} />
        </div>

        <div className="flex flex-col gap-5">
          {rest.slice(0, 2).map(post => (
            <SecondaryCard key={post.slug} post={post} />
          ))}
        </div>
      </div>

      {/* Additional posts row */}
      {rest.length > 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5 stagger-children">
          {rest.slice(2, 5).map(post => (
            <SecondaryCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {/* Mobile link */}
      <div className="mt-6 text-center sm:hidden">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors group"
        >
          Alle Event-Guides
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}

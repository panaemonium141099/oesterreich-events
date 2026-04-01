'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ALL_POSTS } from '@/content/blog';
import type { FestivalPost } from '@/content/blog/types';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Pick posts with max 2 per category for diversity */
function selectDiversePosts(posts: FestivalPost[], count: number): FestivalPost[] {
  const selected: FestivalPost[] = [];
  const categoryCounts: Record<string, number> = {};

  for (const post of posts) {
    if (selected.length >= count) break;
    const cat = post.category;
    if ((categoryCounts[cat] ?? 0) < 2) {
      selected.push(post);
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
  }

  // Fill remaining slots if diversity filter was too strict
  if (selected.length < count) {
    for (const post of posts) {
      if (selected.length >= count) break;
      if (!selected.includes(post)) {
        selected.push(post);
      }
    }
  }

  return selected;
}

/** Large featured card — left column */
function FeaturedCard({ post }: { post: FestivalPost }) {
  return (
    <motion.article variants={itemVariants} className="group relative h-full">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl h-full min-h-[440px]">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 60vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          <div className="absolute inset-x-0 bottom-0 p-7 md:p-9">
            {/* Category + Date + Reading time */}
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

            {/* Excerpt teaser */}
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
    </motion.article>
  );
}

/** Smaller card — right column & bottom row */
function SecondaryCard({ post }: { post: FestivalPost }) {
  return (
    <motion.article variants={itemVariants} className="group flex-1">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl h-full min-h-[180px]">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 30vw"
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
    </motion.article>
  );
}

export function FestivalBlogSection() {
  const top6 = selectDiversePosts(ALL_POSTS, 6);
  const [featured, ...rest] = top6;

  return (
    <motion.section
      id="event-guide"
      className="w-full py-14"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={containerVariants}
      aria-labelledby="event-guide-heading"
    >
      {/* Section header */}
      <motion.div variants={itemVariants} className="mb-8">
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
            Oesterreichs Events
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
      </motion.div>

      {/* Layout: 1 large card left + 2 stacked cards right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          {featured && <FeaturedCard post={featured} />}
        </div>

        <div className="flex flex-col gap-5">
          {rest.slice(0, 2).map(post => (
            <SecondaryCard key={post.slug} post={post} />
          ))}
        </div>
      </div>

      {/* Additional posts row */}
      {rest.length > 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
          {rest.slice(2, 5).map(post => (
            <SecondaryCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {/* Mobile link */}
      <motion.div variants={itemVariants} className="mt-6 text-center sm:hidden">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors group"
        >
          Alle Event-Guides
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </motion.div>
    </motion.section>
  );
}

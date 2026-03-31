'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FESTIVAL_POSTS } from '@/content/blog/festivals';

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

/** Large featured card — left column */
function FeaturedCard({ post }: { post: (typeof FESTIVAL_POSTS)[0] }) {
  return (
    <motion.article variants={itemVariants} className="group relative h-full">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl h-full min-h-[440px]">
          {/* Image */}
          <Image
            src={post.thumbnailImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 60vw"
            priority
          />
          {/* Gradient overlay — stronger at bottom for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          {/* Content pinned to bottom */}
          <div className="absolute inset-x-0 bottom-0 p-7 md:p-9">
            {/* Category + Date row */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/90 bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-sm">
                {post.category}
              </span>
              <span className="text-white/40 text-[11px] uppercase tracking-wider">
                {post.keyFacts.dates}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-white font-extrabold text-2xl md:text-3xl leading-[1.15] tracking-tight mb-2 group-hover:text-white/90 transition-colors">
              {post.title}
            </h3>

            {/* Subtitle / location */}
            <p className="text-white/55 text-sm font-normal mb-5 line-clamp-2 max-w-md">
              {post.keyFacts.location}
            </p>

            {/* Read link */}
            <span className="inline-flex items-center gap-2 text-white text-sm font-semibold border-b border-white/30 pb-0.5 group-hover:border-white/70 transition-colors">
              Artikel lesen
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

/** Smaller card — right column, vertical layout */
function SecondaryCard({ post }: { post: (typeof FESTIVAL_POSTS)[0] }) {
  return (
    <motion.article variants={itemVariants} className="group flex-1">
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative overflow-hidden rounded-2xl h-full min-h-[180px]">
          <Image
            src={post.thumbnailImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 30vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />

          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/75 border border-white/25 px-2 py-0.5">
                {post.category}
              </span>
              <span className="text-white/35 text-[10px] uppercase tracking-wider">
                {post.keyFacts.dates}
              </span>
            </div>
            <h3 className="text-white font-extrabold text-lg leading-tight group-hover:text-white/85 transition-colors">
              {post.title}
            </h3>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

export function FestivalBlogSection() {
  const [featured, ...rest] = FESTIVAL_POSTS;

  return (
    <motion.section
      className="w-full py-14"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={containerVariants}
    >
      {/* Section header */}
      <motion.div variants={itemVariants} className="mb-8">
        {/* Thin rule + label */}
        <div className="flex items-center gap-4 mb-4">
          <div className="h-px w-8 bg-white/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
            Festivals 2026
          </span>
        </div>

        <div className="flex items-end justify-between">
          <h2 className="text-white font-extrabold text-2xl md:text-3xl leading-tight tracking-tight">
            Diese Festivals wirst du
            <br className="hidden sm:block" /> nicht verpassen wollen
          </h2>

          <Link
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm font-medium transition-colors group"
          >
            Alle Artikel
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </motion.div>

      {/* Layout: 1 large card left + 2 stacked cards right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Featured — 2 columns */}
        <div className="md:col-span-2">
          {featured && <FeaturedCard post={featured} />}
        </div>

        {/* Secondary cards — stacked to match the featured card height */}
        <div className="flex flex-col gap-5">
          {rest.map(post => (
            <SecondaryCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

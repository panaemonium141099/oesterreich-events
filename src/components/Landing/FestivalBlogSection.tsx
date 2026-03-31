'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FESTIVAL_POSTS } from '@/content/blog/festivals';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

function FestivalCard({
  post,
  featured,
}: {
  post: (typeof FESTIVAL_POSTS)[0];
  featured?: boolean;
}) {
  return (
    <motion.article
      variants={cardVariants}
      className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gray-900/60 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:shadow-2xl hover:shadow-black/40 ${featured ? 'md:row-span-2' : ''}`}
    >
      <Link href={`/blog/${post.slug}`} className="block h-full">
        {/* Image */}
        <div
          className={`relative w-full overflow-hidden ${featured ? 'h-72 md:h-80' : 'h-52'}`}
        >
          <Image
            src={post.thumbnailImage}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            sizes={featured ? '(max-width: 768px) 100vw, 60vw' : '(max-width: 768px) 100vw, 40vw'}
          />
          {/* Gradient overlay on image bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent" />

          {/* Category badge */}
          <span
            className={`absolute top-4 left-4 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${post.categoryColor}`}
          >
            {post.category}
          </span>
        </div>

        {/* Content */}
        <div className={`p-6 ${featured ? 'md:p-8' : ''}`}>
          {/* Date + Location row */}
          <div className="flex items-center gap-3 text-white/40 text-xs mb-3">
            <span>📅 {post.keyFacts.dates}</span>
            <span>·</span>
            <span>📍 {post.keyFacts.location}</span>
          </div>

          {/* Title */}
          <h3
            className={`text-white font-extrabold leading-tight mb-3 group-hover:text-white/90 transition-colors ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}
          >
            {post.title}
          </h3>

          {/* Subtitle / excerpt */}
          <p
            className={`text-white/55 leading-relaxed mb-5 ${featured ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'}`}
          >
            {post.excerpt}
          </p>

          {/* Footer row */}
          <div className="flex items-center justify-between">
            {/* Price pill */}
            <span className="text-xs font-semibold text-white/70 bg-white/8 border border-white/10 px-3 py-1 rounded-full">
              {post.keyFacts.price.includes('frei') || post.keyFacts.price.toLowerCase().includes('frei')
                ? '🎟 Gratis'
                : `🎟 ${post.keyFacts.price.split('|')[0].trim()}`}
            </span>

            {/* Read more */}
            <span className="inline-flex items-center gap-1.5 text-white/60 text-sm font-semibold group-hover:text-white group-hover:gap-2.5 transition-all duration-200">
              Zum Artikel
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
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
      className="w-full py-12"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={containerVariants}
    >
      {/* Section header */}
      <motion.div
        variants={cardVariants}
        className="flex items-end justify-between mb-7 px-1"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35 mb-2">
            Große Festivals 2026
          </p>
          <h2 className="text-white font-extrabold text-2xl md:text-3xl leading-tight">
            Diese Festivals wirst du
            <br className="hidden sm:block" /> nicht verpassen wollen
          </h2>
        </div>
        <Link
          href="/map?category=Musik"
          className="hidden sm:inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm font-medium transition-colors group"
        >
          Alle Musik-Events
          <svg
            className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </motion.div>

      {/* Grid: 1 big + 2 small */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Featured card — spans 2 columns on desktop */}
        <div className="md:col-span-2">
          {featured && <FestivalCard post={featured} featured />}
        </div>

        {/* Right column with 2 smaller cards */}
        <div className="flex flex-col gap-5">
          {rest.map(post => (
            <FestivalCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

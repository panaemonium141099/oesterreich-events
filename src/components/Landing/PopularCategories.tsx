'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CATEGORIES } from '@/lib/categories';

// Map each category to an emoji icon
const CATEGORY_ICONS: Record<string, string> = {
  'Musik': '🎵',
  'Nightlife': '🌙',
  'Kultur': '🎭',
  'Sport': '⚽',
  'Märkte': '🛍️',
  'Wein & Kulinarik': '🍷',
  'Familie': '👨‍👩‍👧',
  'Natur': '🌿',
  'Feste & Brauchtum': '🎉',
  'Bildung': '📚',
  'Gesundheit': '💚',
  'Religion': '⛪',
  'Sonstiges': '📌',
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const tileVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export function PopularCategories() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/counts')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.categories) {
          setCounts(data.categories);
        }
      })
      .catch(() => {
        // silently fail — tiles show without counts
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <motion.section
      className="w-full py-10"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={containerVariants}
    >
      <motion.h2
        className="text-white font-bold text-xl md:text-2xl mb-6 px-1"
        variants={tileVariants}
      >
        Beliebte Kategorien
      </motion.h2>

      {/* 4-col desktop, 3-col tablet, 2-col mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((category) => {
          const count = counts[category];
          const icon = CATEGORY_ICONS[category] ?? '📌';

          return (
            <motion.button
              key={category}
              variants={tileVariants}
              onClick={() => router.push(`/map?category=${encodeURIComponent(category)}`)}
              className="bg-gray-800/60 border border-white/10 rounded-2xl p-4 text-left hover:border-white/30 hover:bg-gray-700/60 hover:shadow-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-white/30"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-2xl mb-2 block" aria-hidden="true">
                {icon}
              </span>
              <p className="text-white font-medium text-sm leading-snug group-hover:text-white/90">
                {category}
              </p>
              <p className="text-white/40 text-xs mt-0.5">
                {loading ? (
                  <span className="inline-block w-10 h-2.5 bg-white/10 rounded animate-pulse" />
                ) : count !== undefined ? (
                  `${count.toLocaleString('de-AT')} Events`
                ) : (
                  'Entdecken'
                )}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

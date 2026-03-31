'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const BUNDESLAENDER = [
  'Wien',
  'Niederösterreich',
  'Oberösterreich',
  'Steiermark',
  'Salzburg',
  'Tirol',
  'Vorarlberg',
  'Kärnten',
  'Burgenland',
];

// Subtle dark background variants — no bright colors
const TILE_BG_CLASSES = [
  'bg-gray-800',
  'bg-gray-900',
  'bg-slate-800',
  'bg-zinc-800',
  'bg-neutral-800',
  'bg-stone-800',
  'bg-gray-800/80',
  'bg-slate-900',
  'bg-zinc-900',
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const tileVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export function RegionExplorer() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/counts')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.regions) {
          setCounts(data.regions);
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
        Events nach Bundesland
      </motion.h2>

      {/* 3-col desktop, 2-col tablet, 1-col mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {BUNDESLAENDER.map((land, i) => {
          const count = counts[land];
          const bgClass = TILE_BG_CLASSES[i % TILE_BG_CLASSES.length];

          return (
            <motion.button
              key={land}
              variants={tileVariants}
              onClick={() => router.push(`/map?bundesland=${encodeURIComponent(land)}`)}
              className={`${bgClass} border border-white/10 rounded-2xl p-5 text-left hover:border-white/30 hover:shadow-lg transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-white/30`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <p className="text-white font-semibold text-base leading-snug group-hover:text-white/90">
                {land}
              </p>
              <p className="text-white/40 text-xs mt-1">
                {loading ? (
                  <span className="inline-block w-12 h-3 bg-white/10 rounded animate-pulse" />
                ) : count !== undefined ? (
                  `${count.toLocaleString('de-AT')} Events`
                ) : (
                  'Events entdecken'
                )}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const tileVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
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
        if (!cancelled && data.regions) setCounts(data.regions);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
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
      {/* Header */}
      <motion.div variants={tileVariants} className="mb-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-px w-6 bg-white/20" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
            Bundesländer
          </span>
        </div>
        <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">
          Events nach Region
        </h2>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
        {BUNDESLAENDER.map((land) => {
          const count = counts[land];

          return (
            <motion.button
              key={land}
              variants={tileVariants}
              onClick={() => router.push(`/map?bundesland=${encodeURIComponent(land)}`)}
              className="bg-gray-950 hover:bg-white/[0.04] p-5 text-left transition-colors duration-150 focus:outline-none focus:bg-white/[0.06] group"
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
            >
              <p className="text-white font-semibold text-sm leading-snug mb-1 group-hover:text-white/80 transition-colors">
                {land}
              </p>
              <p className="text-white/25 text-xs tabular-nums">
                {loading ? (
                  <span className="inline-block w-14 h-2.5 bg-white/8 rounded animate-pulse" />
                ) : count !== undefined ? (
                  `${count.toLocaleString('de-AT')} Events`
                ) : (
                  'Events'
                )}
              </p>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

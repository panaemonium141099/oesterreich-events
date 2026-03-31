'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CATEGORIES } from '@/lib/categories';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const tileVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' as const } },
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
        if (!cancelled && data.categories) setCounts(data.categories);
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
            Kategorien
          </span>
        </div>
        <h2 className="text-white font-extrabold text-2xl md:text-3xl tracking-tight">
          Was interessiert dich?
        </h2>
      </motion.div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((category) => {
          const count = counts[category];

          return (
            <motion.button
              key={category}
              variants={tileVariants}
              onClick={() => router.push(`/map?category=${encodeURIComponent(category)}`)}
              className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/20 rounded-xl p-4 text-left transition-all duration-200 focus:outline-none focus:border-white/30"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <p className="text-white font-semibold text-sm leading-snug mb-1 group-hover:text-white/85 transition-colors">
                {category}
              </p>
              <p className="text-white/25 text-xs tabular-nums">
                {loading ? (
                  <span className="inline-block w-12 h-2.5 bg-white/8 rounded animate-pulse" />
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';

interface Region {
  name: string;
  image: string;
}

const REGIONS: Region[] = [
  {
    // Stephansdom Wien
    name: 'Wien',
    image: 'https://images.unsplash.com/photo-1578400889704-bbd63485d516?w=600&q=75&auto=format&fit=crop',
  },
  {
    // Weinviertel / Weinfelder
    name: 'Niederösterreich',
    image: 'https://images.unsplash.com/photo-1722352453146-2526151c8a2c?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Oberösterreich',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Steiermark',
    image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=75&auto=format&fit=crop',
  },
  {
    // Hohensalzburg Festung + Altstadt
    name: 'Salzburg',
    image: 'https://images.unsplash.com/photo-1759765098596-0c1bef505555?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Tirol',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Vorarlberg',
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Kärnten',
    image: 'https://images.unsplash.com/photo-1544198365-f5d60b6d8190?w=600&q=75&auto=format&fit=crop',
  },
  {
    name: 'Burgenland',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=75&auto=format&fit=crop',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
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
      viewport={{ once: true, margin: '-60px' }}
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

      {/* Grid — 3 cols desktop, 2 col mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {REGIONS.map(region => {
          const count = counts[region.name];

          return (
            <motion.button
              key={region.name}
              variants={tileVariants}
              onClick={() => router.push(`/map?bundesland=${encodeURIComponent(region.name)}`)}
              className="group relative overflow-hidden rounded-2xl aspect-[4/3] focus:outline-none focus:ring-2 focus:ring-white/30"
              whileHover="hover"
            >
              {/* Background image */}
              <motion.div
                className="absolute inset-0"
                variants={{ hover: { scale: 1.07 } }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Image
                  src={region.image}
                  alt={region.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </motion.div>

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
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

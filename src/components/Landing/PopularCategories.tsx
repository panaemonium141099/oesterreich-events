'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { CATEGORIES } from '@/lib/categories';

// Unsplash images per category
const CATEGORY_IMAGES: Record<string, string> = {
  // Brass band / Blasmusik — not a rock concert
  Musik: 'https://images.unsplash.com/photo-1711336622443-d53a1f1156bc?w=600&q=75&auto=format&fit=crop',
  Kultur: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&q=75&auto=format&fit=crop',
  Sport: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=75&auto=format&fit=crop',
  // Vienna farmers market
  Märkte: 'https://images.unsplash.com/photo-1576181456177-2b99ac0aa1ef?w=600&q=75&auto=format&fit=crop',
  'Wein & Kulinarik': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=75&auto=format&fit=crop',
  Familie: 'https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?w=600&q=75&auto=format&fit=crop',
  Natur: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75&auto=format&fit=crop',
  // Folk costumes / Volksfest — traditional dancing in Tracht
  'Feste & Brauchtum': 'https://images.unsplash.com/photo-1758903134147-c756cd05b9aa?w=600&q=75&auto=format&fit=crop',
  Nightlife: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600&q=75&auto=format&fit=crop',
  Bildung: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&q=75&auto=format&fit=crop',
  Gesundheit: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=75&auto=format&fit=crop',
  // Church tower with cross
  Religion: 'https://images.unsplash.com/photo-1714017971946-49bd73150333?w=600&q=75&auto=format&fit=crop',
  Sonstiges: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=75&auto=format&fit=crop',
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=75&auto=format&fit=crop';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const tileVariants = {
  hidden: { opacity: 0, y: 16 },
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

      {/* Grid — 2 col mobile / 3 col tablet / 4 col desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map(category => {
          const count = counts[category];
          const image = CATEGORY_IMAGES[category] ?? FALLBACK_IMAGE;

          return (
            <motion.button
              key={category}
              variants={tileVariants}
              onClick={() => router.push(`/map?category=${encodeURIComponent(category)}`)}
              className="group relative overflow-hidden rounded-xl aspect-[3/2] focus:outline-none focus:ring-2 focus:ring-white/30"
              whileHover="hover"
            >
              {/* Background image */}
              <motion.div
                className="absolute inset-0"
                variants={{ hover: { scale: 1.08 } }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Image
                  src={image}
                  alt={category}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              </motion.div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent group-hover:from-black/80 transition-all duration-300" />

              {/* Text */}
              <div className="absolute inset-x-0 bottom-0 p-3 text-left">
                <p className="text-white font-bold text-sm leading-tight">{category}</p>
                <p className="text-white/45 text-[10px] mt-0.5 tabular-nums">
                  {loading ? (
                    <span className="inline-block w-12 h-2 bg-white/15 rounded animate-pulse" />
                  ) : count !== undefined ? (
                    `${count.toLocaleString('de-AT')} Events`
                  ) : (
                    'Entdecken'
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

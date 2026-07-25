'use client';

/**
 * "Jetzt geoeffnet"-Badge (fn-18 Task 3, Epic E8).
 *
 * Client-Komponente: die Detailseite ist ISR (revalidate=3600) und darf
 * den Live-Zustand nicht server-seitig einbacken. Der Badge rendert
 * server-seitig NICHTS und rechnet erst nach Mount (kein Hydration-
 * Mismatch); Auswertung ausschliesslich ueber das normalisierte
 * opening_times-Feld in Europe/Vienna (open-now.ts, pur/getestet).
 */

import { useEffect, useState } from 'react';
import type { NormalizedOpeningWindow } from '@/lib/activities/opening';
import { isOpenNow } from './open-now';

interface OpenNowBadgeProps {
  openingTimes: NormalizedOpeningWindow[] | null;
  labels: { open: string; closed: string };
}

export function OpenNowBadge({ openingTimes, labels }: OpenNowBadgeProps) {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!openingTimes || openingTimes.length === 0) return;
    setOpen(isOpenNow(openingTimes));
  }, [openingTimes]);

  if (open === null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        open
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-white/10 text-white/50'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-400' : 'bg-white/40'}`}
        aria-hidden
      />
      {open ? labels.open : labels.closed}
    </span>
  );
}

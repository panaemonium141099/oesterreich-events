'use client';

import { useEffect, useState } from 'react';

/**
 * Client-Component, NICHT mehr server-render-blocking.
 *
 * Pre-Refactor: war ein async Server-Component der per Render einen
 * supabase count('estimated') gegen events feuerte. Das blockierte den
 * Streaming-Render der Landing-Page um ~18-26 s.
 *
 * Jetzt: Render initialer fallback (75000+) instant. Der echte Count
 * kommt aus /api/stats/counts.total — die GLEICHE Zahl die der Map-
 * Counter zeigt (visibility=public AND publish_status IN (published,
 * low_confidence) AND start_date >= today AND geocoded).
 *
 * Vorher zeigte LandingStats `regions_sum × 0.70` (Dedup-Schätzung) —
 * das war ~36k während Map ~76k zeigte. User-Verwirrung. Jetzt eine
 * Source of Truth.
 */
const FALLBACK = 75000;

export function LandingStats() {
  const [total, setTotal] = useState<number>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    // dedup_total = was Map-Header zeigt (post title+date Dedup) —
    // damit Landing-Badge dieselbe Zahl rendert. Falls dedup_total
    // fehlt (Cache von vor diesem Deploy), Fallback auf raw total.
    fetch('/api/stats/counts')
      .then(res => res.ok ? res.json() : null)
      .then((data: { total?: number; dedup_total?: number } | null) => {
        if (cancelled || !data) return;
        const n = data.dedup_total ?? data.total ?? 0;
        if (n > 0) setTotal(n);
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  const formatted = total.toLocaleString('de-AT');

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
      <p className="text-white/40 text-lg md:text-xl">
        <span className="text-white font-semibold">{formatted}+</span> Events in ganz Österreich
      </p>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/25">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        Täglich aktualisiert
      </span>
    </div>
  );
}

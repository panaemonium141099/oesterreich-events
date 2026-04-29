'use client';

import { useEffect, useState } from 'react';

/**
 * Client-Component, NICHT mehr server-render-blocking.
 *
 * Pre-Refactor: war ein async Server-Component der per Render einen
 * supabase count('estimated') gegen events feuerte. Das blockierte den
 * Streaming-Render der Landing-Page um ~18-26 s (selbst nach
 * count=estimated, weil Vercel-Cold-Start + DB-Round-Trip + Planner-
 * Lookup pro Render passiert).
 *
 * Jetzt: Render initialer fallback (43000+) instant. Der echte Count
 * kommt async über /api/stats/counts (das aggregiert eh schon Region+
 * Category — ein Total ist ableitbar). Falls der Fetch fehlschlägt
 * bleibt der Fallback stehen.
 */
const FALLBACK = 43000;
const DEDUP_RATIO = 0.70;

export function LandingStats() {
  const [total, setTotal] = useState<number>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats/counts', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then((data: { regions?: Record<string, number> } | null) => {
        if (cancelled || !data?.regions) return;
        const sum = Object.values(data.regions).reduce((a, b) => a + b, 0);
        if (sum > 0) setTotal(Math.round(sum * DEDUP_RATIO));
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

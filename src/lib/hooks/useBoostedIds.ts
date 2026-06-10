'use client';

import { useEffect, useState } from 'react';

/**
 * Lädt die aktuell effektiv geboosteten Event-IDs aus dem frischen
 * /api/events/boosted-Endpoint (nur ~5s edge-gecacht). Bewusst NICHT aus dem
 * 2h-gecachten /api/events-Payload, damit ein beendeter Boost sofort
 * verschwindet — auf Karte UND in der Liste konsistent.
 */
export function useBoostedIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch('/api/events/boosted')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.ids)) setIds(new Set<string>(d.ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return ids;
}

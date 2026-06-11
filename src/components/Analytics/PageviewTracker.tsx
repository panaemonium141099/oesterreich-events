'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

/**
 * Globaler Page-View-Tracker. Im Root-Layout gemountet, feuert bei JEDEM
 * Pfadwechsel ein page_view — statt verstreuter Einzelaufrufe auf nur ein paar
 * Seiten. Dadurch werden auch /entdecken, /gemeinde/…, /thema/…, /blog,
 * Bundesland- und Event-Detailseiten erfasst (vorher unsichtbar in den Stats).
 *
 * Nutzt nur usePathname (kein useSearchParams → keine Suspense-Pflicht). Ein
 * Last-Path-Ref verhindert Doppel-Feuern bei React-StrictMode/Re-Renders.
 */
export function PageviewTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackEvent('page_view', { path: pathname });
  }, [pathname]);

  return null;
}

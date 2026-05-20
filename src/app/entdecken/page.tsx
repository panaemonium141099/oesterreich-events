'use client';

/**
 * /entdecken — Dual-mode discovery page (Phase 4.1).
 *
 * Mode is persisted in the URL via ?mode=list|smart. First visit
 * default = list. Legacy ?mode=filter (Phase-4) silently maps to list.
 *
 * List-Tab: <V4EntdeckenListMode> — wraps the existing EventListView +
 * FilterDrawer aus /map (Verhalten 1:1 identisch via useFilteredEvents).
 * Smart-Tab: <V4EntdeckenSmartMode> — NLP semantic search (Phase-4).
 */

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  V4EntdeckenHero,
  V4EntdeckenListMode,
  V4EntdeckenSmartMode,
} from '@/components/Discover/v4';
import { type V4EntdeckenMode } from '@/components/Events/v4';
import type { EventFilters } from '@/types/events';

function resolveMode(raw: string | null): V4EntdeckenMode {
  if (raw === 'smart') return 'smart';
  // 'filter' (Phase 4 legacy) und alles andere → 'list'.
  return 'list';
}

function deriveInitialFilters(search: URLSearchParams): Partial<EventFilters> | undefined {
  // Pick up the common URL filter params if present. This is best-effort:
  // most users will land on /entdecken with no params. Deep-links from
  // landing-page links (e.g. /entdecken?district=eisenstadt) work too.
  const out: Partial<EventFilters> = {};
  const district = search.get('district');
  if (district) out.district = district;
  const search_ = search.get('search');
  if (search_) out.search = search_;
  const category = search.get('category');
  if (category) out.category = category;
  return Object.keys(out).length > 0 ? out : undefined;
}

function EntdeckenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<V4EntdeckenMode>(resolveMode(search.get('mode')));
  const initialQuery = search.get('q') ?? '';
  const initialBlParam = search.get('bl');
  const initialBundeslandIds = initialBlParam ? [initialBlParam] : undefined;
  const initialFilters = deriveInitialFilters(search);

  // Mirror mode back into URL — list-Modus default unparametrisiert
  // damit /entdecken eine saubere URL hat. Smart-Modus persistiert
  // ?mode=smart und optional ?q=<query>.
  useEffect(() => {
    const next = new URLSearchParams();
    if (mode === 'smart') {
      next.set('mode', 'smart');
      if (initialQuery) next.set('q', initialQuery);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onModeChange = useCallback((next: V4EntdeckenMode) => { setMode(next); }, []);

  // V4EntdeckenListMode reads initialFilters/initialBundeslandIds only on
  // mount (useFilteredEvents seeds useState from them). Subsequent URL
  // changes — e.g. the user submits a new search from the top-nav while
  // already on /entdecken?search=eisenstadt — therefore would not retrigger
  // the fetch and stale results would stay on screen. The key forces a
  // remount whenever the URL-driven inputs change, which is the cleanest
  // way to re-seed state from the new URL.
  const listModeKey = [
    initialBlParam ?? '',
    initialFilters?.search ?? '',
    initialFilters?.district ?? '',
    initialFilters?.category ?? '',
  ].join('|');

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4EntdeckenHero mode={mode} onModeChange={onModeChange}/>
      {mode === 'list' ? (
        <V4EntdeckenListMode
          key={listModeKey}
          initialBundeslandIds={initialBundeslandIds}
          initialFilters={initialFilters}
        />
      ) : (
        <V4EntdeckenSmartMode initialQuery={initialQuery}/>
      )}
    </div>
  );
}

export default function EntdeckenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--v4-surface)]"/>}>
      <EntdeckenInner/>
    </Suspense>
  );
}

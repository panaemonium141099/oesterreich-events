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
  // Place-scope deep-link from a hub page (gemeinde / city / bundesland):
  // ?plz + ?ort scope the list to one place via the compound place filter;
  // the user can widen it via the FilterDrawer to browse all events.
  const plz = search.get('plz');
  if (plz) out.placePostalCode = plz;
  const ort = search.get('ort');
  if (ort) out.placeName = ort;
  return Object.keys(out).length > 0 ? out : undefined;
}

function EntdeckenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<V4EntdeckenMode>(resolveMode(search.get('mode')));
  const initialQuery = search.get('q') ?? '';
  const initialBlParam = search.get('bl');
  // Comma-separated bl supported so a bundesland hub can deep-link a single
  // region and a future multi-region link still works.
  const initialBundeslandIds = initialBlParam
    ? initialBlParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const initialFilters = deriveInitialFilters(search);

  // Mirror mode back into URL — list-Modus default unparametrisiert
  // damit /entdecken eine saubere URL hat. Smart-Modus persistiert
  // ?mode=smart und optional ?q=<query>.
  //
  // CRITICAL: must START from the current URL (search.toString()) and
  // only TOGGLE mode/q. Earlier this effect built `next` from scratch,
  // which on mount stripped search/district/category/bl from the URL
  // every time — invisible bug as long as filters were only seeded on
  // mount, but it kills any URL→state sync we layer on top.
  useEffect(() => {
    const next = new URLSearchParams(search.toString());
    if (mode === 'smart') {
      next.set('mode', 'smart');
      if (initialQuery) next.set('q', initialQuery);
      else next.delete('q');
    } else {
      next.delete('mode');
      next.delete('q');
    }
    const qs = next.toString();
    // No-op guard — avoids a router.replace when nothing actually
    // changed (which would be a useless re-render on every mount).
    if (qs === search.toString()) return;
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onModeChange = useCallback((next: V4EntdeckenMode) => { setMode(next); }, []);

  // V4EntdeckenListMode seeds its filter state from initialFilters via
  // useState — only on mount. Subsequent URL changes (e.g. the user
  // submits a new search from the top-nav while already on /entdecken)
  // would otherwise leave the result list pinned to the previous query.
  // Keying the component on the URL-driven inputs forces React to remount
  // it whenever any of them changes, which re-runs the useState initialiser
  // with fresh values and re-triggers the fetch effect downstream.
  const listModeKey = [
    initialBlParam ?? '',
    initialFilters?.search ?? '',
    initialFilters?.district ?? '',
    initialFilters?.category ?? '',
    initialFilters?.placeName ?? '',
    initialFilters?.placePostalCode ?? '',
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

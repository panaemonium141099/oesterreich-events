'use client';

/**
 * /entdecken — Discovery page (Liste + FilterDrawer).
 *
 * Wraps the existing EventListView + FilterDrawer aus /map (Verhalten 1:1
 * identisch via useFilteredEvents). Der frühere Smart-Tab (NLP semantic
 * search) wurde 2026-07 mit dem KI-Ausstieg entfernt (MASTERPLAN §6/§10);
 * alte ?mode=smart-Links landen hier in der Liste, ?q= wird als
 * Suchbegriff übernommen.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  V4EntdeckenHero,
  V4EntdeckenListMode,
} from '@/components/Discover/v4';
import type { EventFilters } from '@/types/events';

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
  // Tourism region (section 02b) → soft search-narrower within the bundesland.
  // True region→district filtering is a follow-up; this at least scopes results.
  const region = search.get('region');
  if (region && !out.search) out.search = region;
  // Legacy Smart-Mode deep-link (?mode=smart&q=…) → q wird zur Textsuche.
  const q = search.get('q');
  if (q && !out.search) out.search = q;
  return Object.keys(out).length > 0 ? out : undefined;
}

function EntdeckenInner() {
  const search = useSearchParams();

  const initialBlParam = search.get('bl');
  // Comma-separated bl supported so a bundesland hub can deep-link a single
  // region and a future multi-region link still works.
  const initialBundeslandIds = initialBlParam
    ? initialBlParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const initialFilters = deriveInitialFilters(search);

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
      <V4EntdeckenHero/>
      <V4EntdeckenListMode
        key={listModeKey}
        initialBundeslandIds={initialBundeslandIds}
        initialFilters={initialFilters}
      />
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

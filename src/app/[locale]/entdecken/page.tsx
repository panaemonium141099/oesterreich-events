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

import { useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  V4EntdeckenHero,
  V4EntdeckenListMode,
  V4EntdeckenSmartMode,
} from '@/components/Discover/v4';
import { type V4EntdeckenMode } from '@/components/Events/v4';
import type { EventFilters } from '@/types/events';
import { seasonById, seasonEndDate } from '@/lib/landing/seasons';
import { resolveCategoryParam } from '@/lib/category-classifier/taxonomy';

function resolveMode(raw: string | null): V4EntdeckenMode {
  if (raw === 'smart') return 'smart';
  // 'filter' (Phase 4 legacy) und alles andere → 'list'.
  return 'list';
}

function deriveInitialFilters(
  search: URLSearchParams,
  seasonLabel: (id: string) => string,
): Partial<EventFilters> | undefined {
  // Pick up the common URL filter params if present. This is best-effort:
  // most users will land on /entdecken with no params. Deep-links from
  // landing-page links (e.g. /entdecken?district=eisenstadt) work too.
  const out: Partial<EventFilters> = {};
  const district = search.get('district');
  if (district) out.district = district;
  const search_ = search.get('search');
  if (search_) out.search = search_;
  // Gleiche Abbildung wie die API: die Liste filtert client-seitig auf
  // e.category, ein Altname wie 'music' ließe sonst alles herausfallen.
  const category = search.get('category');
  if (category) out.category = resolveCategoryParam(category) ?? category;
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
  // Saison-Link der Landing (?saison=herbst): alle Stichwörter der Saison
  // statt eines einzelnen Suchworts, begrenzt auf das Saisonende.
  const season = seasonById(search.get('saison'));
  if (season) {
    out.tags = season.tags;
    out.dateTo = seasonEndDate(season);
    out.topicLabel = seasonLabel(season.id);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function EntdeckenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Der Modus kommt aus der URL, nicht aus lokalem State (2026-10-11).
  // Vorher wurde ?mode nur beim Mount gelesen: eine Suche aus der Top-Nav
  // schob ?search=… in die URL, der Smart-Tab blieb aber mit der alten
  // Unterhaltung stehen — die neue Eingabe kam nie an.
  const mode = resolveMode(search.get('mode'));
  const initialQuery = search.get('q') ?? '';
  const initialBlParam = search.get('bl');
  // Comma-separated bl supported so a bundesland hub can deep-link a single
  // region and a future multi-region link still works.
  const initialBundeslandIds = initialBlParam
    ? initialBlParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const tSeason = useTranslations('Landing.Season');
  const initialFilters = deriveInitialFilters(search, (id) => tSeason(`${id}.title`));

  // Tab-Wechsel schreibt in die URL — list-Modus unparametrisiert, damit
  // /entdecken eine saubere URL hat; Smart-Modus persistiert ?mode=smart.
  //
  // CRITICAL: must START from the current URL (search.toString()) and
  // only TOGGLE mode/q. Earlier this built `next` from scratch, which
  // stripped search/district/category/bl from the URL every time.
  const onModeChange = useCallback((nextMode: V4EntdeckenMode) => {
    const next = new URLSearchParams(search.toString());
    if (nextMode === 'smart') {
      next.set('mode', 'smart');
    } else {
      next.delete('mode');
      next.delete('q');
    }
    const qs = next.toString();
    if (qs === search.toString()) return;
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
  }, [search, router, pathname]);

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
    initialFilters?.tags?.join(',') ?? '',
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

'use client';

/**
 * V4EntdeckenListMode — Default-Tab auf /entdecken (Phase 4.1).
 *
 * Verwendet die EXAKT gleichen Komponenten wie /map heute:
 *   - useFilteredEvents() — Daten + Filter-State (Phase-4.1 extract aus map/page.tsx)
 *   - <EventListView/>    — Liste mit Sort + Infinite-Scroll
 *   - <FilterDrawer/>     — Wann / Region / Kategorie / Mit wem / Preis
 *
 * Filter-Verhalten ist 1:1 identisch zum heutigen /map?view=list.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EventListView } from '@/components/MapV3/EventListView';
import { FilterDrawer } from '@/components/MapV3/FilterDrawer';
import { V4RegionRail } from '@/components/Discover/v4/V4RegionRail';
import { useFilteredEvents } from '@/lib/v4/use-filtered-events';
import { useBoostedIds } from '@/lib/hooks/useBoostedIds';
import type { EventFilters } from '@/types/events';

interface V4EntdeckenListModeProps {
  /** Optional starting bundesland id ('burgenland', 'wien', etc.) from URL */
  initialBundeslandIds?: string[];
  /** Optional starting filter set from URL (district, search, etc.) */
  initialFilters?: Partial<EventFilters>;
}

export function V4EntdeckenListMode({
  initialBundeslandIds,
  initialFilters,
}: V4EntdeckenListModeProps) {
  const t = useTranslations('Discover');
  const {
    filters, setFilters,
    bundeslandIds, setBundeslandIds,
    finalEvents, loading,
    totalMatchCount, categoryCounts, scopeLabel,
    loadMore, hasMoreBatches, loadingMore,
  } = useFilteredEvents(initialBundeslandIds, initialFilters, {
    // fn-16 Option A (User-Go 2026-07-16): die Liste läuft wie die Karte
    // über den Points-Snapshot — exakter Zähler, global korrekte
    // Sortierung, Filter ohne Netzwerk. Anzeige-Details hydratisiert
    // EventListView fürs sichtbare Fenster (useDetailHydration).
    mapPoints: true,
    // Fallback-Pfad für Volltext/Tags (nicht snapshot-fähig): Batches
    // lazy statt Hintergrund-Vollschleife.
    lazyBatches: true,
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const boostedIds = useBoostedIds();

  // Ein Batch Vorsprung: der erste Cursor-Batch (10-13 s Micro-DB, nie im
  // Edge-Cache) startet direkt nach dem Erst-Paint im Hintergrund, damit
  // der User beim Durchscrollen der ersten 3000 nicht sichtbar wartet.
  // Bewusst NUR einer (Ref-Guard) — mehr wäre wieder die alte Vollschleife.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (hasMoreBatches && !prefetchedRef.current) {
      prefetchedRef.current = true;
      loadMore();
    }
  }, [hasMoreBatches, loadMore]);

  // Daten nachladen erst am ECHTEN Listenende (rootMargin 0): EventListView
  // expandiert ihr internes Render-Fenster selbst gierig bis Viewport+200px
  // — mit Vorlauf würde dieser Sentinel dauerfeuern und de facto wieder
  // alle Batches durchladen. So schiebt die interne Expansion den Sentinel
  // beim Scrollen vor sich her; er feuert nur, wenn die GELADENEN Daten
  // wirklich durchgescrollt sind.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMoreBatches) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreBatches, loadMore]);

  // FilterDrawer.resultCount is typed `number` (not nullable).
  // totalMatchCount is null when a client narrower is active — fall back
  // to the length of the post-filter list so the CTA always has a value.
  const resultCount = totalMatchCount ?? finalEvents.length;

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
      {/* Region rail → entry into the city/bundesland SEO hubs (hybrid loop). */}
      <V4RegionRail />

      {/* Toolbar: Filter-Button rechts; Count + Sort sitzt in EventListView. */}
      <div className="flex items-center justify-end gap-3 mb-4">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="press-haptic inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="7" y1="12" x2="17" y2="12"/>
            <line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          {t('filter')}
        </button>
      </div>

      {/* Liste — same component as /map */}
      <EventListView
        events={finalEvents}
        loading={loading}
        totalCount={totalMatchCount}
        scopeLabel={scopeLabel}
        boostedIds={boostedIds}
      />

      {/* Lazy-Batches-Sentinel (fn-16): triggert loadMore am Listenende. */}
      {hasMoreBatches && (
        <div ref={sentinelRef} className="py-8 flex justify-center">
          {loadingMore ? (
            <span className="inline-flex items-center gap-2 text-[13px] text-[var(--v4-ink-50)]">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--v4-hairline-3)] border-t-[var(--v4-ink)]" />
              {t('loadingMore')}
            </span>
          ) : (
            <span className="text-[13px] text-[var(--v4-ink-50)]">{t('scrollForMore')}</span>
          )}
        </div>
      )}

      {/* Filter-Drawer — same component as /map */}
      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        bundeslandIds={bundeslandIds}
        onBundeslandIdsChange={setBundeslandIds}
        resultCount={resultCount}
        categoryCounts={categoryCounts}
      />

    </div>
  );
}

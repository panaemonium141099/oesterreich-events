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

import { useState } from 'react';
import { EventListView } from '@/components/MapV3/EventListView';
import { FilterDrawer } from '@/components/MapV3/FilterDrawer';
import { EventDetail } from '@/components/Events/EventDetail';
import { V4RegionRail } from '@/components/Discover/v4/V4RegionRail';
import { useFilteredEvents } from '@/lib/v4/use-filtered-events';
import type { Event, EventFilters } from '@/types/events';

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
  const {
    filters, setFilters,
    bundeslandIds, setBundeslandIds,
    finalEvents, loading,
    totalMatchCount, categoryCounts, scopeLabel,
  } = useFilteredEvents(initialBundeslandIds, initialFilters);

  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

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
          Filter
        </button>
      </div>

      {/* Liste — same component as /map */}
      <EventListView
        events={finalEvents}
        loading={loading}
        totalCount={totalMatchCount}
        scopeLabel={scopeLabel}
      />

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

      {/* Event-Detail Modal */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          eveningMode={false}
          onTagClick={(tag) => {
            setFilters((prev) => ({ ...prev, tags: [tag], category: undefined }));
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

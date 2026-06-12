'use client';

/**
 * /map — Variante A · Airbnb-clean.
 *
 * One body, two views. The new structure:
 *   <MapTopBar>            single row: logo · search · filter-button · bell · avatar
 *   <ViewToggle>           floating: top-center (desktop) / bottom-center (mobile)
 *   <EventMap>  OR  <EventListView>     mutually exclusive, never both
 *   <FilterDrawer>         centralized chip-based filters (Wann / Region / Kategorie / Mit wem / Preis)
 *
 * Why this is a substantial change:
 *   - The old page rendered Map + Sidebar simultaneously. The mockup
 *     (variante A) is "komplett separat" — toggle picks one or the other.
 *   - Inline FilterBar with 8 controls is replaced by a single Filter button
 *     opening a drawer.
 *   - URL state: ?view=map|list persists the user's choice across reloads.
 *
 * Filter bugs the user confirmed are fixed in this refactor:
 *   1. Heute-preset and DateRange use the same applyDatePreset path — no
 *      more silent overwrites between the two controls.
 *   2. Reset wipes ALL filters (including tags + bundesland + enrichment).
 *   3. Category and tags are mutually exclusive in the FilterDrawer.
 *
 * Phase 4.1 — Data-pipeline lebt jetzt in useFilteredEvents (auch von
 * /entdecken konsumiert). Map-spezifischer State (selectedEvent,
 * userLocation, flyto, view, filterOpen, mapChips, hoveredEventId)
 * bleibt page-lokal.
 */
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Event, EventFilters } from '@/types/events';
import { MapTopBar } from '@/components/MapV3/MapTopBar';
import { FilterDrawer } from '@/components/MapV3/FilterDrawer';
import { T } from '@/components/MapV3/tokens';
import { EventDetail } from '@/components/Events/EventDetail';
import { MapLoadingOverlay } from '@/components/Map/MapLoadingOverlay';
import { LocationBanner } from '@/components/Map/LocationBanner';
import { BUNDESLAENDER, type Bundesland } from '@/lib/bundeslaender';
import { useAuth } from '@/lib/supabase/auth-context';
import { getStoredLocation, storeLocation } from '@/lib/geolocation';
import { useSavedEvents } from '@/lib/saved-events-context';
import { V4MarkerLegend } from '@/components/Map/v4';
import { useFilteredEvents } from '@/lib/v4/use-filtered-events';
import { useBoostedIds } from '@/lib/hooks/useBoostedIds';

const EventMap = dynamic(() => import('@/components/Map/EventMap'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: T.panel }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-neutral-300 border-t-neutral-900 mx-auto mb-3" />
        <p style={{ color: T.ink60, fontSize: 13, fontWeight: 500 }}>Karte wird geladen…</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center" style={{ background: T.panel }}>
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-neutral-300 border-t-neutral-900" />
        </div>
      }
    >
      {/* SR-only H1 — keeps the SEO check green; visible H1 lives in
          EventListView when list-view is active. */}
      <h1 className="sr-only">
        Event-Karte Österreich — Konzerte, Festivals, Märkte und Veranstaltungen auf Karte
      </h1>
      <MapPageInner />
    </Suspense>
  );
}

function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, profileComplete } = useAuth();
  const { refresh: refreshSaved } = useSavedEvents();

  // Hydrate state from URL on mount
  const initialSearch = searchParams.get('search') || '';
  // Multi takes precedence over single, mirrors the API contract.
  // Without this, "?bundeslands=wien" silently fell back to the default
  // 'all' because the init reader only knew the legacy singular param,
  // so the map rendered every Austria event instead of just Wien.
  const initialBundeslandsParam = searchParams.get('bundeslands');
  const initialBundeslandIds = initialBundeslandsParam
    ? initialBundeslandsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : (() => {
        const single = searchParams.get('bundesland');
        return single && single !== 'all' ? [single] : ['all'];
      })();
  const initialBundeslandId = initialBundeslandIds[0] ?? 'all';
  const initialCategory = searchParams.get('category') || '';
  const initialCategoriesParam = searchParams.get('categories');
  const initialCategories = initialCategoriesParam
    ? initialCategoriesParam.split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  const initialDistrictsParam = searchParams.get('districts');
  const initialDistricts = initialDistrictsParam
    ? initialDistrictsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  const initialSortParam = searchParams.get('sort');
  const initialSort: 'date' | 'score' | 'relevance' | undefined =
    initialSortParam === 'score' || initialSortParam === 'relevance' || initialSortParam === 'date'
      ? initialSortParam
      : undefined;
  const initialLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const initialLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
  const initialZoom = searchParams.get('zoom') ? parseFloat(searchParams.get('zoom')!) : null;

  const hasUrlContext =
    !initialBundeslandIds.includes('all') ||
    initialCategory !== '' ||
    !!initialCategories ||
    !!initialDistricts ||
    initialSearch !== '' ||
    (initialLat !== null && initialLng !== null);

  // initialBundeslandId used only for flyTo fallback below (unused variable suppressed by usage)
  void initialBundeslandId;
  const flyToCoords =
    initialLat && initialLng ? { lat: initialLat, lng: initialLng, zoom: initialZoom || 13 } : null;

  // Redirect to complete-profile if logged in but profile incomplete
  useEffect(() => {
    if (!authLoading && user && profile && !profileComplete) {
      router.replace('/auth/complete-profile');
    }
  }, [authLoading, user, profile, profileComplete, router]);

  // ── Page-local state ───────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dynamicFlyTo, setDynamicFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  // ── Phase 4.1: Data-pipeline lebt jetzt in einem geteilten Hook (auch
  // von /entdecken konsumiert). Map-spezifischer State (selectedEvent,
  // userLocation, flyto, hoveredEventId, view, mapChips, filterOpen)
  // bleibt in der Page.
  const initialFilters: Partial<EventFilters> = {
    ...(initialSearch ? { search: initialSearch } : {}),
    ...(initialCategory ? { category: initialCategory } : {}),
    ...(initialCategories ? { categories: initialCategories } : {}),
    ...(initialDistricts ? { districts: initialDistricts } : {}),
    ...(initialSort ? { sort: initialSort } : {}),
  };

  const {
    filters, setFilters,
    bundeslandIds, setBundeslandIds,
    finalEvents, allEvents, loading, backgroundLoading,
    apiTotalCount: _apiTotalCount, totalMatchCount, categoryCounts, scopeLabel,
    bundesland,
  } = useFilteredEvents(initialBundeslandIds, initialFilters);

  // Paid-boosted events → rendered unclustered + highlighted on the map.
  // Aus dem frischen /api/events/boosted (siehe useBoostedIds), NICHT aus dem
  // 2 h edge-gecachten /api/events-Payload — so verschwindet ein beendeter
  // Boost quasi sofort von der Karte.
  const boostedIds = useBoostedIds();

  // Old single-state shim so child components that still take a `Bundesland`
  // prop keep working unchanged.
  const setBundesland = useCallback((bl: Bundesland) => {
    setBundeslandIds(bl.id === 'all' ? ['all'] : [bl.id]);
  }, [setBundeslandIds]);

  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) setUserLocation(stored);
  }, []);

  // page_view wird jetzt global vom PageviewTracker (Root-Layout) erfasst.

  // Phase 4.1: legacy /map?view=list redirects to /entdecken?mode=list.
  // The EventListView lives on /entdecken now.
  useEffect(() => {
    if (searchParams.get('view') === 'list') {
      router.replace('/entdecken?mode=list');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGemeindeSelect = (g: { name: string; bundeslandId: string; lat: number; lng: number; postalCode?: string }) => {
    const bl = BUNDESLAENDER.find((b) => b.id === g.bundeslandId);
    if (bl) setBundesland(bl);

    // Wien stays a special case: city = Bundesland 1:1, so bundesland=wien
    // alone gives every Wien event (2351). No bbox/place filter needed.
    const isWien = g.bundeslandId === 'wien';

    let bbox: [number, number, number, number] | undefined;
    if (!isWien) {
      // Geo-bbox is the most reliable scope signal — every event has lat/lng,
      // while location_name/postal_code/district are inconsistent (events
      // tagged with district="Graz-Umgebung" but location="ppc" still belong
      // to Graz). Radius matches what the user sees on the map clusters.
      const CAPITALS = /^(graz|linz|salzburg|innsbruck|klagenfurt|bregenz|eisenstadt|st\.?\s*p[oö]lten)$/i;
      const radiusKm = CAPITALS.test(g.name) ? 12 : 6;
      const dLat = radiusKm / 111;
      const dLng = radiusKm / (111 * Math.cos((g.lat * Math.PI) / 180));
      bbox = [g.lat - dLat, g.lng - dLng, g.lat + dLat, g.lng + dLng];
    }

    setFilters((prev) => ({
      ...prev,
      district: undefined,
      search: undefined,
      bbox,
      placeName: undefined,        // pure geo for non-Wien gemeinden
      placePostalCode: undefined,
    }));

    setTimeout(() => setDynamicFlyTo({ lat: g.lat, lng: g.lng, zoom: 13 }), 300);
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: T.bg }}>
      <MapTopBar
        filters={filters}
        onFiltersChange={setFilters}
        bundesland={bundesland}
        onOpenFilter={() => setFilterOpen(true)}
        onGemeindeSelect={handleGemeindeSelect}
        onBundeslandFilter={(id) => {
          // Replace the active bundesland selection — same UX as picking
          // the chip in the FilterDrawer. Clear district + search + bbox
          // so a stale narrow scope doesn't shadow the new bundesland.
          // Single setFilters so MapTopBar doesn't have to do a second
          // call (and reintroduce stale state via the spread).
          setBundeslandIds([id]);
          setFilters((prev) => ({
            ...prev,
            district: undefined,
            districts: undefined,
            search: undefined,
            bbox: undefined,
          }));
          setDynamicFlyTo(null);
        }}
        onDistrictFilter={(blId, district) => {
          // Same as above — replace bundesland + districts, clear search/bbox.
          setBundeslandIds([blId]);
          setFilters((prev) => ({
            ...prev,
            districts: [district],
            district: undefined,
            search: undefined,
            bbox: undefined,
          }));
          setDynamicFlyTo(null);
        }}
        onKeywordSearch={(q) => {
          // Reset the active scope so the keyword runs against all of
          // Austria, then apply the search. Without the reset a leftover
          // Wien-scope from a previous query would silently narrow the
          // new keyword (e.g. "kirtag" → only Wien kirtage).
          setBundeslandIds(['all']);
          setFilters((prev) => ({
            ...prev,
            search: q,
            districts: undefined,
            district: undefined,
            categories: undefined,
            category: undefined,
            bbox: undefined,
            placeName: undefined,
            placePostalCode: undefined,
          }));
          setDynamicFlyTo(null);
        }}
      />

      <div className="flex-1 relative min-h-0">
        {/* MAP view — always rendered; EventListView lives on /entdecken (Phase 4.1) */}
        <div className="absolute inset-0 mv3-fade-in">
              <EventMap
                events={finalEvents}
                selectedEvent={selectedEvent}
                hoveredEventId={hoveredEventId}
                onSelectEvent={setSelectedEvent}
                eveningMode={false}
                flyToCoords={dynamicFlyTo || flyToCoords}
                bundesland={bundesland}
                artistEventIds={new Set<string>()}
                boostedEventIds={boostedIds}
              />
              <MapLoadingOverlay loading={loading} eventCount={allEvents.length} />

              {backgroundLoading && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 14px',
                    borderRadius: 9999,
                    background: '#fff',
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: T.ink,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    zIndex: 20,
                  }}
                  className="md:!bottom-[22px]"
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: T.todayDot,
                      boxShadow: '0 0 6px rgba(12,122,71,0.6)',
                    }}
                  />
                  Lade Events… {allEvents.length.toLocaleString('de-AT')}
                </div>
              )}

              {!loading && !backgroundLoading && finalEvents.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 14px',
                    borderRadius: 9999,
                    background: '#fff',
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: T.ink,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    zIndex: 20,
                  }}
                  className="md:!bottom-[22px]"
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: T.todayDot,
                      boxShadow: '0 0 6px rgba(12,122,71,0.6)',
                    }}
                  />
                  {(totalMatchCount ?? finalEvents.length).toLocaleString('de-AT')} Events
                  {scopeLabel ? ` · ${scopeLabel}` : ''}
                </div>
              )}

              <LocationBanner
                onLocationFound={(lat, lng) => {
                  setUserLocation({ lat, lng });
                  storeLocation(lat, lng);
                  setDynamicFlyTo({ lat, lng, zoom: 12 });
                }}
                eveningMode={false}
                suppressAutoFly={hasUrlContext}
              />
              <V4MarkerLegend/>
        </div>

        {/* Event detail modal */}
        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            onClose={() => {
              setSelectedEvent(null);
              refreshSaved();
            }}
            eveningMode={false}
            onTagClick={(tag) => {
              setFilters((prev) => ({ ...prev, tags: [tag], category: undefined }));
              setSelectedEvent(null);
            }}
          />
        )}

        {/* Filter drawer */}
        <FilterDrawer
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          filters={filters}
          onFiltersChange={(f) => {
            setFilters(f);
          }}
          bundeslandIds={bundeslandIds}
          onBundeslandIdsChange={(ids) => {
            setBundeslandIds(ids);
            // Switching the bundesland set invalidates any district pick —
            // a "Graz (Stadt)" chip while jumping to "Wien only" would just
            // produce zero hits.
            setFilters((prev) => (prev.district || prev.districts
              ? { ...prev, district: undefined, districts: undefined }
              : prev));
            setDynamicFlyTo(null);
          }}
          resultCount={finalEvents.length}
          categoryCounts={categoryCounts}
        />
      </div>

    </div>
  );
}

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
 */
import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Event, EventFilters } from '@/types/events';
import { MapTopBar } from '@/components/MapV3/MapTopBar';
import { ViewToggle, type MapViewMode } from '@/components/MapV3/ViewToggle';
import { FilterDrawer } from '@/components/MapV3/FilterDrawer';
import { EventListView } from '@/components/MapV3/EventListView';
import { defaultDateTo } from '@/components/MapV3/datePresets';
import { T } from '@/components/MapV3/tokens';
import { EventDetail } from '@/components/Events/EventDetail';
import { MapLoadingOverlay } from '@/components/Map/MapLoadingOverlay';
import { LocationBanner } from '@/components/Map/LocationBanner';
import { BUNDESLAENDER, type Bundesland } from '@/lib/bundeslaender';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/lib/supabase/auth-context';
import { getStoredLocation, storeLocation } from '@/lib/geolocation';
import { useSavedEvents } from '@/lib/saved-events-context';

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
  const initialView: MapViewMode = (searchParams.get('view') as MapViewMode) === 'list' ? 'list' : 'map';
  const initialSearch = searchParams.get('search') || '';
  const initialBundeslandId = searchParams.get('bundesland') || 'all';
  const initialCategory = searchParams.get('category') || '';
  const initialLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const initialLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
  const initialZoom = searchParams.get('zoom') ? parseFloat(searchParams.get('zoom')!) : null;

  const hasUrlContext =
    initialBundeslandId !== 'all' ||
    initialCategory !== '' ||
    initialSearch !== '' ||
    (initialLat !== null && initialLng !== null);

  const initialBundesland = BUNDESLAENDER.find((b) => b.id === initialBundeslandId) || BUNDESLAENDER[0];
  const flyToCoords =
    initialLat && initialLng ? { lat: initialLat, lng: initialLng, zoom: initialZoom || 13 } : null;

  // Redirect to complete-profile if logged in but profile incomplete
  useEffect(() => {
    if (!authLoading && user && profile && !profileComplete) {
      router.replace('/auth/complete-profile');
    }
  }, [authLoading, user, profile, profileComplete, router]);

  // ── State ─────────────────────────────────────────────────────────────
  const [view, setView] = useState<MapViewMode>(initialView);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [bundesland, setBundesland] = useState<Bundesland>(initialBundesland);
  const [filters, setFilters] = useState<EventFilters>({
    dateTo: defaultDateTo(),
    ...(initialSearch ? { search: initialSearch } : {}),
    ...(initialCategory ? { category: initialCategory } : {}),
  });

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [apiTotalCount, setApiTotalCount] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [dynamicFlyTo, setDynamicFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) setUserLocation(stored);
  }, []);

  useEffect(() => {
    trackEvent('page_view', { path: '/map', view });
  }, [view]);

  // Persist `?view=` to URL on toggle so reloads / back-button restore it
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (view === 'list') params.set('view', 'list');
    else params.delete('view');
    const next = `/map${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(next, { scroll: false });
  // searchParams excluded — we read it once on mount; further URL changes
  // shouldn't re-run this effect or we'd thrash the history stack.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ── Data fetch (progressive batches, same shape as the old page) ─────
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('bundesland', 'all'); // client-side BL filter; comment in old code applied here
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    else if (filters.category) params.set('category', filters.category);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.search) params.set('search', filters.search);
    if (filters.eveningOnly) params.set('eveningOnly', 'true');
    if (filters.sourceName) params.set('sourceName', filters.sourceName);
    if (filters.studentFriendly) params.set('studentFriendly', 'true');
    if (filters.familyFriendly) params.set('familyFriendly', 'true');
    if (filters.priceTier) params.set('priceTier', filters.priceTier);
    return params;
  }, [filters]);

  const fetchEventsProgressive = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setAllEvents([]);
    setApiTotalCount(null);

    const BATCH_SIZE = 10000;

    try {
      const firstParams = buildParams();
      firstParams.set('limit', String(BATCH_SIZE));
      const firstRes = await fetch(`/api/events?${firstParams.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstData = await firstRes.json();
      const firstEvents: Event[] = firstData.events || [];

      setAllEvents(firstEvents);
      if (typeof firstData.total === 'number') setApiTotalCount(firstData.total);
      setLoading(false);

      if (!firstData.hasMore && firstEvents.length < BATCH_SIZE) return;

      setBackgroundLoading(true);

      const seen = new Set(firstEvents.map((e) => e.id));
      let acc = [...firstEvents];
      let cursor: string | null = firstData.nextCursor || null;

      while (cursor) {
        if (controller.signal.aborted) break;

        const params = buildParams();
        params.set('limit', String(BATCH_SIZE));
        params.set('cursor', cursor);

        const res = await fetch(`/api/events?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const batch: Event[] = data.events || [];
        if (batch.length === 0) break;

        const unique = batch.filter((e) => !seen.has(e.id));
        for (const e of unique) seen.add(e.id);
        acc = [...acc, ...unique];
        setAllEvents(acc);

        cursor = data.nextCursor || null;
        if (batch.length < BATCH_SIZE) break;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        if (process.env.NODE_ENV === 'development') console.error('Fehler beim Laden der Events:', err);
      }
    } finally {
      setLoading(false);
      setBackgroundLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchEventsProgressive();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchEventsProgressive]);

  // ── Client-side filtering pipeline ───────────────────────────────────
  const bundeslandEvents = useMemo(() => {
    if (bundesland.id === 'all') return allEvents;
    const target = bundesland.id.toLowerCase();
    return allEvents.filter((e) => {
      const bl = (e.bundesland || '').toLowerCase();
      return bl === target || bl.includes(target) || target.includes(bl);
    });
  }, [allEvents, bundesland]);

  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>();
    return bundeslandEvents.filter((e) => {
      const key = `${(e.title || '').trim().toLowerCase()}::${(e.start_date || '').split('T')[0]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bundeslandEvents]);

  const finalEvents = useMemo(() => {
    return filters.district ? dedupedEvents.filter((e) => e.district === filters.district) : dedupedEvents;
  }, [dedupedEvents, filters.district]);

  // Category counts for the FilterDrawer — fed off the post-deduplication,
  // pre-category-filter set so each chip shows its own contribution.
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of dedupedEvents) {
      const c = e.category;
      if (c) m[c] = (m[c] || 0) + 1;
    }
    return m;
  }, [dedupedEvents]);

  const totalMatchCount =
    bundesland.id === 'all' && !filters.district ? apiTotalCount : null;

  const handleGemeindeSelect = (g: { name: string; bundeslandId: string; lat: number; lng: number }) => {
    const bl = BUNDESLAENDER.find((b) => b.id === g.bundeslandId);
    if (bl) {
      setBundesland(bl);
      setFilters((prev) => ({ ...prev, district: undefined, search: g.name }));
    }
    if (view === 'map') {
      setTimeout(() => setDynamicFlyTo({ lat: g.lat, lng: g.lng, zoom: 13 }), 300);
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: T.bg }}>
      <MapTopBar
        filters={filters}
        onFiltersChange={setFilters}
        bundesland={bundesland}
        onOpenFilter={() => setFilterOpen(true)}
        onGemeindeSelect={handleGemeindeSelect}
      />

      <div className="flex-1 relative min-h-0">
        {/* Floating ViewToggle — top-center on desktop, bottom-center on mobile */}
        <div
          className="hidden md:block"
          style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}
        >
          <ViewToggle view={view} onViewChange={setView} />
        </div>
        <div
          className="md:hidden"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
            zIndex: 30,
          }}
        >
          <ViewToggle view={view} onViewChange={setView} size="sm" />
        </div>

        {/* MAP view — plain conditional render. Earlier we used framer-motion's
            AnimatePresence here, but it left the hidden view in DOM with
            opacity:0 (same bug as in FilterDrawer), wasting Mapbox memory. */}
        {view === 'map' && (
          <div className="absolute inset-0 mv3-fade-in">
              <EventMap
                events={bundeslandEvents}
                selectedEvent={selectedEvent}
                hoveredEventId={hoveredEventId}
                onSelectEvent={setSelectedEvent}
                eveningMode={false}
                flyToCoords={dynamicFlyTo || flyToCoords}
                bundesland={bundesland}
                artistEventIds={new Set<string>()}
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
                  {bundesland.id !== 'all' ? ` · ${bundesland.name}` : ' · Österreich'}
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
          </div>
        )}

        {view === 'list' && (
          <div className="absolute inset-0 mv3-fade-in">
            <EventListView
              events={finalEvents}
              loading={loading}
              onSelectEvent={setSelectedEvent}
              userLocation={userLocation}
              totalCount={totalMatchCount}
              scopeLabel={
                bundesland.id !== 'all' ? bundesland.name : filters.search ? filters.search : 'Österreich'
              }
            />
          </div>
        )}

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
          bundesland={bundesland}
          onBundeslandChange={(bl) => {
            setBundesland(bl);
            // Switching BL invalidates any district selection — match the old
            // page's behavior so the user doesn't get a "no events" mystery
            // when bezirk and bundesland disagree.
            setFilters((prev) => (prev.district ? { ...prev, district: undefined } : prev));
            setDynamicFlyTo(null);
          }}
          resultCount={finalEvents.length}
          categoryCounts={categoryCounts}
        />
      </div>

    </div>
  );
}

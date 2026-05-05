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
import { readCache, writeCache } from '@/components/MapV3/eventsCache';
import { EventDetail } from '@/components/Events/EventDetail';
import { MapLoadingOverlay } from '@/components/Map/MapLoadingOverlay';
import { LocationBanner } from '@/components/Map/LocationBanner';
import { BUNDESLAENDER, bundeslandToId, type Bundesland } from '@/lib/bundeslaender';
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
  // Multi-bundesland selection. Source of truth — `primaryBundesland` is
  // the derived single value used for map bbox / flyTo / scope label.
  // ['all'] = no filter; ['wien','steiermark'] = both; etc.
  const [bundeslandIds, setBundeslandIds] = useState<string[]>(initialBundeslandIds);
  const primaryBundesland = useMemo(
    () => BUNDESLAENDER.find((b) => b.id === bundeslandIds[0]) ?? BUNDESLAENDER[0],
    [bundeslandIds],
  );
  // Old single-state shim so the rest of the file (and child components
  // that still take a `Bundesland` prop) keep working unchanged.
  const bundesland = primaryBundesland;
  const setBundesland = useCallback((bl: Bundesland) => {
    setBundeslandIds(bl.id === 'all' ? ['all'] : [bl.id]);
  }, []);
  // No default dateTo — load EVERYTHING. The progressive batch loader
  // pages through cursor-based pagination so a few extra months of
  // events won't slow the first paint, and users were missing winter
  // events that fell outside the old 6-month horizon.
  const [filters, setFilters] = useState<EventFilters>({
    ...(initialSearch ? { search: initialSearch } : {}),
    ...(initialCategory ? { category: initialCategory } : {}),
    ...(initialCategories ? { categories: initialCategories } : {}),
    ...(initialDistricts ? { districts: initialDistricts } : {}),
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
    // Multi-bundesland: send `bundeslands` (comma-separated) when the user
    // picked >1 region; otherwise the single `bundesland` param so the
    // server can short-circuit and use its idx_events_bundesland_start_date
    // single-eq path.
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    if (concrete.length > 1) params.set('bundeslands', concrete.join(','));
    else params.set('bundesland', concrete[0] ?? 'all');
    // Slim payload — list + markers only need ~17 fields.
    params.set('slim', 'true');
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    else if (filters.categories && filters.categories.length > 0) params.set('categories', filters.categories.join(','));
    else if (filters.category) params.set('category', filters.category);
    if (filters.districts && filters.districts.length > 0) params.set('districts', filters.districts.join(','));
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.search) params.set('search', filters.search);
    if (filters.bbox) params.set('bbox', filters.bbox.join(','));
    if (filters.placeName) params.set('placeName', filters.placeName);
    if (filters.placePostalCode) params.set('placePostalCode', filters.placePostalCode);
    if (filters.eveningOnly) params.set('eveningOnly', 'true');
    if (filters.sourceName) params.set('sourceName', filters.sourceName);
    if (filters.studentFriendly) params.set('studentFriendly', 'true');
    if (filters.familyFriendly) params.set('familyFriendly', 'true');
    if (filters.priceTiers && filters.priceTiers.length > 0) params.set('priceTiers', filters.priceTiers.join(','));
    else if (filters.priceTier) params.set('priceTier', filters.priceTier);
    return params;
  }, [filters, bundeslandIds]);

  const fetchEventsProgressive = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Sync the parent-state bundesland selection into filters for cache+API
    // parity. Single concrete pick → use legacy `bundesland`; multi → use
    // `bundeslands`. Empty / 'all' → no filter (the cache key handles both).
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    const filtersWithBl: EventFilters = {
      ...filters,
      ...(concrete.length === 1 ? { bundesland: concrete[0] } : {}),
      ...(concrete.length > 1 ? { bundeslands: concrete } : {}),
    };
    const cachedRaw = readCache(filtersWithBl);
    const cached = cachedRaw && cachedRaw.events.length > 0 ? cachedRaw : null;

    // Hard reset on cache miss — the previous "stale-while-revalidate"
    // approach left allEvents from the OLD bundesland in state, which
    // when combined with an aborted-mid-flight new fetch could leave
    // the page on "Keine Events gefunden" indefinitely. Clear instead
    // so the skeleton renders cleanly until the new fetch resolves.
    if (cached) {
      setAllEvents(cached.events as unknown as Event[]);
      setApiTotalCount(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
      setAllEvents([]);
      setApiTotalCount(null);
    }

    // Expose state to the console for live debugging when "0 Events"
    // shows up unexpectedly. Type window.__lasstreffenDebug in console.
    if (typeof window !== 'undefined') {
      (window as unknown as { __lasstreffenDebug?: unknown }).__lasstreffenDebug = {
        bundeslandIds,
        primaryBundesland: bundesland.id,
        filters,
        filtersWithBl,
        cacheHit: !!cached,
        controllerId: controller,
      };
    }

    const BATCH_SIZE = 10000;
    let acc: Event[] = [];
    let finalTotal: number | null = null;

    try {
      const firstParams = buildParams();
      firstParams.set('limit', String(BATCH_SIZE));
      const firstRes = await fetch(`/api/events?${firstParams.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      // Generation guard: if the user changed filters during the await,
      // abortRef now points at a NEW controller. This response is stale
      // — bail before touching state so we don't overwrite the new
      // fetch's results with old-bundesland events.
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstData = await firstRes.json();
      if (controller.signal.aborted || abortRef.current !== controller) return;
      const firstEvents: Event[] = firstData.events || [];

      setAllEvents(firstEvents);
      if (typeof firstData.total === 'number') {
        setApiTotalCount(firstData.total);
        finalTotal = firstData.total;
      }
      setLoading(false);

      // Write cache after the very first batch too — that way a quick
      // navigate-away-and-back hits the cache for the first 10k events
      // instead of restarting the 30s+ batch loop. The background loop
      // below will overwrite with the full set when it completes.
      writeCache(filtersWithBl, firstEvents, finalTotal);

      if (!firstData.hasMore && firstEvents.length < BATCH_SIZE) {
        return;
      }

      setBackgroundLoading(true);

      const seen = new Set(firstEvents.map((e) => e.id));
      acc = [...firstEvents];
      let cursor: string | null = firstData.nextCursor || null;

      while (cursor) {
        if (controller.signal.aborted || abortRef.current !== controller) break;

        const params = buildParams();
        params.set('limit', String(BATCH_SIZE));
        params.set('cursor', cursor);

        const res = await fetch(`/api/events?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (controller.signal.aborted || abortRef.current !== controller) break;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (controller.signal.aborted || abortRef.current !== controller) break;

        const batch: Event[] = data.events || [];
        if (batch.length === 0) break;

        const unique = batch.filter((e) => !seen.has(e.id));
        for (const e of unique) seen.add(e.id);
        acc = [...acc, ...unique];
        setAllEvents(acc);

        cursor = data.nextCursor || null;
        if (batch.length < BATCH_SIZE) break;
      }

      // Persist the full freshly-loaded set so the next navigation hits
      // the cache instead of waiting on the network.
      writeCache(filtersWithBl, acc, finalTotal);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        if (process.env.NODE_ENV === 'development') console.error('Fehler beim Laden der Events:', err);
      }
    } finally {
      setLoading(false);
      setBackgroundLoading(false);
    }
  }, [buildParams, filters]);

  useEffect(() => {
    fetchEventsProgressive();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchEventsProgressive]);

  // ── Client-side filtering pipeline ───────────────────────────────────
  const bundeslandEvents = useMemo(() => {
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    if (concrete.length === 0) return allEvents;
    const targets = new Set(concrete);
    return allEvents.filter((e) => {
      const id = bundeslandToId(e.bundesland);
      return id != null && targets.has(id);
    });
  }, [allEvents, bundeslandIds]);

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
    let out = dedupedEvents;
    // Multi-district takes precedence; fall back to legacy single field.
    const districtList = filters.districts && filters.districts.length > 0
      ? filters.districts
      : filters.district ? [filters.district] : null;
    if (districtList) {
      const targets = new Set(districtList.map((d) => d.toLowerCase()));
      out = out.filter((e) => targets.has((e.district ?? '').toLowerCase()));
    }
    // Multi-category client-side filter (server already filtered, but
    // belt-and-suspenders for cache hits where the request shape differs).
    const catList = filters.categories && filters.categories.length > 0
      ? filters.categories
      : filters.category ? [filters.category] : null;
    if (catList) {
      const targets = new Set(catList);
      out = out.filter((e) => e.category != null && targets.has(e.category));
    }
    // Multi-priceTier client-side
    const ptList = filters.priceTiers && filters.priceTiers.length > 0
      ? filters.priceTiers
      : filters.priceTier ? [filters.priceTier] : null;
    if (ptList) {
      const targets = new Set<string>(ptList);
      out = out.filter((e) => {
        // Slim payload (CachedEvent) doesn't include price_tier — keep
        // the row when missing instead of dropping. Server-side filter
        // is the authoritative one for this field.
        const pt = (e as { price_tier?: string }).price_tier;
        return pt == null || targets.has(pt);
      });
    }
    return out;
  }, [dedupedEvents, filters.district, filters.districts, filters.category, filters.categories, filters.priceTier, filters.priceTiers]);

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

  // Trust the API count only when neither client-side narrower (district
  // multi or single, category multi) is active.
  const hasClientNarrower =
    !!filters.district ||
    (filters.districts && filters.districts.length > 0) ||
    (filters.categories && filters.categories.length > 0);
  const totalMatchCount =
    bundeslandIds.includes('all') && !hasClientNarrower ? apiTotalCount : null;

  // Scope label priority — show the most specific dimension the user
  // narrowed by, falling back outward:
  //   1. Free-text search → quote the term ("kirtag")
  //   2. District(s) selection → "Graz (Stadt)" / "2 Bezirke"
  //   3. Bundesland(s) selection → "Wien" / "2 Regionen"
  //   4. default → "Österreich"
  // Without (1) the headline of a kirtag-search read "Niederösterreich"
  // because of a stale scope — confusing.
  const scopeLabel = useMemo(() => {
    if (filters.search && filters.search.trim()) return `„${filters.search.trim()}"`;
    const districtList = filters.districts && filters.districts.length > 0
      ? filters.districts
      : filters.district ? [filters.district] : [];
    if (districtList.length === 1) return districtList[0];
    if (districtList.length > 1) return `${districtList.length} Bezirke`;
    const concrete = bundeslandIds.filter((b) => b !== 'all');
    if (concrete.length === 0) return 'Österreich';
    if (concrete.length === 1) {
      return BUNDESLAENDER.find((b) => b.id === concrete[0])?.name ?? concrete[0];
    }
    return `${concrete.length} Regionen`;
  }, [bundeslandIds, filters.search, filters.districts, filters.district]);

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
        onBundeslandFilter={(id) => {
          // Replace the active bundesland selection — same UX as picking
          // the chip in the FilterDrawer. Clear any district filter so a
          // stale Bezirk doesn't shadow the new bundesland scope.
          setBundeslandIds([id]);
          setFilters((prev) =>
            prev.district || prev.districts
              ? { ...prev, district: undefined, districts: undefined, bbox: undefined }
              : { ...prev, bbox: undefined },
          );
          setDynamicFlyTo(null);
        }}
        onDistrictFilter={(blId, district) => {
          // Wire up multi-select-friendly: the user typed exactly one
          // district name, so set bundesland to its parent and the
          // districts array to that one entry.
          setBundeslandIds([blId]);
          setFilters((prev) => ({
            ...prev,
            districts: [district],
            district: undefined,
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
                scopeLabel !== 'Österreich' ? scopeLabel : filters.search ? filters.search : 'Österreich'
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

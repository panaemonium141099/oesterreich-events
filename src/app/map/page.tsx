'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Event, EventFilters } from '@/types/events';
import { Header } from '@/components/Layout/Header';
import { Sidebar } from '@/components/Layout/Sidebar';
import { EventDetail } from '@/components/Events/EventDetail';
import { MapLoadingOverlay } from '@/components/Map/MapLoadingOverlay';
import { LocationBanner } from '@/components/Map/LocationBanner';
import type { Bundesland } from '@/lib/bundeslaender';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { getDistrictsByBundesland } from '@/lib/districtsAT';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const EventMap = dynamic(() => import('@/components/Map/EventMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto mb-4" />
        <p className="text-white/40 text-sm">Karte wird geladen...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}

function MapPageInner() {
  const router = useRouter();
  const { user, profile, loading: authLoading, profileComplete } = useAuth();

  // Redirect to complete-profile if logged in but profile incomplete
  useEffect(() => {
    if (!authLoading && user && profile && !profileComplete) {
      router.replace('/auth/complete-profile');
    }
  }, [authLoading, user, profile, profileComplete, router]);

  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialBundeslandId = searchParams.get('bundesland') || 'all';
  const initialCategory = searchParams.get('category') || '';
  const initialLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const initialLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
  const initialZoom = searchParams.get('zoom') ? parseFloat(searchParams.get('zoom')!) : null;

  // Suppress geolocation auto-fly when the user arrived with explicit URL context
  // (bundesland, category, search or explicit coords from a blog/CTA link)
  const hasUrlContext =
    initialBundeslandId !== 'all' ||
    initialCategory !== '' ||
    initialSearch !== '' ||
    (initialLat !== null && initialLng !== null);

  // Find initial bundesland from URL param
  const initialBundesland = BUNDESLAENDER.find(b => b.id === initialBundeslandId) || BUNDESLAENDER[0];
  const flyToCoords = initialLat && initialLng ? { lat: initialLat, lng: initialLng, zoom: initialZoom || 13 } : null;

  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // Default: show events for the next 6 months (visible in datepicker, user can clear it)
  const defaultDateTo = new Date();
  defaultDateTo.setMonth(defaultDateTo.getMonth() + 6);
  const defaultDateToStr = defaultDateTo.toISOString().slice(0, 10);

  const [filters, setFilters] = useState<EventFilters>({
    dateTo: defaultDateToStr,
    ...(initialSearch ? { search: initialSearch } : {}),
    ...(initialCategory ? { category: initialCategory } : {}),
  });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [eveningMode, setEveningMode] = useState(false);
  const [bundesland, setBundesland] = useState<Bundesland>(initialBundesland);

  // Viewport bounding box — stored in ref, no refetch on viewport change
  const mapBboxRef = useRef<[number, number, number, number] | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Callback for EventMap to report viewport changes — only stores ref, no refetch
  const handleViewportChange = useCallback((bbox: [number, number, number, number]) => {
    mapBboxRef.current = bbox;
  }, []);

  useEffect(() => { trackEvent('page_view', { path: '/map' }); }, []);

  // Build query params — always loads ALL bundeslaender, filtering is client-side
  // Only content filters (category, date, search) trigger API refetch
  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    // Always load all — bundesland filtering is client-side
    params.set('bundesland', 'all');
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    else if (filters.category) params.set('category', filters.category);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.search) params.set('search', filters.search);
    if (filters.eveningOnly) params.set('eveningOnly', 'true');
    return params;
  }, [filters]); // NOTE: bundesland NOT in deps — switching BL doesn't refetch

  // Progressive background loading: first batch fast, then background batches
  const fetchEventsProgressive = useCallback(async () => {
    // Abort any in-flight progressive load
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setAllEvents([]);
    setTotal(0);
    setLoadProgress(null);

    const BATCH_SIZE = 5000;

    try {
      // ── Get total count first (fetch 1 event with exact count) ──
      const countParams = buildParams();
      countParams.set('limit', '1');
      const countRes = await fetch(`/api/events?${countParams.toString()}`, { signal: controller.signal });
      let totalCount = 0;
      if (countRes.ok) {
        const countData = await countRes.json();
        totalCount = countData.total || 0;
      }

      // ── Phase 1: Fast first batch (location-aware) ──
      const firstParams = buildParams();
      firstParams.set('limit', String(BATCH_SIZE));

      const storedLoc = typeof window !== 'undefined' ? localStorage.getItem('user_location') : null;
      if (storedLoc) {
        try {
          const { lat, lng } = JSON.parse(storedLoc);
          firstParams.set('bbox', `${lat - 0.9},${lng - 1.2},${lat + 0.9},${lng + 1.2}`);
        } catch { /* ignore */ }
      }

      const firstRes = await fetch(`/api/events?${firstParams.toString()}`, { signal: controller.signal });
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstData = await firstRes.json();

      const firstEvents: Event[] = firstData.events || [];
      const realTotal = totalCount || firstData.total || firstEvents.length;

      setAllEvents(firstEvents);
      setTotal(realTotal);
      setLoading(false);

      if (firstEvents.length >= realTotal || (!firstData.hasMore && firstEvents.length < BATCH_SIZE)) return;

      // ── Phase 2: Background load remaining events ──
      setLoadProgress({ loaded: firstEvents.length, total: realTotal });
      const existingIds = new Set(firstEvents.map(e => e.id));
      let accumulated = [...firstEvents];
      let cursor: string | null = null;

      while (true) {
        if (controller.signal.aborted) break;
        await new Promise(r => setTimeout(r, 300)); // don't hammer API

        const params = buildParams();
        params.set('limit', String(BATCH_SIZE));
        if (cursor) params.set('cursor', cursor);

        const res = await fetch(`/api/events?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const batch: Event[] = data.events || [];
        if (batch.length === 0) break;

        // Deduplicate against already loaded events
        const unique = batch.filter(e => !existingIds.has(e.id));
        for (const e of unique) existingIds.add(e.id);
        accumulated = [...accumulated, ...unique];

        setAllEvents(accumulated);
        setLoadProgress({ loaded: accumulated.length, total: realTotal });

        cursor = data.nextCursor || null;
        if (!cursor || batch.length < BATCH_SIZE) break;
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        if (process.env.NODE_ENV === 'development') console.error('Fehler beim Laden der Events:', err);
      }
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchEventsProgressive();
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [fetchEventsProgressive]);

  // Client-side bundesland filter (no refetch needed when switching BL)
  const bundeslandEvents = useMemo(() => {
    if (bundesland.id === 'all') return allEvents;
    return allEvents.filter(e => {
      const bl = (e.bundesland || '').toLowerCase();
      const target = bundesland.id.toLowerCase();
      return bl === target || bl.includes(target) || target.includes(bl);
    });
  }, [allEvents, bundesland]);

  // Client-side dedup: same title + same day = show only first (earliest time)
  const dedupedEvents = useMemo(() => {
    const seen = new Set<string>();
    return bundeslandEvents.filter(e => {
      const key = `${(e.title || '').trim().toLowerCase()}::${(e.start_date || '').split('T')[0]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [bundeslandEvents]);

  // Sidebar shows district-filtered deduped events; map shows bundesland-filtered events for clustering
  const sidebarEvents = filters.district
    ? dedupedEvents.filter(e => e.district === filters.district)
    : dedupedEvents;

  const [dynamicFlyTo, setDynamicFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  // Meine Events panel
  const [showMyEvents, setShowMyEvents] = useState(false);
  const [myEvents, setMyEvents] = useState<{ id: string; name: string; event_date: string | null; location_name: string | null; location_lat: number | null; location_lng: number | null }[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;
    const fetchMyEvents = async () => {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      if (!memberships || memberships.length === 0) return;
      const groupIds = memberships.map((m: { group_id: string }) => m.group_id);
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, event_date, location_name, location_lat, location_lng')
        .in('id', groupIds)
        .order('event_date', { ascending: true, nullsFirst: false });
      if (groups) setMyEvents(groups);
    };
    fetchMyEvents();
  }, [user, supabase]);

  // Fly to district center when district filter changes
  useEffect(() => {
    if (!filters.district) return;
    const districts = getDistrictsByBundesland(bundesland.id);
    const match = districts.find(d => d.name === filters.district);
    if (match) {
      setDynamicFlyTo({ lat: match.center[0], lng: match.center[1], zoom: 11 });
    }
  }, [filters.district, bundesland.id]);

  const toggleEveningMode = () => {
    const newMode = !eveningMode;
    setEveningMode(newMode);
    // Don't refetch events — just toggle the map style
    // The eveningOnly filter is optional; events stay the same
  };

  const handleGemeindeSelect = (gemeinde: { name: string; bundeslandId: string; lat: number; lng: number }) => {
    // Switch bundesland
    const bl = BUNDESLAENDER.find(b => b.id === gemeinde.bundeslandId);
    if (bl) {
      setBundesland(bl);
      setFilters(prev => ({ ...prev, district: undefined, search: gemeinde.name }));
    }
    // Fly to gemeinde after a short delay (let bundesland overlay settle)
    setTimeout(() => {
      setDynamicFlyTo({ lat: gemeinde.lat, lng: gemeinde.lng, zoom: 13 });
    }, 300);
  };

  return (
    <div className={`h-screen flex flex-col transition-all duration-700 ${eveningMode ? 'evening-mode' : ''}`}>
      {eveningMode && <div className="stars-overlay" />}
      <Header
        filters={filters}
        onFiltersChange={setFilters}
        totalEvents={sidebarEvents.length}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        eveningMode={eveningMode}
        onToggleEveningMode={toggleEveningMode}
        bundesland={bundesland}
        onBundeslandChange={(bl) => { setBundesland(bl); setFilters(prev => ({ ...prev, district: undefined })); setDynamicFlyTo(null); }}
        onGemeindeSelect={handleGemeindeSelect}
      />

      <div className="flex-1 overflow-hidden relative">
        <EventMap
          events={bundeslandEvents}
          selectedEvent={selectedEvent}
          hoveredEventId={hoveredEventId}
          onSelectEvent={setSelectedEvent}
          eveningMode={eveningMode}
          flyToCoords={dynamicFlyTo || flyToCoords}
          bundesland={bundesland}
          onViewportChange={handleViewportChange}
        />

        {/* Loading overlay — centered in map area, not covering sidebar */}
        <MapLoadingOverlay loading={loading} eventCount={allEvents.length} />

        {/* Progressive loading indicator — thin blue line at top of map */}
        {loadProgress && loadProgress.loaded < loadProgress.total && (
          <div className="absolute top-0 left-0 right-0 z-20 h-[3px] bg-blue-200/30">
            <div
              className="h-full bg-blue-500 rounded-r transition-all duration-700 ease-out"
              style={{ width: `${Math.max(5, Math.min(99, (loadProgress.loaded / loadProgress.total) * 100))}%` }}
            />
          </div>
        )}

        {/* Geolocation banner */}
        <LocationBanner
          onLocationFound={(lat, lng) => setDynamicFlyTo({ lat, lng, zoom: 12 })}
          eveningMode={eveningMode}
          suppressAutoFly={hasUrlContext}
        />

        {/* Desktop sidebar */}
        {sidebarOpen && (
          <div className="absolute top-0 left-0 bottom-0 z-10 hidden lg:block">
            <Sidebar
              events={sidebarEvents}
              loading={loading}
              onSelectEvent={setSelectedEvent}
              selectedEventId={selectedEvent?.id ?? null}
              onHoverEvent={setHoveredEventId}
              eveningMode={eveningMode}
            />
          </div>
        )}

        {/* Mobile bottom sheet sidebar */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-[1000] flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Bottom sheet */}
            <div className="relative z-10 max-h-[75vh] flex flex-col animate-slide-up rounded-t-2xl overflow-hidden shadow-2xl">
              {/* Handle + close */}
              <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
                eveningMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'
              }`}>
                <div className="w-10 h-1 rounded-full bg-current opacity-20 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                <span className={`text-sm font-semibold ${eveningMode ? 'text-gray-200' : 'text-slate-700'}`}>
                  Events ({sidebarEvents.length})
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    eveningMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                  aria-label="Sidebar schließen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <Sidebar
                  events={sidebarEvents}
                  loading={loading}
                  onSelectEvent={(event) => { setSelectedEvent(event); setSidebarOpen(false); }}
                  selectedEventId={selectedEvent?.id ?? null}
                  onHoverEvent={setHoveredEventId}
                  eveningMode={eveningMode}
                />
              </div>
            </div>
          </div>
        )}

        {/* Meine Events Button + Panel */}
        {user && (
          <div className="absolute top-3 right-3 z-20">
            <button
              onClick={() => setShowMyEvents(!showMyEvents)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 min-h-[44px] active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none shadow-lg ${
                showMyEvents
                  ? 'bg-white text-black'
                  : eveningMode
                    ? 'bg-white/10 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20'
                    : 'bg-black/80 backdrop-blur-xl text-white hover:bg-black/90'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Meine Events
              {myEvents.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${showMyEvents ? 'bg-black/10' : 'bg-white/20'}`}>
                  {myEvents.length}
                </span>
              )}
            </button>

            {showMyEvents && (
              <div className={`absolute right-0 top-full mt-2 w-72 rounded-xl overflow-hidden shadow-2xl border animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none ${
                eveningMode
                  ? 'bg-gray-900/95 backdrop-blur-xl border-white/10'
                  : 'bg-white/95 backdrop-blur-xl border-slate-200'
              }`}>
                {myEvents.length === 0 ? (
                  <div className="p-6 text-center">
                    <svg className={`w-8 h-8 mx-auto mb-2 ${eveningMode ? 'text-white/20' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className={`text-sm ${eveningMode ? 'text-white/40' : 'text-slate-400'}`}>Noch keine geplanten Events</p>
                    <Link
                      href="/groups"
                      className={`inline-block mt-2 text-xs font-medium ${eveningMode ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-700'} transition-colors`}
                    >
                      Event planen
                    </Link>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto py-1">
                    {myEvents.map((ev, i) => (
                      <button
                        key={ev.id}
                        onClick={() => {
                          if (ev.location_lat && ev.location_lng) {
                            setDynamicFlyTo({ lat: ev.location_lat, lng: ev.location_lng, zoom: 15 });
                          }
                          setShowMyEvents(false);
                        }}
                        className={`w-full text-left px-4 py-3 transition-all duration-150 animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none ${
                          eveningMode
                            ? 'hover:bg-white/5 text-white'
                            : 'hover:bg-slate-50 text-slate-800'
                        } ${i !== myEvents.length - 1 ? eveningMode ? 'border-b border-white/5' : 'border-b border-slate-100' : ''}`}
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <p className="text-sm font-medium truncate">{ev.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.event_date && (
                            <span className={`text-xs ${eveningMode ? 'text-white/40' : 'text-slate-400'}`}>
                              {new Date(ev.event_date).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {ev.location_name && (
                            <span className={`text-xs truncate ${eveningMode ? 'text-white/25' : 'text-slate-300'}`}>
                              {ev.location_name}
                            </span>
                          )}
                        </div>
                        {!ev.location_lat && (
                          <span className={`text-[10px] mt-1 inline-block ${eveningMode ? 'text-white/20' : 'text-slate-300'}`}>Kein Standort</span>
                        )}
                      </button>
                    ))}
                    <Link
                      href="/groups"
                      className={`block text-center py-2.5 text-xs font-medium border-t transition-colors ${
                        eveningMode
                          ? 'border-white/5 text-white/40 hover:text-white/70'
                          : 'border-slate-100 text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Alle Events verwalten
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            eveningMode={eveningMode}
            onTagClick={(tag) => {
              setFilters(prev => ({ ...prev, tags: [tag], category: undefined }));
              setSelectedEvent(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

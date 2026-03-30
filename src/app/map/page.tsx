'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Event, EventFilters } from '@/types/events';
import { Header } from '@/components/Layout/Header';
import { Sidebar } from '@/components/Layout/Sidebar';
import { EventDetail } from '@/components/Events/EventDetail';
import { MapLoadingOverlay } from '@/components/Map/MapLoadingOverlay';
import type { Bundesland } from '@/lib/bundeslaender';
import { BUNDESLAENDER } from '@/lib/bundeslaender';

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
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialBundeslandId = searchParams.get('bundesland') || 'all';
  const initialLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const initialLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
  const initialZoom = searchParams.get('zoom') ? parseFloat(searchParams.get('zoom')!) : null;

  // Find initial bundesland from URL param
  const initialBundesland = BUNDESLAENDER.find(b => b.id === initialBundeslandId) || BUNDESLAENDER[0];
  const flyToCoords = initialLat && initialLng ? { lat: initialLat, lng: initialLng, zoom: initialZoom || 13 } : null;

  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EventFilters>(initialSearch ? { search: initialSearch } : {});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [eveningMode, setEveningMode] = useState(false);
  const [bundesland, setBundesland] = useState<Bundesland>(initialBundesland);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('bundesland', bundesland.id);
    if (filters.district) params.set('district', filters.district);
    if (filters.category) params.set('category', filters.category);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.priceMin !== undefined) params.set('priceMin', String(filters.priceMin));
    if (filters.priceMax !== undefined) params.set('priceMax', String(filters.priceMax));
    if (filters.search) params.set('search', filters.search);
    if (filters.eveningOnly) params.set('eveningOnly', 'true');

    try {
      const res = await fetch(`/api/events?${params.toString()}`);
      const data = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Fehler beim Laden der Events:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, bundesland]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const [dynamicFlyTo, setDynamicFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

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
        totalEvents={total}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        eveningMode={eveningMode}
        onToggleEveningMode={toggleEveningMode}
        bundesland={bundesland}
        onBundeslandChange={(bl) => { setBundesland(bl); setFilters(prev => ({ ...prev, district: undefined })); setDynamicFlyTo(null); }}
        onGemeindeSelect={handleGemeindeSelect}
      />

      <div className="flex-1 overflow-hidden relative">
        <EventMap
          events={events}
          selectedEvent={selectedEvent}
          hoveredEventId={hoveredEventId}
          onSelectEvent={setSelectedEvent}
          eveningMode={eveningMode}
          flyToCoords={dynamicFlyTo || flyToCoords}
          bundesland={bundesland}
        />

        {/* Loading overlay — centered in map area, not covering sidebar */}
        <MapLoadingOverlay loading={loading} eventCount={events.length} />

        {/* Desktop sidebar */}
        {sidebarOpen && (
          <div className="absolute top-0 left-0 bottom-0 z-10 hidden lg:block">
            <Sidebar
              events={events}
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
                  Events ({events.length})
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
                  events={events}
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

        {selectedEvent && (
          <EventDetail
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            eveningMode={eveningMode}
          />
        )}
      </div>
    </div>
  );
}

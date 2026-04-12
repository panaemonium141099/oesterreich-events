'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Event } from '@/types/events';
import type { Bundesland } from '@/lib/bundeslaender';
import { getEventImage, getCategoryFallbackImage } from '@/lib/categoryImages';
import { formatDateNumeric, formatDateCompact, formatTime } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';

interface PlannedEventMarker {
  id: string;
  name: string;
  event_date: string | null;
  location_name: string | null;
  location_lat: number;
  location_lng: number;
  is_own: boolean;
  creator_name: string;
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/** Escape HTML special characters to prevent XSS in popup innerHTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EventMapProps {
  events: Event[];
  selectedEvent: Event | null;
  hoveredEventId: string | null;
  onSelectEvent: (event: Event) => void;
  eveningMode?: boolean;
  bundesland: Bundesland;
  flyToCoords?: { lat: number; lng: number; zoom: number } | null;
  /** Called when the map viewport changes with [south_lat, west_lng, north_lat, east_lng] */
}

function addBaseOverlays(m: mapboxgl.Map, dark: boolean) {
  // 3D Terrain
  if (!m.getSource('mapbox-dem')) {
    m.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
  }
  m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  if (!m.getLayer('sky')) {
    m.addLayer({ id: 'sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0.0, 0.0], 'sky-atmosphere-sun-intensity': 15 } });
  }

  // 3D Buildings
  const labelLayerId = m.getStyle().layers?.find(l => l.type === 'symbol' && l.layout?.['text-field'])?.id;
  if (!m.getLayer('3d-buildings')) {
    m.addLayer({
      id: '3d-buildings', source: 'composite', 'source-layer': 'building',
      filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
      paint: { 'fill-extrusion-color': dark ? '#1a1a2e' : '#ddd', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.7 },
    }, labelLayerId);
  }
}

// Track active overlay request to cancel stale fetches
let overlayAbort: AbortController | null = null;
// Cache fetched GeoJSON to avoid re-downloading
const geojsonCache = new Map<string, unknown>();

function updateBundeslandOverlay(m: mapboxgl.Map, bl: Bundesland, dark: boolean) {
  // Cancel any in-flight fetch
  if (overlayAbort) overlayAbort.abort();
  overlayAbort = new AbortController();
  const { signal } = overlayAbort;

  // Remove old overlay layers
  if (m.getLayer('bl-mask-fill')) m.removeLayer('bl-mask-fill');
  if (m.getLayer('bl-border-line')) m.removeLayer('bl-border-line');
  if (m.getLayer('bl-wien-mask-fill')) m.removeLayer('bl-wien-mask-fill');
  if (m.getSource('bl-mask')) m.removeSource('bl-mask');
  if (m.getSource('bl-border')) m.removeSource('bl-border');
  if (m.getSource('bl-wien-mask')) m.removeSource('bl-wien-mask');

  if (!bl.geojsonFile) return;

  const cachedFetch = async (url: string) => {
    if (geojsonCache.has(url)) return geojsonCache.get(url);
    const data = await fetch(url, { signal }).then(r => r.json());
    geojsonCache.set(url, data);
    return data;
  };

  cachedFetch(bl.geojsonFile).then(async (geojson: any) => {
    if (signal.aborted) return; // Stale response, discard
    if (m.getSource('bl-mask')) return; // Already added by another call

    const world = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
    const holes: number[][][] = [];
    if (geojson.geometry.type === 'MultiPolygon') {
      for (const polygon of geojson.geometry.coordinates) {
        holes.push(polygon[0]);
      }
    } else {
      holes.push(geojson.geometry.coordinates[0]);
    }

    m.addSource('bl-mask', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ...holes] } },
    });
    m.addSource('bl-border', { type: 'geojson', data: geojson });

    m.addLayer({ id: 'bl-mask-fill', type: 'fill', source: 'bl-mask', paint: { 'fill-color': dark ? '#0f172a' : '#f1f5f9', 'fill-opacity': dark ? 0.45 : 0.45 } });
    m.addLayer({ id: 'bl-border-line', type: 'line', source: 'bl-border', paint: { 'line-color': dark ? 'rgba(148, 163, 184, 0.4)' : bl.borderColor, 'line-width': dark ? 1.5 : 2.5, 'line-opacity': 0.7 } });

    // NÖ umschließt Wien — Wien separat ausgrauen
    if (bl.id === 'niederoesterreich') {
      try {
        const wienGeojson = await cachedFetch('/wien.geojson');
        if (signal.aborted) return;
        if (!m.getSource('bl-wien-mask')) {
          m.addSource('bl-wien-mask', { type: 'geojson', data: wienGeojson });
          m.addLayer({ id: 'bl-wien-mask-fill', type: 'fill', source: 'bl-wien-mask', paint: { 'fill-color': dark ? '#0f172a' : '#f1f5f9', 'fill-opacity': dark ? 0.45 : 0.45 } });
        }
      } catch { /* aborted or not found */ }
    }
  }).catch(() => {});
}

function EventMap({ events, selectedEvent, hoveredEventId, onSelectEvent, eveningMode, bundesland, flyToCoords }: EventMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersOnScreen = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const eventLookup = useRef<Map<string, Event>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const prevBundeslandRef = useRef(bundesland.id);

  // Build event lookup
  useEffect(() => {
    eventLookup.current.clear();
    events.forEach(e => eventLookup.current.set(e.id, e));
  }, [events]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: eveningMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/outdoors-v12',
      center: bundesland.center, zoom: bundesland.zoom, pitch: bundesland.pitch, bearing: bundesland.bearing,
      antialias: true, maxZoom: 18, minZoom: 5,
    });
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-left');

    // Geolocation — "Mein Standort" button
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: false,
    });
    map.current.addControl(geolocate, 'top-left');

    map.current.on('load', () => {
      if (!map.current) return;
      addBaseOverlays(map.current, !!eveningMode);
      updateBundeslandOverlay(map.current, bundesland, !!eveningMode);
      setMapReady(true);

    });

    return () => { map.current?.remove(); map.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bundesland switch
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (prevBundeslandRef.current === bundesland.id) return;
    prevBundeslandRef.current = bundesland.id;

    updateBundeslandOverlay(map.current, bundesland, !!eveningMode);

    const m = map.current;

    // easeTo instead of flyTo: avoids the tile-loading race condition
    // that flyTo causes with large zoom jumps + 3D terrain
    m.easeTo({
      center: bundesland.center,
      zoom: bundesland.zoom,
      pitch: bundesland.pitch,
      bearing: bundesland.bearing,
      duration: 1200,
      essential: true,
    });
  }, [bundesland, mapReady, eveningMode]);

  // Evening mode switch
  useEffect(() => {
    if (!map.current || !mapReady || !map.current.isStyleLoaded()) return;
    const isDark = map.current.getStyle()?.sprite?.toString().includes('dark') || false;
    if (isDark === !!eveningMode) return;

    const { lng, lat } = map.current.getCenter();
    const zoom = map.current.getZoom();
    const pitch = map.current.getPitch();
    const bearing = map.current.getBearing();

    setMapReady(false);
    sourceInitialized.current = false; // Force full re-creation after style change
    map.current.setStyle(eveningMode ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/outdoors-v12');
    map.current.once('style.load', () => {
      if (!map.current) return;
      addBaseOverlays(map.current, !!eveningMode);
      updateBundeslandOverlay(map.current, bundesland, !!eveningMode);
      map.current.jumpTo({ center: [lng, lat], zoom, pitch, bearing });
      // Small delay to ensure Mapbox has fully processed the new style
      setTimeout(() => setMapReady(true), 150);
    });
  }, [eveningMode, mapReady, bundesland]);

  // Popup builder
  const createPopupHTML = useCallback((event: Event, dark?: boolean) => {
    const date = formatDateNumeric(event.start_date);
    const time = formatTime(event.start_date);
    const showTime = time !== null;
    const bg = dark ? '#1e293b' : '#ffffff';
    const textColor = dark ? '#f1f5f9' : '#1e293b';
    const subTextColor = dark ? '#94a3b8' : '#64748b';
    const btnBg = dark ? '#4f46e5' : '#2563eb';
    return `<div style="width:240px;font-family:Inter,system-ui,sans-serif;background:${bg};border-radius:8px;">
      <img src="${getEventImage(event.image_url, event.category, event.title)}" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;" onerror="this.src='${getCategoryFallbackImage(event.category, event.title)}'" />
      <div style="padding:10px;">
        <div style="font-weight:600;font-size:13px;color:${textColor};margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(event.title)}</div>
        <div style="font-size:11px;color:${subTextColor};margin-bottom:2px;">${date}${showTime ? ` um ${time}` : ''}</div>
        ${event.location_name ? `<div style="font-size:11px;color:${subTextColor};margin-bottom:4px;display:flex;align-items:center;gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${subTextColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>${escapeHtml(event.location_name)}</div>` : ''}
        ${event.price_text ? `<div style="font-size:11px;font-weight:600;color:${btnBg};margin-bottom:6px;">${escapeHtml(event.price_text)}</div>` : ''}
        <button data-event-id="${event.id}" style="width:100%;padding:7px;background:${btnBg};color:white;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">Details anzeigen</button>
      </div></div>`;
  }, []);

  // Helper: build GeoJSON from events with jitter for overlapping coords
  const buildGeoJSON = useCallback((eventList: typeof events): GeoJSON.FeatureCollection => {
    const eventsWithCoords = eventList.filter(e => e.latitude && e.longitude);
    const coordCounts = new Map<string, number>();
    const jitteredEvents = eventsWithCoords.map(e => {
      const key = `${e.latitude!.toFixed(5)}_${e.longitude!.toFixed(5)}`;
      const idx = coordCounts.get(key) || 0;
      coordCounts.set(key, idx + 1);
      if (idx === 0) return { ...e };
      const angle = (idx * 2.399) % (2 * Math.PI);
      const offset = 0.0003 * Math.ceil(idx / 6);
      return { ...e, latitude: e.latitude! + Math.sin(angle) * offset, longitude: e.longitude! + Math.cos(angle) * offset };
    });
    return {
      type: 'FeatureCollection',
      features: jitteredEvents.map(e => ({
        type: 'Feature',
        properties: { id: e.id, title: e.title, image_url: e.image_url || '' },
        geometry: { type: 'Point', coordinates: [e.longitude!, e.latitude!] },
      })),
    };
  }, []);

  // Track whether source+layers are already initialized
  const sourceInitialized = useRef(false);

  // Update GeoJSON data without recreating source/layers (prevents flicker)
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;

    if (!m.isStyleLoaded()) {
      m.once('idle', () => setMapReady(prev => { setTimeout(() => setMapReady(true), 50); return false; }));
      return;
    }

    const geojson = buildGeoJSON(events);

    // If source already exists, just update the data — no full teardown needed
    if (sourceInitialized.current && m.getSource('events')) {
      (m.getSource('events') as mapboxgl.GeoJSONSource).setData(geojson);
      // Don't return — let the marker update logic below run
    } else {
      // First time: create source + layers — remove layers before source
      for (const layerId of ['unclustered-point', 'cluster-count', 'clusters']) {
        if (m.getLayer(layerId)) m.removeLayer(layerId);
      }
      if (m.getSource('events')) m.removeSource('events');

      markersOnScreen.current.forEach(marker => marker.remove());
      markersOnScreen.current.clear();

      m.addSource('events', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 15,
        clusterRadius: 60,
      });

      sourceInitialized.current = true;

    const isDark = !!eveningMode;

    // Cluster circles
    m.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'events',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.9)',
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 50, 28, 100, 34],
        'circle-stroke-width': isDark ? 1.5 : 2,
        'circle-stroke-color': isDark ? 'rgba(148, 163, 184, 0.35)' : 'rgba(37, 99, 235, 0.25)',
        'circle-blur': 0,
      },
    });

    // Cluster count labels
    m.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'events',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': ['step', ['get', 'point_count'], 13, 10, 14, 30, 15],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': isDark ? '#cbd5e1' : '#1e3a5f',
      },
    });

    // Invisible unclustered points (we render DOM markers for these)
    m.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'events',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': 0,
        'circle-opacity': 0,
      },
    });

    // Click on cluster -> zoom in
    m.on('click', 'clusters', (e) => {
      try {
        const features = m.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = m.getSource('events') as mapboxgl.GeoJSONSource;
        if (!source) return;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !zoom) return;
          const coords = (features[0].geometry as GeoJSON.Point).coordinates;
          m.flyTo({ center: [coords[0], coords[1]], zoom, duration: 800 });
        });
      } catch { /* style change in progress */ }
    });

    // Cursor pointer on clusters
    m.on('mouseenter', 'clusters', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'clusters', () => { m.getCanvas().style.cursor = ''; });
    } // end of else (first-time source+layer setup)

    // Function to render DOM markers for unclustered points
    const updateMarkers = () => {
      if (!m.getSource('events')) return;
      const features = m.querySourceFeatures('events', { sourceLayer: '' });
      const newMarkerIds = new Set<string>();

      for (const feature of features) {
        if (feature.properties?.cluster) continue; // Skip clusters

        const id = feature.properties?.id;
        if (!id) continue;
        const markerId = `marker-${id}`;
        newMarkerIds.add(markerId);

        if (markersOnScreen.current.has(markerId)) continue; // Already rendered

        const event = eventLookup.current.get(id);
        if (!event) continue;

        const coords = (feature.geometry as GeoJSON.Point).coordinates;

        const el = document.createElement('div');
        const todayStr = new Date().toISOString().slice(0, 10);
        const eventDateStr = event.start_date?.slice(0, 10) || '';
        const isToday = eventDateStr === todayStr;
        el.className = `mapbox-event-marker${isToday ? ' marker-today' : ''}`;
        const imgUrl = getEventImage(event.image_url, event.category, event.title);
        const fallbackUrl = getCategoryFallbackImage(event.category, event.title);
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = '';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none;';
        img.onerror = () => { img.onerror = null; img.src = fallbackUrl; };
        el.appendChild(img);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([coords[0], coords[1]])
          .addTo(m);

        // Lazy popup — only create on hover for performance
        let popup: mapboxgl.Popup | null = null;
        el.addEventListener('mouseenter', () => {
          if (!popup) {
            popup = new mapboxgl.Popup({ offset: 25, closeButton: false, closeOnClick: false, maxWidth: '260px' })
              .setHTML(createPopupHTML(event, !!eveningMode));
            marker.setPopup(popup);
            popup.on('open', () => {
              const pe = popup?.getElement();
              if (!pe) return;
              pe.addEventListener('mouseleave', () => {
                setTimeout(() => { if (pe && !pe.matches(':hover') && !el.matches(':hover')) popup?.remove(); }, 250);
              });
              pe.querySelector('button[data-event-id]')?.addEventListener('click', () => { popup?.remove(); onSelectEvent(event); });
            });
          }
          marker.togglePopup();
        });
        el.addEventListener('mouseleave', () => {
          setTimeout(() => {
            const pe = popup?.getElement();
            if (pe && !pe.matches(':hover')) marker.togglePopup();
          }, 250);
        });

        markersOnScreen.current.set(markerId, marker);
      }

      // Remove markers no longer visible
      markersOnScreen.current.forEach((marker, id) => {
        if (!newMarkerIds.has(id)) {
          marker.remove();
          markersOnScreen.current.delete(id);
        }
      });
    };

    // Update markers on map move/zoom — throttled for performance
    let renderTimer: ReturnType<typeof requestAnimationFrame> | null = null;
    const throttledUpdate = () => {
      if (renderTimer) return;
      renderTimer = requestAnimationFrame(() => {
        renderTimer = null;
        try {
          if (!m.getSource('events') || !m.isSourceLoaded('events')) return;
          updateMarkers();
        } catch { /* style change in progress */ }
      });
    };
    m.on('render', throttledUpdate);

    // Initial render
    m.once('idle', updateMarkers);

    return () => {
      m.off('render', throttledUpdate);
      if (renderTimer) cancelAnimationFrame(renderTimer);
    };
  // Note: bundesland NOT in deps — events are already filtered client-side.
  // Bundesland switch only triggers flyTo + overlay (separate useEffect).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, mapReady, buildGeoJSON, createPopupHTML, onSelectEvent, eveningMode]);

  // Fly to selected
  useEffect(() => {
    if (!map.current || !selectedEvent?.latitude || !selectedEvent?.longitude) return;
    map.current.flyTo({ center: [selectedEvent.longitude, selectedEvent.latitude], zoom: 14, pitch: 50, duration: 1500 });
  }, [selectedEvent]);

  // Fly to coords from landing page search or in-app gemeinde select
  const lastFlyTo = useRef<string | null>(null);
  useEffect(() => {
    if (!map.current || !mapReady || !flyToCoords) return;
    const key = `${flyToCoords.lat},${flyToCoords.lng},${flyToCoords.zoom}`;
    if (lastFlyTo.current === key) return; // Already flew here
    lastFlyTo.current = key;
    setTimeout(() => {
      map.current?.flyTo({
        center: [flyToCoords.lng, flyToCoords.lat],
        zoom: flyToCoords.zoom,
        pitch: 45,
        duration: 2000,
      });
    }, 800);
  }, [mapReady, flyToCoords]);

  // Highlight hovered
  useEffect(() => {
    markersOnScreen.current.forEach((marker, id) => {
      const eventId = id.replace('marker-', '');
      marker.getElement().classList.toggle('hovered', eventId === hoveredEventId);
    });
  }, [hoveredEventId]);

  // ============ PLANNED EVENTS MARKERS ============
  const { user, isGod, profile } = useAuth();
  const supabase = createClient();
  const plannedMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [plannedEvents, setPlannedEvents] = useState<PlannedEventMarker[]>([]);
  const [godFilterUser, setGodFilterUser] = useState('');
  const [godFilterResults, setGodFilterResults] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [godSelectedUserId, setGodSelectedUserId] = useState<string | null>(null);

  // Fetch planned events for the user (and friends)
  useEffect(() => {
    if (!user) return;

    const fetchPlanned = async () => {
      // Get groups where user is a member and event has location
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        setPlannedEvents([]);
        return;
      }

      const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, event_date, location_name, location_lat, location_lng, created_by')
        .in('id', groupIds)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null);

      if (!groups) {
        setPlannedEvents([]);
        return;
      }

      // Get creator names
      const creatorIds = [...new Set(groups.map((g: any) => g.created_by))];
      const { data: creators } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', creatorIds);

      const creatorMap = new Map((creators || []).map((c: any) => [c.id, `${c.first_name} ${c.last_name}`]));

      setPlannedEvents(groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        event_date: g.event_date,
        location_name: g.location_name,
        location_lat: g.location_lat,
        location_lng: g.location_lng,
        is_own: g.created_by === user.id,
        creator_name: creatorMap.get(g.created_by) || '',
      })));
    };

    fetchPlanned();
  }, [user, supabase]);

  // God-role: filter user events
  useEffect(() => {
    if (!isGod || !godFilterUser.trim()) {
      setGodFilterResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .or(`first_name.ilike.%${godFilterUser}%,last_name.ilike.%${godFilterUser}%`)
        .limit(5);
      setGodFilterResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [isGod, godFilterUser, supabase]);

  // God-role: fetch selected user's events
  const [godPlannedEvents, setGodPlannedEvents] = useState<PlannedEventMarker[]>([]);
  useEffect(() => {
    if (!godSelectedUserId) {
      setGodPlannedEvents([]);
      return;
    }
    const fetchGodEvents = async () => {
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, event_date, location_name, location_lat, location_lng, created_by')
        .eq('created_by', godSelectedUserId)
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null);

      setGodPlannedEvents((groups || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        event_date: g.event_date,
        location_name: g.location_name,
        location_lat: g.location_lat,
        location_lng: g.location_lng,
        is_own: false,
        creator_name: '',
      })));
    };
    fetchGodEvents();
  }, [godSelectedUserId, supabase]);

  // Render planned event markers
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;

    // Clear old planned markers
    plannedMarkers.current.forEach(marker => marker.remove());
    plannedMarkers.current.clear();

    const allPlanned = [...plannedEvents, ...godPlannedEvents];

    for (const pe of allPlanned) {
      // Outer wrapper — Mapbox controls its transform, so we don't touch it
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;';
      // Inner visual element — safe to animate without conflicting with Mapbox positioning
      const inner = document.createElement('div');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      inner.style.cssText = `width:40px;height:40px;border-radius:50%;border:3px solid #a855f7;background:#1a1a2e;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(168,85,247,0.4);${prefersReducedMotion ? '' : 'transition:transform 0.2s ease-out;'}`;
      inner.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
      el.appendChild(inner);
      if (!prefersReducedMotion) {
        el.onmouseenter = () => { inner.style.transform = 'scale(1.15)'; };
        el.onmouseleave = () => { inner.style.transform = 'scale(1)'; };
      }

      const dateStr = pe.event_date
        ? formatDateCompact(pe.event_date)
        : '';
      const prefix = pe.is_own ? 'Dein Event' : `${escapeHtml(pe.creator_name)}'s Event`;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, maxWidth: '220px' })
        .setHTML(`<div style="padding:10px;font-family:Inter,system-ui,sans-serif;background:#1e293b;border-radius:8px;">
          <div style="font-size:10px;color:#a855f7;font-weight:600;margin-bottom:4px;">${prefix}</div>
          <div style="font-size:13px;color:#f1f5f9;font-weight:600;margin-bottom:4px;">${escapeHtml(pe.name)}</div>
          ${dateStr ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">${dateStr}</div>` : ''}
          ${pe.location_name ? `<div style="font-size:11px;color:#94a3b8;">${escapeHtml(pe.location_name)}</div>` : ''}
          <a href="/groups/${pe.id}" style="display:block;margin-top:8px;padding:6px;background:#a855f7;color:white;border-radius:6px;font-size:11px;text-align:center;text-decoration:none;font-weight:500;">Dashboard &ouml;ffnen</a>
        </div>`);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pe.location_lng, pe.location_lat])
        .setPopup(popup)
        .addTo(m);

      el.addEventListener('click', () => marker.togglePopup());

      plannedMarkers.current.set(`planned-${pe.id}`, marker);
    }

    return () => {
      plannedMarkers.current.forEach(marker => marker.remove());
      plannedMarkers.current.clear();
    };
  }, [plannedEvents, godPlannedEvents, mapReady]);

  const mapEventCount = events.filter(e => e.latitude && e.longitude).length;

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="h-full w-full" />

      {/* God-role filter */}
      {isGod && (
        <div className="absolute top-16 right-4 z-20">
          <div className="relative">
            <input
              type="text"
              value={godFilterUser}
              onChange={(e) => { setGodFilterUser(e.target.value); setGodSelectedUserId(null); }}
              placeholder="User-Events filtern..."
              className="px-3 py-2.5 rounded-lg bg-black/70 backdrop-blur-sm border border-purple-500/30 text-white text-xs placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition-colors duration-200 w-48"
            />
            {godFilterResults.length > 0 && (
              <div className="absolute w-full mt-1 bg-[#111]/95 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden">
                {godFilterResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setGodSelectedUserId(u.id);
                      setGodFilterUser(`${u.first_name} ${u.last_name}`);
                      setGodFilterResults([]);
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5 transition-colors"
                  >
                    {u.first_name} {u.last_name}
                  </button>
                ))}
              </div>
            )}
            {godSelectedUserId && (
              <button
                onClick={() => { setGodFilterUser(''); setGodSelectedUserId(null); setGodPlannedEvents([]); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`absolute bottom-4 left-4 z-10 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg text-sm font-medium transition-all duration-300 ${
        eveningMode ? 'bg-gray-800/80 text-gray-300' : 'bg-white/90 text-slate-700'
      }`}>
        {mapEventCount} Events auf der Karte
        {plannedEvents.length > 0 && (
          <span className="ml-2 text-purple-400">{`+ ${plannedEvents.length} geplant`}</span>
        )}
      </div>
    </div>
  );
}

export default EventMap;

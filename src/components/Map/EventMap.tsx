'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Event } from '@/types/events';
import type { Bundesland } from '@/lib/bundeslaender';
import { getEventImage, getCategoryFallbackImage } from '@/lib/categoryImages';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface EventMapProps {
  events: Event[];
  selectedEvent: Event | null;
  hoveredEventId: string | null;
  onSelectEvent: (event: Event) => void;
  eveningMode?: boolean;
  bundesland: Bundesland;
  flyToCoords?: { lat: number; lng: number; zoom: number } | null;
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
    const date = new Date(event.start_date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = new Date(event.start_date).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    const showTime = new Date(event.start_date).getHours() !== 0;
    const bg = dark ? '#1e293b' : '#ffffff';
    const textColor = dark ? '#f1f5f9' : '#1e293b';
    const subTextColor = dark ? '#94a3b8' : '#64748b';
    const btnBg = dark ? '#4f46e5' : '#2563eb';
    return `<div style="width:240px;font-family:Inter,system-ui,sans-serif;background:${bg};border-radius:8px;">
      <img src="${getEventImage(event.image_url, event.category)}" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;" onerror="this.src='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop'" />
      <div style="padding:10px;">
        <div style="font-weight:600;font-size:13px;color:${textColor};margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${event.title}</div>
        <div style="font-size:11px;color:${subTextColor};margin-bottom:2px;">${date}${showTime ? ` um ${time}` : ''}</div>
        ${event.location_name ? `<div style="font-size:11px;color:${subTextColor};margin-bottom:4px;display:flex;align-items:center;gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${subTextColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>${event.location_name}</div>` : ''}
        ${event.price_text ? `<div style="font-size:11px;font-weight:600;color:${btnBg};margin-bottom:6px;">${event.price_text}</div>` : ''}
        <button data-event-id="${event.id}" style="width:100%;padding:7px;background:${btnBg};color:white;border:none;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">Details anzeigen</button>
      </div></div>`;
  }, []);

  // Add GeoJSON source + cluster layers + render individual markers
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const m = map.current;

    const eventsWithCoords = events.filter(e => e.latitude && e.longitude);

    // Wait for style to be loaded
    if (!m.isStyleLoaded()) {
      m.once('idle', () => setMapReady(prev => { setTimeout(() => setMapReady(true), 50); return false; }));
      return;
    }

    // Jitter overlapping coordinates so stacked events fan out when unclustered
    const coordCounts = new Map<string, number>();
    const jitteredEvents = eventsWithCoords.map(e => {
      const key = `${e.latitude!.toFixed(5)}_${e.longitude!.toFixed(5)}`;
      const idx = coordCounts.get(key) || 0;
      coordCounts.set(key, idx + 1);
      if (idx === 0) return { ...e }; // first at this location stays put
      // Fan out in a circle (~30m offset per step)
      const angle = (idx * 2.399) % (2 * Math.PI); // golden angle for even spread
      const offset = 0.0003 * Math.ceil(idx / 6); // ~30m, expanding rings
      return { ...e, latitude: e.latitude! + Math.sin(angle) * offset, longitude: e.longitude! + Math.cos(angle) * offset };
    });

    // Build GeoJSON
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: jitteredEvents.map(e => ({
        type: 'Feature',
        properties: { id: e.id, title: e.title, image_url: e.image_url || '' },
        geometry: { type: 'Point', coordinates: [e.longitude!, e.latitude!] },
      })),
    };

    // Remove old source/layers if they exist
    if (m.getLayer('cluster-count')) m.removeLayer('cluster-count');
    if (m.getLayer('clusters')) m.removeLayer('clusters');
    if (m.getLayer('unclustered-point')) m.removeLayer('unclustered-point');
    if (m.getSource('events')) m.removeSource('events');

    // Clear old DOM markers
    markersOnScreen.current.forEach(marker => marker.remove());
    markersOnScreen.current.clear();

    // Add source with clustering
    m.addSource('events', {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 60,
    });

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
        const imgUrl = getEventImage(event.image_url, event.category);
        const fallbackUrl = getCategoryFallbackImage(event.category);
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
  }, [events, mapReady, createPopupHTML, onSelectEvent, bundesland, eveningMode]);

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

  const mapEventCount = events.filter(e => e.latitude && e.longitude).length;

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="h-full w-full" />
      <div className={`absolute bottom-4 left-4 z-10 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg text-sm font-medium transition-all duration-300 ${
        eveningMode ? 'bg-gray-800/80 text-gray-300' : 'bg-white/90 text-slate-700'
      }`}>
        {mapEventCount} Events auf der Karte
      </div>
    </div>
  );
}

export default EventMap;

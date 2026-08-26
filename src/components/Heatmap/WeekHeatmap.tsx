'use client';

/**
 * WeekHeatmap — animierbare Event-Dichte-Karte Österreichs (fn-19).
 *
 * Datenquelle: der existierende columnar Points-Snapshot
 * /api/events/map-points (MV-gestützt, CDN 15 min) — ein Request,
 * NULL zusätzliche DB-Last. Client filtert die start/end-Day-Offsets
 * (Epoche 2026-01-01, siehe src/lib/v4/map-points.ts) auf das gewählte
 * Zeitfenster und füttert einen Mapbox-Heatmap-Layer.
 *
 * Zeitfenster-Toggle: Heute / Wochenende / 7 Tage — reine Client-Filter,
 * kein Refetch.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const EPOCH_MS = Date.UTC(2026, 0, 1);

interface Payload {
  n: number;
  lat: number[];
  lng: number[];
  start: number[];
  end: number[];
}

type Window = 'today' | 'weekend' | 'week';

function todayOffset(): number {
  return Math.floor((Date.now() - EPOCH_MS) / 86_400_000);
}

/** [von, bis] als Day-Offsets (inklusive). */
function windowRange(win: Window): [number, number] {
  const today = todayOffset();
  if (win === 'today') return [today, today];
  if (win === 'week') return [today, today + 6];
  // Wochenende: kommender Samstag + Sonntag (heute, falls schon Sa/So)
  const dow = new Date().getDay(); // 0 So … 6 Sa
  const satOffset = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
  return [today + Math.max(0, satOffset), today + satOffset + 1];
}

function toGeoJSON(p: Payload, win: Window): GeoJSON.FeatureCollection {
  const [from, to] = windowRange(win);
  const features: GeoJSON.Feature[] = [];
  for (let i = 0; i < p.n; i++) {
    const s = p.start[i];
    const e = p.end[i] || s;
    // Event-Zeitraum schneidet das Fenster?
    if (s > to || e < from) continue;
    const lat = p.lat[i];
    const lng = p.lng[i];
    if (!lat || !lng) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    });
  }
  return { type: 'FeatureCollection', features };
}

const WINDOWS: Array<{ id: Window; label: string }> = [
  { id: 'today', label: 'Heute' },
  { id: 'weekend', label: 'Wochenende' },
  { id: 'week', label: '7 Tage' },
];

export function WeekHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const payloadRef = useRef<Payload | null>(null);
  const [win, setWin] = useState<Window>('week');
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [13.55, 47.7],
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    mapRef.current = map;

    map.on('load', async () => {
      try {
        const res = await fetch('/api/events/map-points');
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as Payload;
        payloadRef.current = payload;

        const initial = toGeoJSON(payload, 'week');
        setCount(initial.features.length);

        map.addSource('events', { type: 'geojson', data: initial });
        map.addLayer({
          id: 'events-heat',
          type: 'heatmap',
          source: 'events',
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 10, 2.2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 14, 9, 30],
            'heatmap-opacity': 0.85,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.15, 'rgba(65,105,225,0.45)',
              0.4, 'rgba(0,206,209,0.6)',
              0.6, 'rgba(245,185,66,0.75)',
              0.85, 'rgba(255,110,64,0.9)',
              1, 'rgba(255,45,85,1)',
            ],
          },
        });
        map.addLayer({
          id: 'events-dots',
          type: 'circle',
          source: 'events',
          minzoom: 9,
          paint: {
            'circle-radius': 3,
            'circle-color': '#f5b942',
            'circle-opacity': 0.7,
          },
        });
      } catch {
        setFailed(true);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const payload = payloadRef.current;
    if (!map || !payload) return;
    const source = map.getSource('events') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    const fc = toGeoJSON(payload, win);
    source.setData(fc);
    setCount(fc.features.length);
  }, [win]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {WINDOWS.map(w => (
          <button
            key={w.id}
            type="button"
            onClick={() => setWin(w.id)}
            data-track="heatmap_window"
            className={
              'px-4 py-2 rounded-full border text-sm font-semibold transition-colors ' +
              (win === w.id
                ? 'bg-white/15 border-white/30 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white/90')
            }
          >
            {w.label}
          </button>
        ))}
        {count !== null && (
          <span className="text-xs text-white/40 ml-2">{count.toLocaleString('de-AT')} Events</span>
        )}
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-white/10">
        <div ref={containerRef} className="h-[420px] md:h-[560px] w-full" />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white/70">
            Karte konnte nicht geladen werden — bitte später erneut versuchen.
          </div>
        )}
      </div>
    </div>
  );
}

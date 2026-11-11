/**
 * Mapbox-Static-Bild der Karten-Kachel (fn-30). Reine URL-Funktionen,
 * isomorph: die Kachel ist ein `<img>` mit srcset 1x/2x, kein mapbox-gl.
 *
 * Pins = heutige Events mit belegter Position (`locationOutputs(event).pin`).
 * Koordinaten auf vier Stellen gerundet, dedupliziert und sortiert, damit
 * die URL nur wechselt, wenn sich die Pin-Menge ändert (Mapbox Static ist
 * pro Anfrage bepreist, der Browser-/CDN-Cache greift nur bei gleicher
 * URL). Höchstens 40 Pins, die URL bleibt unter 8.192 Zeichen.
 *
 * Attribution: das Mapbox-Logo bleibt im Bild (`logo` wird nicht
 * unterdrückt), die Textzeile „© Mapbox © OpenStreetMap · Karte verbessern"
 * rendert die Kachel direkt unter dem Bild (Mapbox Attribution Guide),
 * deshalb `attribution=false` im Bild selbst.
 */

import { locationOutputs, type GateableEvent } from '@/lib/location/gating';

export interface MapPin {
  lng: number;
  lat: number;
}

export const MAX_MAP_PINS = 40;
/** Obergrenze der Static-Images-API für die Gesamt-URL. */
export const MAPBOX_STATIC_URL_LIMIT = 8192;
/** Fester Österreich-Ausschnitt (lng, lat, zoom), auch ohne Pins. */
export const AUSTRIA_CAMERA = { lng: 13.35, lat: 47.7, zoom: 6.2 } as const;
export const DEFAULT_PIN_COLOR = 'd4b896';
export const MAP_STYLE = 'mapbox/dark-v11';

export const MAPBOX_ATTRIBUTION_LINKS = {
  mapbox: 'https://www.mapbox.com/about/maps/',
  osm: 'https://www.openstreetmap.org/about/',
  improve: 'https://apps.mapbox.com/feedback/',
} as const;

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Runden, deduplizieren, sortieren, kappen. */
export function normalizeMapPins(pins: MapPin[], max = MAX_MAP_PINS): MapPin[] {
  const seen = new Set<string>();
  const out: MapPin[] = [];
  for (const p of pins) {
    if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;
    const pin = { lng: round4(p.lng), lat: round4(p.lat) };
    const key = `${pin.lng},${pin.lat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pin);
  }
  return out
    .sort((a, b) => a.lng - b.lng || a.lat - b.lat)
    .slice(0, max);
}

/** Pins der Events, deren Position einen Pin trägt (Gating). */
export function collectMapPins(events: GateableEvent[]): MapPin[] {
  const pins: MapPin[] = [];
  for (const e of events) {
    if (e.latitude == null || e.longitude == null) continue;
    if (!locationOutputs(e).pin) continue;
    pins.push({ lng: e.longitude, lat: e.latitude });
  }
  return normalizeMapPins(pins);
}

export interface MapStaticOptions {
  token: string;
  /** Logische Bildgröße in CSS-Pixeln (Static API: höchstens 1280). */
  width: number;
  height: number;
  retina?: boolean;
  pinColor?: string;
  camera?: { lng: number; lat: number; zoom: number };
}

function buildUrl(pins: MapPin[], o: MapStaticOptions): string {
  const camera = o.camera ?? AUSTRIA_CAMERA;
  const overlay = pins.length
    ? `${pins.map(p => `pin-s+${o.pinColor ?? DEFAULT_PIN_COLOR}(${p.lng},${p.lat})`).join(',')}/`
    : '';
  const position = `${camera.lng},${camera.lat},${camera.zoom},0`;
  const size = `${Math.round(o.width)}x${Math.round(o.height)}${o.retina ? '@2x' : ''}`;
  return `https://api.mapbox.com/styles/v1/${MAP_STYLE}/static/${overlay}${position}/${size}?access_token=${encodeURIComponent(o.token)}&attribution=false`;
}

/**
 * Static-URL mit Pins. Ohne Pins der feste Österreich-Ausschnitt. Passt
 * die URL nicht unter das Limit, fallen die letzten Pins weg.
 */
export function mapStaticUrl(pins: MapPin[], opts: MapStaticOptions): string {
  let current = normalizeMapPins(pins);
  let url = buildUrl(current, opts);
  while (url.length >= MAPBOX_STATIC_URL_LIMIT && current.length > 0) {
    current = current.slice(0, -1);
    url = buildUrl(current, opts);
  }
  return url;
}

/** `src` (1x) und `srcSet` (1x/2x) für ein `<img>`; null ohne Token. */
export function mapStaticImage(
  pins: MapPin[],
  opts: Omit<MapStaticOptions, 'retina' | 'token'> & { token: string | undefined | null },
): { src: string; srcSet: string } | null {
  if (!opts.token) return null;
  const base = { ...opts, token: opts.token };
  const src = mapStaticUrl(pins, { ...base, retina: false });
  const src2x = mapStaticUrl(pins, { ...base, retina: true });
  return { src, srcSet: `${src} 1x, ${src2x} 2x` };
}

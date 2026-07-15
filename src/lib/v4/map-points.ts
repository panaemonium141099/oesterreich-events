/**
 * fn-16 Client-Teil: Points-Snapshot für /map.
 *
 * /api/events/map-points liefert ALLE publizierbaren Future-AT-Events als
 * columnar jsonb (~5 MB raw / ~1,5 MB brotli, CDN-gecacht 15 min) — EIN
 * Request statt der ~30 sequenziellen /api/events?limit=3000-Batches
 * (~45 MB, 30+ s, je 10-13 s DB-Zeit; Messung in Spec fn-16).
 *
 * decode() macht daraus schlanke Pseudo-Event-Objekte: KEIN title/image/
 * slug/location_name — die Karte rendert Marker aus Kategorie-Fallback-
 * Bildern, und das Hover-Popup lädt das volle Event lazy über
 * /api/events/[id] (CDN 1 h) nach. Die Liste (/entdecken) bleibt auf dem
 * Batch-Pfad, weil sie Titel + Bilder braucht.
 *
 * Cache bewusst NUR in-memory (Modul-Scope): der Payload sprengt die
 * 5-MB-sessionStorage-Quota (Spec-Edge-Case); HTTP/CDN-Cache übernimmt
 * die Persistenz zwischen Navigationen.
 */
import type { Event, EventFilters } from '@/types/events';

interface MapPointsPayload {
  v: number;
  n: number;
  generatedAt?: string;
  ids: string[];
  lat: number[];
  lng: number[];
  cat: number[];
  cats: string[];
  start: number[]; // Tage seit 2026-01-01
  end: number[];   // 0 = kein end_date
  bl: number[];
  bls: string[];
  district: number[];
  districts: string[];
  tier: number[];
  tiers: string[];
  flags: number[]; // bit0 boosted, bit1 student, bit2 family, bit3 gratis
  score: number[];
}

/** Referenz-Epoche der start/end-Day-Offsets (siehe RPC get_event_map_points). */
const EPOCH_MS = Date.UTC(2026, 0, 1);

function dayToIso(day: number): string {
  return new Date(EPOCH_MS + day * 86_400_000).toISOString();
}

/**
 * Kann der aktuelle Filter-Satz komplett client-seitig über die Punkte
 * beantwortet werden? Bundesland/District/Kategorie/Datum/PriceTier/
 * Student/Family filtert der Hook selbst; alles andere (Volltext, Tags,
 * bbox/Ort, eveningOnly — Punkte haben nur Tagesgenauigkeit —, Preis-
 * Zahlenwerte, DE/CH) braucht den Server-Pfad.
 */
export function pointsEligible(filters: EventFilters): boolean {
  return (
    filters.atOnly !== false &&
    !(filters.tags && filters.tags.length > 0) &&
    !filters.search &&
    !filters.bbox &&
    !filters.placeName &&
    !filters.placePostalCode &&
    !filters.eveningOnly &&
    !filters.sourceName &&
    filters.priceMin === undefined &&
    filters.priceMax === undefined
  );
}

/** Punkte sind Event-Objekte mit title=null — Konsumenten (Popup) erkennen
 *  sie daran und laden das volle Event nach. */
export type PointEvent = Event;

function decode(p: MapPointsPayload): PointEvent[] {
  const out = new Array<PointEvent>(p.n);
  for (let i = 0; i < p.n; i++) {
    const flags = p.flags[i] ?? 0;
    out[i] = {
      id: p.ids[i],
      title: null,
      slug: null,
      latitude: p.lat[i],
      longitude: p.lng[i],
      category: p.cats[p.cat[i]] || null,
      start_date: dayToIso(p.start[i]),
      end_date: p.end[i] ? dayToIso(p.end[i]) : null,
      bundesland: p.bls[p.bl[i]] || null,
      district: p.districts[p.district[i]] || null,
      price_tier: p.tiers[p.tier[i]] || null,
      price_text: flags & 8 ? 'gratis' : null,
      event_score: p.score[i],
      is_boosted: !!(flags & 1),
      is_student_friendly: !!(flags & 2),
      is_family_friendly: !!(flags & 4),
      image_url: null,
      location_name: null,
    } as unknown as PointEvent;
  }
  return out;
}

// ── In-Memory-Cache (Modul-Scope, TTL = CDN-Frische) ─────────────────────
const TTL_MS = 15 * 60 * 1000;
let cache: { at: number; events: PointEvent[] } | null = null;
let inflight: Promise<PointEvent[] | null> | null = null;

/**
 * Punkte laden (dedupliziert parallele Aufrufe, cached 15 min in-memory).
 * `null` bei Fehler oder leerem Snapshot → Aufrufer fällt auf die
 * Batch-Logik zurück (Spec-Edge-Case "MV leer/Refresh fehlgeschlagen").
 */
export async function fetchMapPointEvents(): Promise<PointEvent[] | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.events;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch('/api/events/map-points');
      if (!res.ok) return null;
      const payload = (await res.json()) as MapPointsPayload;
      if (!payload || payload.v !== 1 || !payload.n || !Array.isArray(payload.ids)) {
        return null;
      }
      const events = decode(payload);
      cache = { at: Date.now(), events };
      return events;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

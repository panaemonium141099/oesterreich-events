/**
 * Pick top events for a user's lifecycle email.
 *
 * Strategy:
 *   - Weekend cohort  : start_date in this weekend (Fri 00:00 → Sun 23:59 local)
 *   - Welcome / React : start_date in next 14 days (broader, "first 2 weeks")
 *   - Always filtered by bbox around the user's resolved location (or
 *     nation-wide if location is null)
 *   - Sort by event_score DESC, take top 5
 *   - Dedupe by venue (max 1 per venue) so 5 different gigs at the same
 *     concert hall don't dominate the list
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { bboxFromCenter, type ResolvedLocation } from './location-resolver';
import type { LifecycleCohort } from './cohort-detector';
import type { LifecycleEmailEvent } from '@/emails/lifecycle-weekend';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

// Real `events` table columns. There is NO `venue`, NO `start_time`, NO `slug`,
// NO `city`. The location string the email shows is `location_name` (the venue
// or place text), the city comes from joining `venues` or — for the email's
// purposes — from formatting postal_code + bundesland. URLs are built with
// buildEventUrlV2() which derives the slug from title at render time.
interface DbEventRow {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  district: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  ticket_url: string | null;
  category: string | null;
}

interface PickEventsArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  cohort: LifecycleCohort;
  location: ResolvedLocation | null;
  now: Date;
  /** Max events returned (default 5). */
  limit?: number;
}

export async function pickLifecycleEvents(args: PickEventsArgs): Promise<LifecycleEmailEvent[]> {
  const { supabase, cohort, location, now, limit = 5 } = args;

  // Date window
  const start = startOfWindow(cohort, now);
  const end = endOfWindow(cohort, now);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('events')
    .select('id,title,start_date,location_name,address,postal_code,district,bundesland,latitude,longitude,image_url,ticket_url,category')
    .gte('start_date', start.toISOString().slice(0, 10))
    .lte('start_date', end.toISOString().slice(0, 10))
    .not('image_url', 'is', null)
    .order('event_score', { ascending: false, nullsFirst: false })
    .limit(limit * 4); // overfetch — we filter & dedupe client-side

  if (location) {
    const bb = bboxFromCenter(location.lat, location.lng, location.radius_km);
    query = query
      .gte('latitude', bb.minLat)
      .lte('latitude', bb.maxLat)
      .gte('longitude', bb.minLng)
      .lte('longitude', bb.maxLng);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[pickLifecycleEvents] query failed', {
      message: error.message,
      cohort,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      hasLocation: !!location,
    });
    return [];
  }
  if (!data) return [];

  const rows = data as DbEventRow[];

  // Dedupe by location_name (keep first = highest score). We overfetch
  // intentionally so the HEAD-validation step below has fall-backs when
  // some image URLs turn out to be broken / too heavy.
  const seenVenues = new Set<string>();
  const candidates: DbEventRow[] = [];
  for (const r of rows) {
    if (candidates.length >= limit * 2) break;
    const venueKey = (r.location_name || r.district || '').toLowerCase();
    if (venueKey && seenVenues.has(venueKey)) continue;
    if (venueKey) seenVenues.add(venueKey);
    candidates.push(r);
  }

  // HEAD-validate every candidate image URL in parallel. The lifecycle
  // template references our /api/img proxy (which itself has a placeholder
  // fallback), but we still want to actively prefer events whose source
  // image is reachable — that way we don't fill the "compact picks" list
  // with 5 placeholder cards in the rare case of a regional upstream outage.
  // Timeout per HEAD: 2.5s. Total bounded by Promise.all to one round-trip
  // worth of latency per cron user.
  const validated = await Promise.all(
    candidates.map(async (r) => {
      const ok = await isImageHealthy(r.image_url);
      return ok ? r : { ...r, image_url: null };
    }),
  );

  // Prefer images-OK ones first, then fall back to placeholder events.
  validated.sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url));
  return validated.slice(0, limit).map(toEmailEvent);
}

/**
 * Probe an image URL with a HEAD request. Considered healthy when:
 *   - HTTP 2xx
 *   - Content-Type starts with image/
 *   - Content-Length is missing OR ≤ MAX_IMAGE_BYTES
 *
 * Anything larger than 800 KB gets dropped because Gmail's image-proxy
 * sometimes fails to fetch heavy upstream images during a mass mailing,
 * which produces broken-img icons in the recipient's inbox. Our resizer
 * (/api/img) will reduce it anyway, but we'd still rather pick an event
 * whose source isn't borderline.
 */
const MAX_IMAGE_BYTES = 800_000;
const HEAD_TIMEOUT_MS = 2500;

async function isImageHealthy(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.startsWith('image/')) return false;
    const lenStr = res.headers.get('content-length');
    if (lenStr) {
      const len = Number(lenStr);
      if (Number.isFinite(len) && len > MAX_IMAGE_BYTES) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function startOfWindow(cohort: LifecycleCohort, now: Date): Date {
  if (cohort === 'weekend') {
    // From Friday 00:00 local (CET) to Sunday 23:59 local
    return nextFriday(now);
  }
  // Welcome + Reactivation: now → +14d
  return startOfDay(now);
}

function endOfWindow(cohort: LifecycleCohort, now: Date): Date {
  if (cohort === 'weekend') {
    const fri = nextFriday(now);
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);
    sun.setHours(23, 59, 59, 999);
    return sun;
  }
  const end = startOfDay(now);
  end.setDate(end.getDate() + 14);
  return end;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Returns the next (or current) Friday at 00:00. */
function nextFriday(from: Date): Date {
  const r = startOfDay(from);
  const day = r.getDay(); // 0=Sun..6=Sat
  // Friday = 5. If today is Sat/Sun, the "weekend" is today (already started).
  const daysToFri = day === 5 ? 0 : day === 6 || day === 0 ? -((day + 2) % 7) : 5 - day;
  r.setDate(r.getDate() + daysToFri);
  return r;
}

function toEmailEvent(r: DbEventRow): LifecycleEmailEvent {
  // Always route images through /api/img/[eventId]:
  //   - upstream sizes get capped to (640×320 hero / 160×160 compact)
  //   - upstream failures fall back to a category-tinted placeholder so the
  //     email never shows a broken-img icon
  //   - all images now come from lasstreffen.at → cleaner sender alignment,
  //     better deliverability (no cross-domain hotlinking in the HTML)
  //
  // The lifecycle template doesn't know whether a row is going to be the
  // hero or in the compact list, so it appends its own ?w=&h= per slot
  // (see lifecycle-weekend.tsx). Here we just emit the base URL.
  const proxyBase = `https://lasstreffen.at/api/img/${r.id}`;

  return {
    title: r.title,
    date: formatDateDE(r.start_date),
    dayChip: dayChipFromIso(r.start_date),
    // No start_time column in events — emails just show the date.
    venueName: r.location_name ?? undefined,
    city: r.district ?? undefined,
    imageUrl: proxyBase,
    eventPageUrl: `https://lasstreffen.at${buildEventUrlV2({
      id: r.id,
      start_date: r.start_date,
      postal_code: r.postal_code,
      bundesland: r.bundesland,
      location_name: r.location_name,
      address: r.address,
    })}`,
    category: r.category ?? undefined,
  };
}

function formatDateDE(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-AT', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
}

const DE_MONTHS = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
const DE_WEEKDAYS = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];

function dayChipFromIso(iso: string): { dayName: string; dayNum: string; monthShort: string } | undefined {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    return {
      dayName: DE_WEEKDAYS[d.getDay()],
      dayNum: String(d.getDate()),
      monthShort: DE_MONTHS[d.getMonth()],
    };
  } catch {
    return undefined;
  }
}

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

interface DbEventRow {
  id: string;
  title: string;
  start_date: string;
  start_time: string | null;
  venue: string | null;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  image_url: string | null;
  ticket_url: string | null;
  category: string | null;
  slug: string | null;
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
    .select('id,title,start_date,start_time,venue,city,postal_code,address,bundesland,image_url,ticket_url,category,slug')
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
  if (error || !data) return [];

  const rows = data as DbEventRow[];

  // Dedupe by venue (keep first = highest score)
  const seenVenues = new Set<string>();
  const picked: DbEventRow[] = [];
  for (const r of rows) {
    if (picked.length >= limit) break;
    const venueKey = (r.venue || r.city || '').toLowerCase();
    if (venueKey && seenVenues.has(venueKey)) continue;
    if (venueKey) seenVenues.add(venueKey);
    picked.push(r);
  }

  return picked.map(toEmailEvent);
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
  return {
    title: r.title,
    date: formatDateDE(r.start_date),
    dayChip: dayChipFromIso(r.start_date),
    time: r.start_time ? r.start_time.slice(0, 5) : undefined,
    venueName: r.venue ?? undefined,
    city: r.city ?? undefined,
    imageUrl: r.image_url ?? undefined,
    eventPageUrl: buildEventUrl(r),
    category: r.category ?? undefined,
  };
}

function buildEventUrl(r: DbEventRow): string {
  // Prefer the SEO-friendly URL when we have the parts; fall back to /events/{id}.
  if (r.slug && r.postal_code && r.city && r.start_date) {
    const city = slugify(r.city);
    return `https://lasstreffen.at/events/${r.postal_code}-${city}/${r.start_date}/${r.slug}`;
  }
  return `https://lasstreffen.at/events/${r.id}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

/**
 * Spielstätten-Zuordnung je Gruppe (fn-25, Review §4/§10): eine Bestätigung
 * für „Quelle X nennt Spielstätte Y in Ort Z" wirkt auf alle künftigen
 * Events der Gruppe und auf jeden späteren Sync, statt Event für Event.
 *
 * GET  /api/admin/ortsdaten/venue-map?source=&name=&plz=&city=
 *      → Kandidaten aus dem OSM-Bestand (`venues`) im selben PLZ-Gebiet bzw.
 *        Ort, nach Namensähnlichkeit sortiert; dazu Schlüssel und Anzahl
 *        der betroffenen Events. Vorschläge, keine Entscheidung.
 * POST /api/admin/ortsdaten/venue-map
 *      { source_name, location_name, postal_code?, city?, latitude, longitude,
 *        precision?, venue_id?, evidence, reason? }
 *      → schreibt `source_venue_map` mit dem Namensschlüssel und entscheidet
 *        die Events der Gruppe sofort neu (Resolver + Vertrag).
 * DELETE /api/admin/ortsdaten/venue-map?source=&name=&plz=&city=
 *      → beendet die Gültigkeit der Zuordnung und entscheidet die Gruppe neu.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminWithCaller } from '@/lib/supabase/require-admin';
import { reResolveStoredEvents, STORED_LOCATION_COLUMNS, inputFromStoredRow, type StoredEventLocationRow } from '@/lib/location/re-resolve';
import { venueMapKey, foldVenueNameForKey } from '@/lib/location/venue-key';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-index';

const PRECISIONS = new Set(['entrance', 'building', 'site', 'street', 'locality', 'municipality']);
const AT_BOX = { latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 };
/** OSM-Typen, die typischerweise Veranstaltungsorte sind (leichter Bonus). */
const EVENT_TYPES = new Set(['community_centre', 'theatre', 'arts_centre', 'place_of_worship', 'townhall', 'school', 'university', 'college', 'restaurant', 'hotel', 'pub', 'bar', 'nightclub', 'cafe', 'stadium', 'sports_centre', 'sports_hall', 'library', 'museum', 'cinema', 'events_venue', 'exhibition_centre', 'conference_centre', 'music_venue', 'castle', 'fire_station', 'kindergarten', 'social_facility', 'pitch', 'park']);

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function bigrams(s: string): Set<string> {
  const t = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Dice-Koeffizient über Buchstaben-Bigramme (0..1). */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return (2 * hit) / (A.size + B.size);
}

interface VenueRow { id: string; name: string; name_normalized: string | null; type: string | null; address: string | null; postal_code: string | null; city: string | null; latitude: number | null; longitude: number | null }

const BS = String.fromCharCode(92);
const likeEscape = (s: string) => s.replace(new RegExp('[' + BS + BS + '%_]', 'g'), m => BS + m);

async function groupRows(sb: ReturnType<typeof serviceClient>, source: string, name: string, key: string): Promise<StoredEventLocationRow[]> {
  const { data } = await sb
    .from('events')
    .select(STORED_LOCATION_COLUMNS)
    .eq('source_name', source)
    .ilike('location_name_raw', likeEscape(name))
    .gte('start_date', new Date().toISOString())
    .in('publish_status', ['published', 'published_low_confidence', 'needs_review'])
    .limit(1000);
  const rows = (data ?? []) as unknown as StoredEventLocationRow[];
  // Nur die Zeilen, deren Schlüssel wirklich dem bestätigten entspricht (PLZ/Ort).
  return rows.filter(r => venueMapKey(inputFromStoredRow(r)) === key);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminWithCaller();
  if ('error' in auth) return auth.error;
  const sp = new URL(request.url).searchParams;
  const source = sp.get('source')?.trim() ?? '';
  const name = sp.get('name')?.trim() ?? '';
  const plz = sp.get('plz')?.trim() || null;
  const city = sp.get('city')?.trim() || null;
  if (!source || !name) return NextResponse.json({ error: 'source und name fehlen' }, { status: 400 });
  const key = venueMapKey({ source_name: source, location_name: name, postal_code: plz, city });
  if (!key) return NextResponse.json({ error: 'kein Schlüssel bildbar' }, { status: 400 });
  const sb = serviceClient();

  let q = sb.from('venues').select('id, name, name_normalized, type, address, postal_code, city, latitude, longitude').not('latitude', 'is', null).limit(600);
  if (plz) q = q.eq('postal_code', plz);
  else if (city) q = q.ilike('city', city);
  else return NextResponse.json({ key, candidates: [], events: 0, note: 'ohne PLZ oder Ort keine Kandidatensuche' });
  const { data: venues, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const folded = foldVenueNameForKey(name);
  const candidates = ((venues ?? []) as VenueRow[])
    .map(v => {
      const vn = foldVenueNameForKey(v.name_normalized ?? v.name);
      let score = similarity(folded, vn);
      if (vn.includes(folded) || folded.includes(vn)) score = Math.max(score, 0.8);
      if (v.type && EVENT_TYPES.has(v.type)) score += 0.05;
      return { venue_id: v.id, name: v.name, type: v.type, address: v.address, postal_code: v.postal_code, city: v.city, latitude: v.latitude, longitude: v.longitude, score: Math.round(score * 100) / 100 };
    })
    .filter(c => c.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const { count } = await sb.from('events').select('id', { count: 'exact', head: true }).eq('source_name', source).ilike('location_name_raw', likeEscape(name)).gte('start_date', new Date().toISOString());
  const { data: existing } = await sb.from('source_venue_map').select('source_venue_id, latitude, longitude, precision, confirmed_by, evidence, valid_to').eq('source_venue_id', key).maybeSingle();
  return NextResponse.json({ key, events: count ?? 0, candidates, existing: existing ?? null, city_key: city ? normalizeGemeindeName(city) : null });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminWithCaller();
  if ('error' in auth) return auth.error;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON erwartet' }, { status: 400 });
  }
  const source = typeof body.source_name === 'string' ? body.source_name.trim() : '';
  const name = typeof body.location_name === 'string' ? body.location_name.trim() : '';
  const plz = typeof body.postal_code === 'string' && /^\d{4}$/.test(body.postal_code) ? body.postal_code : null;
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null;
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const precision = typeof body.precision === 'string' && PRECISIONS.has(body.precision) ? body.precision : 'building';
  const evidence = typeof body.evidence === 'string' ? body.evidence.trim() : '';
  const venueId = typeof body.venue_id === 'string' && body.venue_id ? body.venue_id : null;
  if (!source || !name) return NextResponse.json({ error: 'source_name/location_name fehlen' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'latitude/longitude fehlen' }, { status: 400 });
  if (lat < AT_BOX.latMin || lat > AT_BOX.latMax || lng < AT_BOX.lngMin || lng > AT_BOX.lngMax) return NextResponse.json({ error: 'Position liegt außerhalb Österreichs' }, { status: 400 });
  if (evidence.length < 3) return NextResponse.json({ error: 'Beleg fehlt (z. B. OSM-Kandidat, Website, Adresse)' }, { status: 400 });
  const key = venueMapKey({ source_name: source, location_name: name, postal_code: plz, city });
  if (!key) return NextResponse.json({ error: 'kein Schlüssel bildbar' }, { status: 400 });

  const sb = serviceClient();
  const { error } = await sb.from('source_venue_map').upsert({
    source_venue_id: key,
    venue_id: venueId,
    latitude: lat,
    longitude: lng,
    precision,
    confirmed_by: `admin:${auth.caller.id}`,
    evidence,
    valid_from: new Date().toISOString(),
    valid_to: null,
    notes: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null,
  }, { onConflict: 'source_venue_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = await groupRows(sb, source, name, key);
  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const res = await reResolveStoredEvents(sb, rows.slice(i, i + 100), { phase: 'admin-venue-map' });
    written += res.filter(r => r.written).length;
  }
  return NextResponse.json({ key, group_events: rows.length, written });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWithCaller();
  if ('error' in auth) return auth.error;
  const sp = new URL(request.url).searchParams;
  const source = sp.get('source')?.trim() ?? '';
  const name = sp.get('name')?.trim() ?? '';
  const key = venueMapKey({ source_name: source, location_name: name, postal_code: sp.get('plz')?.trim() || null, city: sp.get('city')?.trim() || null });
  if (!key) return NextResponse.json({ error: 'source/name fehlen' }, { status: 400 });
  const sb = serviceClient();
  const { data, error } = await sb.from('source_venue_map').update({ valid_to: new Date().toISOString() }).eq('source_venue_id', key).is('valid_to', null).select('source_venue_id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Zuordnung nicht gefunden oder bereits beendet' }, { status: 404 });
  const rows = await groupRows(sb, source, name, key);
  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const res = await reResolveStoredEvents(sb, rows.slice(i, i + 100), { phase: 'admin-venue-map-revoked' });
    written += res.filter(r => r.written).length;
  }
  return NextResponse.json({ revoked: key, group_events: rows.length, written });
}

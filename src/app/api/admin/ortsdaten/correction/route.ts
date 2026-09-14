/**
 * Manuelle Ortskorrektur für ein Event (fn-25, Review §7).
 *
 * Eine Korrektur braucht Geltungsbereich (hier: genau ein Event), Beleg und
 * Gültigkeit. Sie wird in `event_location_corrections` protokolliert
 * (vorher/nachher, Grund, Beleg, wer, ab wann) und sofort über denselben
 * Resolver angewendet wie jeder Sync. Gespeichert wird dabei der
 * Ortsangaben-Hash des aktuellen Quellenstands: Liefert die Quelle später
 * andere Ortsangaben (Verlegung), gilt die Korrektur nicht mehr und die
 * Entscheidung wird neu getroffen.
 *
 * POST   /api/admin/ortsdaten/correction
 *        { event_id, latitude, longitude, precision?, venue_id?, location_name?,
 *          postal_code?, reason, evidence?, valid_to? }
 * DELETE /api/admin/ortsdaten/correction?id=<correction id>
 *        beendet die Gültigkeit (valid_to = jetzt) und entscheidet neu.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminWithCaller } from '@/lib/supabase/require-admin';
import { inputFromStoredRow, reResolveStoredEvents, STORED_LOCATION_COLUMNS, type StoredEventLocationRow } from '@/lib/location/re-resolve';
import { locationBasisHash } from '@/lib/location/conservative-resolution';
import { RESOLVER_VERSION } from '@/lib/location/resolver';

const PRECISIONS = new Set(['entrance', 'building', 'site', 'street', 'locality', 'municipality']);
const AT_BOX = { latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 };

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function loadRow(sb: ReturnType<typeof serviceClient>, id: string): Promise<StoredEventLocationRow | null> {
  const { data } = await sb.from('events').select(STORED_LOCATION_COLUMNS).eq('id', id).maybeSingle();
  return (data as unknown as StoredEventLocationRow | null) ?? null;
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
  const eventId = typeof body.event_id === 'string' ? body.event_id : '';
  const lat = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
  const lng = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const precision = typeof body.precision === 'string' && PRECISIONS.has(body.precision) ? body.precision : 'building';
  const country = typeof body.country === 'string' ? body.country : 'AT';
  if (!eventId) return NextResponse.json({ error: 'event_id fehlt' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: 'latitude/longitude fehlen' }, { status: 400 });
  if (country === 'AT' && (lat < AT_BOX.latMin || lat > AT_BOX.latMax || lng < AT_BOX.lngMin || lng > AT_BOX.lngMax)) {
    return NextResponse.json({ error: 'Position liegt außerhalb Österreichs' }, { status: 400 });
  }
  if (reason.length < 5) return NextResponse.json({ error: 'Grund fehlt' }, { status: 400 });
  const postal = typeof body.postal_code === 'string' && /^\d{4}$/.test(body.postal_code) ? body.postal_code : null;
  const validTo = typeof body.valid_to === 'string' && !Number.isNaN(Date.parse(body.valid_to)) ? new Date(body.valid_to).toISOString() : null;

  const sb = serviceClient();
  const row = await loadRow(sb, eventId);
  if (!row) return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });

  const input = inputFromStoredRow(row);
  const before = {
    latitude: row.latitude,
    longitude: row.longitude,
    location_status: row.location_status,
    geocoding_confidence: row.geocoding_confidence,
    location_name: row.location_name,
    postal_code: row.postal_code,
    location_basis_hash: locationBasisHash(input),
    input_hash: row.location_resolution?.input_hash ?? null,
  };
  const after = {
    latitude: lat,
    longitude: lng,
    precision,
    venue_id: typeof body.venue_id === 'string' && body.venue_id ? body.venue_id : null,
    location_name: typeof body.location_name === 'string' && body.location_name.trim() ? body.location_name.trim() : null,
    postal_code: postal,
  };
  const { data: inserted, error } = await sb
    .from('event_location_corrections')
    .insert({
      scope: 'event',
      scope_id: eventId,
      before,
      after,
      reason,
      evidence: typeof body.evidence === 'string' && body.evidence.trim() ? body.evidence.trim() : null,
      corrected_by: `admin:${auth.caller.id}`,
      valid_to: validTo,
      resolver_version: RESOLVER_VERSION,
    })
    .select('id')
    .single();
  if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'Korrektur nicht gespeichert' }, { status: 500 });

  const [result] = await reResolveStoredEvents(sb, [row], { phase: 'admin-correction' });
  return NextResponse.json({
    correction_id: inserted.id,
    written: result?.written ?? false,
    skipped_reason: result?.skipped_reason ?? null,
    decision: result?.decision ?? null,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWithCaller();
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 });
  const sb = serviceClient();
  const { data: corr, error } = await sb
    .from('event_location_corrections')
    .update({ valid_to: new Date().toISOString() })
    .eq('id', id)
    .eq('scope', 'event')
    .is('valid_to', null)
    .select('scope_id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!corr) return NextResponse.json({ error: 'Korrektur nicht gefunden oder bereits beendet' }, { status: 404 });
  const row = await loadRow(sb, corr.scope_id);
  const result = row ? (await reResolveStoredEvents(sb, [row], { phase: 'admin-correction-revoked' }))[0] : null;
  return NextResponse.json({ revoked: id, written: result?.written ?? false, decision: result?.decision ?? null });
}

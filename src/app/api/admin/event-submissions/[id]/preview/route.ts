/**
 * POST /api/admin/event-submissions/[id]/preview
 *
 * Vorschau eines Inserats vor der Freigabe: liefert das Event so, wie es
 * die Freigabe mit denselben Korrekturen anlegen würde — ohne zu schreiben.
 *
 * Body: { edits?: {...} }   (dieselben Schlüssel wie bei der Freigabe)
 *
 * Antwort: { event, geocodedFrom, needsCoordinates, tried }
 *
 * Die Koordinaten werden hier schon aufgelöst, damit der Admin in der
 * Vorschau sieht, ob die Adresse trägt — der Geocoder cacht, die Freigabe
 * danach kostet keine zweite Nominatim-Anfrage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/supabase/require-admin';
import type { ApprovableSubmission } from '@/lib/inserate/approve';
import { buildPreviewEvent } from '@/lib/inserate/preview';
import { extractEdits, resolveSubmissionCoordinates } from '@/lib/inserate/review-input';

export const dynamic = 'force-dynamic';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = getServiceClient();
  const { data: submission, error: loadError } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (loadError) {
    console.error('[admin/event-submissions] preview load failed:', loadError);
    return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: 'Inserat nicht gefunden' }, { status: 404 });
  }

  const edits = extractEdits(body.edits);
  const merged = { ...submission, ...edits } as ApprovableSubmission;

  if (!merged.title || merged.title.trim().length < 3) {
    return NextResponse.json({ error: 'Der Titel darf nicht leer sein.' }, { status: 400 });
  }

  const coords = await resolveSubmissionCoordinates(merged);
  const event = buildPreviewEvent(merged, {
    latitude: coords.latitude,
    longitude: coords.longitude,
    coords_precision: coords.coordsPrecision,
  });

  return NextResponse.json({
    event,
    geocodedFrom: coords.geocodedFrom,
    needsCoordinates: coords.latitude === null,
    tried: coords.tried,
  });
}

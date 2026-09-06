/**
 * fn-23: Absagen / Verschiebungen pflegen (schema.org eventStatus).
 *
 * Google verlangt bei einem abgesagten Event, dass die Seite ONLINE BLEIBT
 * und `eventStatus` auf EventCancelled steht — die Seite zu löschen oder den
 * Status stillschweigend zu lassen kostet die Rich Results. Diese Route ist
 * der Schreibpfad dafür; gelesen wird der Status in
 * src/lib/seo/event-schema.ts.
 *
 * PATCH /api/admin/events/{id}/event-status
 *   { "event_status": "cancelled" }
 *   { "event_status": "rescheduled", "previous_start_date": "2026-10-01T17:00:00Z" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/require-admin';

const ALLOWED_EVENT_STATUSES = [
  'scheduled',
  'cancelled',
  'postponed',
  'rescheduled',
  'moved_online',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const { event_status, previous_start_date } = body as {
      event_status?: string;
      previous_start_date?: string | null;
    };

    if (!event_status || !ALLOWED_EVENT_STATUSES.includes(event_status as never)) {
      return NextResponse.json(
        { error: `Ungültiger event_status. Erlaubt: ${ALLOWED_EVENT_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // `previousStartDate` ist bei EventRescheduled ein Google-Pflichtfeld.
    // Ohne den alten Termin ist die Verschiebung für Google unvollständig,
    // deshalb hier hart verlangt statt still zu schlucken.
    if (event_status === 'rescheduled' && !previous_start_date) {
      return NextResponse.json(
        { error: 'previous_start_date ist bei event_status=rescheduled Pflicht (Google: previousStartDate).' },
        { status: 400 }
      );
    }

    if (previous_start_date && isNaN(new Date(previous_start_date).getTime())) {
      return NextResponse.json(
        { error: 'previous_start_date ist kein gültiges Datum.' },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = { event_status };
    if (event_status === 'rescheduled') {
      patch.previous_start_date = previous_start_date;
    } else if (event_status === 'scheduled') {
      // Zurück auf planmässig → alten Termin aufräumen, sonst bliebe ein
      // verwaistes previousStartDate im Schema stehen.
      patch.previous_start_date = null;
    }

    const supabase = await createServerSupabaseClient();

    // `.select()` erzwingt eine Antwort mit den geschriebenen Zeilen:
    // supabase-js meldet bei einem Update ohne Treffer sonst Erfolg, obwohl
    // nichts geschrieben wurde.
    const { data, error } = await supabase
      .from('events')
      .update(patch)
      .eq('id', id)
      .select('id, event_status, previous_start_date');

    if (error) {
      console.error('Update event status error:', error);
      return NextResponse.json({ error: 'Fehler beim Aktualisieren des Event-Status' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
    }

    return NextResponse.json({ success: true, event: data[0] });
  } catch (err) {
    console.error('Event status error:', err);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Event-Status' }, { status: 500 });
  }
}

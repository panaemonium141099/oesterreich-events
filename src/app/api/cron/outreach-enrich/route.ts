import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scrapeContact } from '@/lib/outreach/enrich';
import { linkListedEvents } from '@/lib/outreach/link-events';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PER_RUN = 30;

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: prospects } = await supabase
    .from('outreach_prospects')
    .select('id, domain')
    .eq('status', 'discovered')
    .order('created_at', { ascending: true })
    .limit(PER_RUN);

  let withEmail = 0;
  let withEvents = 0;
  for (const p of (prospects ?? []) as Array<{ id: string; domain: string }>) {
    const [contact, events] = await Promise.all([
      scrapeContact(p.domain),
      linkListedEvents(supabase, p.domain, 5),
    ]);
    if (contact.email) withEmail += 1;
    if (events.length > 0) withEvents += 1;

    await supabase.from('outreach_prospects').update({
      email: contact.email,
      contact_url: contact.contactUrl,
      source_event_ids: events.map((e) => e.id),
      personalization: { events },
      status: 'enriched',
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);
  }

  return NextResponse.json({
    ok: true,
    processed: prospects?.length ?? 0,
    withEmail,
    withEvents,
  });
}

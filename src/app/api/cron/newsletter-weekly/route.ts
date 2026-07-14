/**
 * GET /api/cron/newsletter-weekly — Wochen-Digest pro Region (Freitag 06:00 UTC).
 *
 * Für jede Region mit bestätigten, nicht abgemeldeten Abonnenten:
 * Top-Events des kommenden Wochenendes (Fr–So, event_score-sortiert,
 * Titel-dedupe) via cookie-freiem Anon-Client, gerendert mit dem
 * city-digest-Template, versendet einzeln über Brevo (jede Mail mit
 * individuellem HMAC-Unsubscribe-Link — DSGVO).
 *
 * Volumen-Hinweis: Brevo-Free = 300 Mails/Tag. Bei > ~250 Abonnenten
 * Brevo-Plan upgraden oder Versand über mehrere Tage verteilen
 * (last_sent_at ist dafür schon da).
 *
 * Auth: CRON_SECRET Bearer (Vercel-Cron-Muster wie sync-feratel).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '@/lib/email';
import { renderCityDigestEmail } from '@/emails/city-digest';
import { newsletterToken, regionLabel, regionToBundeslandFilter, NEWSLETTER_REGIONS } from '@/lib/newsletter';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const EVENTS_PER_MAIL = 8;

interface DigestEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  postal_code: string | null;
  address: string | null;
  bundesland: string | null;
  image_url: string | null;
  ticket_url: string | null;
  source_name: string | null;
}

function fmt(iso: string): { date: string; time?: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return time === '00:00' ? { date } : { date, time };
}

async function fetchWeekendEvents(region: string): Promise<DigestEvent[]> {
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  // Fenster: jetzt bis Ende Sonntag (Cron läuft freitags)
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
  sunday.setHours(23, 59, 59, 999);

  let q = anon
    .from('events')
    .select('id, slug, title, start_date, location_name, postal_code, address, bundesland, image_url, ticket_url, source_name')
    .eq('visibility', 'public')
    .eq('publish_status', 'published')
    .gte('start_date', now.toISOString())
    .lte('start_date', sunday.toISOString())
    .order('event_score', { ascending: false, nullsFirst: false })
    .limit(EVENTS_PER_MAIL * 3);
  const bl = regionToBundeslandFilter(region);
  if (bl) q = q.eq('bundesland', bl);

  const { data, error } = await q;
  if (error) {
    console.error(`[newsletter-weekly] events query failed (${region}):`, error);
    return [];
  }
  // Titel-Dedupe (Serien-Events), dann kappen
  const seen = new Set<string>();
  const out: DigestEvent[] = [];
  for (const e of (data ?? []) as DigestEvent[]) {
    const key = e.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= EVENTS_PER_MAIL) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'missing service key' }, { status: 503 });
  }

  const started = Date.now();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { data: subs, error } = await admin
    .from('newsletter_subscribers')
    .select('email, bundesland')
    .not('confirmed_at', 'is', null)
    .is('unsubscribed_at', null)
    .limit(500);
  if (error) {
    console.error('[newsletter-weekly] subscriber query failed:', error);
    return NextResponse.json({ error: 'subscriber query failed' }, { status: 500 });
  }

  // Events je Region EINMAL holen, dann an alle Abonnenten der Region senden
  const regions = [...new Set((subs ?? []).map(s => s.bundesland as string))]
    .filter(r => r in NEWSLETTER_REGIONS);
  const eventsByRegion = new Map<string, DigestEvent[]>();
  for (const r of regions) {
    eventsByRegion.set(r, await fetchWeekendEvents(r));
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const sub of subs ?? []) {
    const events = eventsByRegion.get(sub.bundesland as string) ?? [];
    if (events.length < 3) { skipped++; continue; } // dünne Regionen: keine Mail statt leerer Mail

    const unsubToken = await newsletterToken('unsub', sub.email as string);
    const unsubscribeUrl = `https://lasstreffen.at/api/newsletter/unsubscribe?email=${encodeURIComponent(sub.email as string)}&token=${unsubToken}`;

    const html = renderCityDigestEmail({
      cityName: regionLabel(sub.bundesland as string),
      events: events.map(e => {
        const { date, time } = fmt(e.start_date);
        return {
          title: e.title,
          date,
          time,
          venueName: e.location_name ?? undefined,
          imageUrl: e.image_url ?? undefined,
          eventPageUrl: `https://lasstreffen.at${buildEventUrlV2(e)}`,
          // Affiliate-Deeplink (J70) nur bei Eventim — konsistent zur TicketBox
          ticketUrl: e.source_name === 'Eventim' && e.ticket_url ? e.ticket_url : undefined,
        };
      }),
      unsubscribeUrl,
      preferencesUrl: unsubscribeUrl,
    });

    const res = await sendGenericEmail(
      sub.email as string,
      `Deine Events fürs Wochenende — ${regionLabel(sub.bundesland as string)}`,
      html,
    );
    if (res.success) {
      sent++;
      await admin.from('newsletter_subscribers')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('email', sub.email as string);
    } else {
      failed++;
      console.error(`[newsletter-weekly] send failed (${sub.email}):`, res.error);
    }
  }

  const body = { ok: true, subscribers: subs?.length ?? 0, regions: regions.length, sent, skipped, failed, durationMs: Date.now() - started };
  console.log('[newsletter-weekly] done:', JSON.stringify(body));
  return NextResponse.json(body, { status: failed > 0 && sent === 0 ? 500 : 200 });
}

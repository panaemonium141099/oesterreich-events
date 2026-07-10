/**
 * POST /api/checkout/boost — Self-Service-Kauf eines Event-Boosts (29 €).
 *
 * Body: { eventRef: string } — lasstreffen.at-Event-URL, UUID oder Slug.
 * Antwort: { url } — Stripe-Checkout-URL für den Redirect.
 *
 * Ablauf + Sicherheitsmodell: siehe src/lib/payments/stripe-boost.ts.
 * Das Event wird hier nur NACHGESCHLAGEN (Anon-Client, published+public);
 * geboostet wird erst auf der Erfolgsseite nach serverseitiger
 * Zahlungs-Verifikation gegen Stripe.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, parseEventRef, BOOST_PRICE_CENTS } from '@/lib/payments/stripe-boost';

export const dynamic = 'force-dynamic';

interface BoostableEvent {
  id: string;
  title: string;
  start_date: string;
  is_boosted: boolean | null;
  boost_until: string | null;
}

export async function POST(req: NextRequest) {
  let body: { eventRef?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request' }, { status: 400 });
  }

  const ref = parseEventRef(body.eventRef ?? '');
  if (!ref) {
    return NextResponse.json(
      { error: 'Bitte gib den Link zu deinem Event auf lasstreffen.at an.' },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // Boostbar = Event ist heute oder in der Zukunft (Scraper speichern
  // tages-genaue Events auf 00:00 UTC — ein striktes start_date >= now()
  // schloss ALLE heutigen Events aus, live gefunden am 10.07.) ODER läuft
  // als mehrtägiges Event noch (end_date in der Zukunft).
  const now = new Date();
  const startOfTodayUtc = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z').toISOString();
  let q = supabase
    .from('events')
    .select('id, title, start_date, is_boosted, boost_until')
    .eq('visibility', 'public')
    .in('publish_status', ['published', 'published_low_confidence'])
    .or(`start_date.gte.${startOfTodayUtc},end_date.gte.${now.toISOString()}`)
    .order('start_date', { ascending: true })
    .limit(1);
  q = ref.id ? q.eq('id', ref.id) : q.eq('slug', ref.slug!);

  const { data, error } = await q;
  if (error) {
    console.error('[checkout/boost] lookup failed:', error);
    return NextResponse.json({ error: 'Suche fehlgeschlagen — bitte später erneut versuchen.' }, { status: 503 });
  }
  const event = (data?.[0] ?? null) as BoostableEvent | null;
  if (!event) {
    return NextResponse.json(
      { error: 'Kein kommendes Event unter diesem Link gefunden. Prüfe den Link (das Event muss auf lasstreffen.at sichtbar und in der Zukunft sein).' },
      { status: 404 },
    );
  }
  if (event.is_boosted && event.boost_until && new Date(event.boost_until) > new Date()) {
    return NextResponse.json(
      { error: `„${event.title}" ist bereits geboostet (bis ${new Date(event.boost_until).toLocaleDateString('de-AT')}).` },
      { status: 409 },
    );
  }

  try {
    const origin = req.nextUrl.origin;
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: BOOST_PRICE_CENTS,
            product_data: {
              name: `Event-Boost: ${event.title.slice(0, 80)}`,
              description: 'Hervorhebung auf Karte & Listen auf lasstreffen.at — Laufzeit bis einen Tag nach dem Event (max. 28 Tage).',
            },
          },
        },
      ],
      metadata: { event_id: event.id },
      success_url: `${origin}/fuer-firmen/boost/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/fuer-firmen#boost`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[checkout/boost] session create failed:', e);
    return NextResponse.json({ error: 'Checkout konnte nicht gestartet werden — bitte später erneut versuchen.' }, { status: 502 });
  }
}

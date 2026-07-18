/**
 * /fuer-firmen/boost/erfolg — Landing nach dem Stripe-Checkout.
 *
 * Verifiziert die Checkout-Session SERVERSEITIG gegen die Stripe-API
 * (payment_status === 'paid') und aktiviert erst dann den Boost. Der
 * Client liefert nur die session_id — fälschbar ist hier nichts, die
 * Wahrheit kommt von Stripe. Idempotent: erneutes Laden re-aktiviert
 * denselben Boost mit denselben Werten.
 *
 * Dynamische Seite (searchParams) — bewusst, hier gibt es nichts zu cachen.
 */

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getStripe, computeBoostUntil } from '@/lib/payments/stripe-boost';

export const dynamic = 'force-dynamic';

interface Result {
  ok: boolean;
  message: string;
  eventTitle?: string;
  boostUntil?: string;
}

async function activateBoost(sessionId: string): Promise<Result> {
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return { ok: false, message: 'Ungültige Checkout-Referenz.' };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: 'Server nicht vollständig konfiguriert — bitte melde dich unter dev@glatzdev.com.' };
  }

  // 1. Zahlungsstatus direkt bei Stripe erfragen
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (e) {
    console.error('[boost/erfolg] session retrieve failed:', e);
    return { ok: false, message: 'Checkout-Session nicht gefunden.' };
  }
  if (session.payment_status !== 'paid') {
    return { ok: false, message: 'Die Zahlung ist noch nicht abgeschlossen. Falls du bezahlt hast, lade die Seite in einer Minute neu.' };
  }
  const eventId = session.metadata?.event_id;
  if (!eventId) {
    return { ok: false, message: 'Der Zahlung ist kein Event zugeordnet — bitte melde dich unter dev@glatzdev.com.' };
  }

  // 2. Boost setzen (Service-Role — Spalten sind nicht anon-schreibbar)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data: event, error: readErr } = await admin
    .from('events')
    .select('id, title, start_date')
    .eq('id', eventId)
    .single();
  if (readErr || !event) {
    console.error('[boost/erfolg] event read failed:', readErr);
    return { ok: false, message: 'Event nicht gefunden — bitte melde dich unter dev@glatzdev.com (Zahlung ist bei uns registriert).' };
  }

  const boostUntil = computeBoostUntil(event.start_date as string);
  const { error: updErr } = await admin
    .from('events')
    .update({ is_boosted: true, boost_tier: 'boost', boost_until: boostUntil })
    .eq('id', eventId);
  if (updErr) {
    console.error('[boost/erfolg] boost update failed:', updErr);
    return { ok: false, message: 'Aktivierung fehlgeschlagen — bitte melde dich unter dev@glatzdev.com (Zahlung ist bei uns registriert).' };
  }

  console.log(`[boost/erfolg] boost aktiviert: event=${eventId} until=${boostUntil} session=${sessionId}`);
  return {
    ok: true,
    message: 'Dein Event-Boost ist aktiv!',
    eventTitle: event.title as string,
    boostUntil,
  };
}

export default async function BoostErfolgPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const result = await activateBoost(session_id ?? '');

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div
          className={`mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center border ${
            result.ok
              ? 'bg-green-500/15 border-green-400/40 text-green-400'
              : 'bg-amber-500/15 border-amber-400/40 text-amber-400'
          }`}
        >
          {result.ok ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          )}
        </div>

        <h1 className="text-3xl font-bold mb-3">{result.ok ? 'Boost aktiv!' : 'Da hakt etwas'}</h1>
        <p className="text-white/60 leading-relaxed mb-2">{result.message}</p>

        {result.ok && result.eventTitle && (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-2">Geboostetes Event</p>
            <p className="font-semibold text-lg">{result.eventTitle}</p>
            {result.boostUntil && (
              <p className="text-white/50 text-sm mt-2">
                Hervorgehoben bis{' '}
                {new Date(result.boostUntil).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}— auf der Karte (nie in Clustern versteckt) und ganz oben in den Listen, gekennzeichnet als „Anzeige".
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/map" className="px-5 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors">
            Zur Karte
          </Link>
          <Link href="/fuer-firmen" className="px-5 py-3 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors">
            Zurück zu den Paketen
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-10">
          Fragen oder Probleme? dev@glatzdev.com — die Zahlung ist über Stripe dokumentiert.
        </p>
      </div>
    </div>
  );
}

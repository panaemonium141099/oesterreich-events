'use client';

/**
 * BoostCheckoutForm — Self-Service-Kauf eines Event-Boosts (29 €) direkt
 * auf /fuer-firmen. Veranstalter fügt den Link zu seinem Event ein →
 * POST /api/checkout/boost → Redirect zum Stripe-Checkout. Aktivierung
 * passiert erst nach serverseitiger Zahlungs-Verifikation auf
 * /fuer-firmen/boost/erfolg.
 */

import { useState } from 'react';

export function BoostCheckoutForm() {
  const [eventRef, setEventRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!eventRef.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventRef }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Checkout konnte nicht gestartet werden.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={startCheckout} className="mt-6">
      <label htmlFor="boost-event-ref" className="block text-sm font-semibold mb-2">
        Link zu deinem Event auf lasstreffen.at
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="boost-event-ref"
          type="text"
          value={eventRef}
          onChange={(e) => setEventRef(e.target.value)}
          placeholder="https://lasstreffen.at/events/…"
          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
          required
        />
        <button
          type="submit"
          disabled={loading || !eventRef.trim()}
          data-track="boost_checkout_start"
          className="px-6 py-3 rounded-xl bg-amber-400 text-black font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? 'Einen Moment …' : 'Jetzt boosten — 29 €'}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-400/90 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-white/30">
        Sichere Zahlung über Stripe (Karte, Apple Pay, Google Pay). Preis zzgl. USt.
        Dein Event findest du über die Suche — kopiere einfach die Adresszeile.
      </p>
    </form>
  );
}

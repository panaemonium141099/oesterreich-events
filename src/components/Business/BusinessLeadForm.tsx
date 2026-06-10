'use client';

import { useState } from 'react';

const PLAN_OPTIONS = [
  { value: 'boost', label: 'Event-Boost (einzeln)' },
  { value: 'abo', label: 'Business-Abo' },
  { value: 'scraper', label: 'Live-Anbindung (Scraper)' },
  { value: 'unsure', label: 'Noch unsicher / Beratung' },
] as const;

const FIELD =
  'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors';

export function BusinessLeadForm({ initialPlan = 'unsure' }: { initialPlan?: string }) {
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [plan, setPlan] = useState<string>(initialPlan);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');

    try {
      const res = await fetch('/api/business/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, contactName, email, phone, website, plan, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Etwas ist schiefgelaufen. Bitte später erneut versuchen.');
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setError('Netzwerkfehler. Bitte später erneut versuchen.');
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-6 py-10 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-semibold mb-2">Danke für deine Anfrage!</h3>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Wir haben deine Anfrage erhalten und melden uns innerhalb von 1–2 Werktagen
          persönlich bei dir. Du kannst dieses Fenster jetzt schließen.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" id="kontakt">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/40 mb-1.5">Firma *</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Muster GmbH"
            required
            className={FIELD}
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1.5">Ansprechpartner:in *</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Max Mustermann"
            required
            className={FIELD}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-white/40 mb-1.5">E-Mail *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kontakt@firma.at"
            required
            className={FIELD}
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1.5">Telefon</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+43 ..."
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-white/40 mb-1.5">Website / Event-Seite</label>
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://www.firma.at/events"
          className={FIELD}
        />
      </div>

      <div>
        <label className="block text-xs text-white/40 mb-1.5">Interesse an</label>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className={`${FIELD} [color-scheme:dark]`}
        >
          {PLAN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-gray-900">
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-white/40 mb-1.5">Nachricht</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Erzähl uns kurz von euren Events …"
          rows={4}
          className={`${FIELD} resize-none`}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'sending' || !company || !contactName || !email}
        className="w-full py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {status === 'sending' ? (
          <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
        ) : (
          'Unverbindlich anfragen'
        )}
      </button>
      <p className="text-center text-xs text-white/30">
        Unverbindlich & kostenlos. Wir melden uns innerhalb von 1–2 Werktagen.
      </p>
    </form>
  );
}

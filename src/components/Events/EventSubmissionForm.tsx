'use client';

import { useState } from 'react';

/**
 * Öffentliches Inserat-Formular ("Event inserieren").
 *
 * Kategorien und Bundesländer stehen hier bewusst als Literale und werden
 * NICHT aus `@/lib/category-classifier/enrichment-taxonomy` bzw.
 * `@/lib/districtsAT` importiert: beide Module ziehen umfangreiche Tabellen
 * (alle Tags, alle Bezirke) nach sich, die sonst im Client-Bundle einer
 * ansonsten winzigen Formularseite landen. Gleiche Entscheidung wie in
 * CreateEventPageClient.tsx.
 *
 * Die Werte müssen zur Taxonomie passen — die API prüft sie gegen
 * PRIMARY_CATEGORIES und verwirft Unbekanntes nach 'Sonstiges'. Bei einer
 * Taxonomie-Änderung gehört diese Liste mitgezogen.
 */
const CATEGORIES = [
  'Musik',
  'Kultur & Bühne',
  'Nightlife & Party',
  'Essen & Trinken',
  'Märkte & Feste',
  'Sport & Bewegung',
  'Natur & Abenteuer',
  'Wissen & Karriere',
  'Familie & Kinder',
  'Community & Freizeit',
  'Wellness & Spiritualität',
  'Sonstiges',
] as const;

const BUNDESLAENDER: Array<[id: string, label: string]> = [
  ['wien', 'Wien'],
  ['niederoesterreich', 'Niederösterreich'],
  ['oberoesterreich', 'Oberösterreich'],
  ['salzburg', 'Salzburg'],
  ['steiermark', 'Steiermark'],
  ['kaernten', 'Kärnten'],
  ['tirol', 'Tirol'],
  ['vorarlberg', 'Vorarlberg'],
  ['burgenland', 'Burgenland'],
];

const FIELD =
  'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors';
const LABEL = 'block text-xs text-white/40 mb-1.5';
const SECTION = 'rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6 space-y-4';

export function EventSubmissionForm() {
  // Veranstaltung
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Sonstiges');
  const [description, setDescription] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [bundesland, setBundesland] = useState('');
  const [priceText, setPriceText] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [eventUrl, setEventUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Inserent
  const [submitterType, setSubmitterType] = useState<'company' | 'person'>('company');
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  // Honeypot — per CSS versteckt, für Menschen unerreichbar.
  const [fax, setFax] = useState('');

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');

    try {
      const res = await fetch('/api/events/inserat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          description,
          isAllDay,
          startDate,
          startTime,
          endDate,
          endTime,
          locationName,
          address,
          postalCode,
          bundesland,
          priceText,
          ticketUrl,
          eventUrl,
          imageUrl,
          submitterType,
          company,
          contactName,
          email,
          phone,
          website,
          message,
          rightsConfirmed,
          fax,
        }),
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
      <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-6 py-12 text-center">
        <h2 className="text-xl font-semibold mb-3">Danke — dein Inserat ist eingereicht.</h2>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Wir prüfen jede Einreichung von Hand. Sobald dein Event freigeschaltet ist,
          bekommst du eine E-Mail mit dem Link zur Veranstaltungsseite. Das dauert in
          der Regel ein bis zwei Werktage.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Veranstaltung ───────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium">
          Die Veranstaltung
        </h2>

        <div>
          <label htmlFor="ins-title" className={LABEL}>Titel *</label>
          <input
            id="ins-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Sommerfest im Schlosspark"
            required
            minLength={3}
            maxLength={200}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="ins-category" className={LABEL}>Kategorie</label>
          <select
            id="ins-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${FIELD} [color-scheme:dark]`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ins-description" className={LABEL}>Beschreibung</label>
          <textarea
            id="ins-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Was erwartet die Besucher:innen? Programm, Highlights, Besonderheiten …"
            className={`${FIELD} resize-y`}
          />
          <p className="mt-1.5 text-[11px] text-white/25">
            Bitte in eigenen Worten — kopierte Texte von anderen Seiten können wir nicht veröffentlichen.
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllDay}
            onChange={(e) => setIsAllDay(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-400"
          />
          Ganztägig (keine feste Uhrzeit)
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ins-start-date" className={LABEL}>Beginn — Datum *</label>
            <input
              id="ins-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className={`${FIELD} [color-scheme:dark]`}
            />
          </div>
          {!isAllDay && (
            <div>
              <label htmlFor="ins-start-time" className={LABEL}>Beginn — Uhrzeit</label>
              <input
                id="ins-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`${FIELD} [color-scheme:dark]`}
              />
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ins-end-date" className={LABEL}>Ende — Datum</label>
            <input
              id="ins-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`${FIELD} [color-scheme:dark]`}
            />
          </div>
          {!isAllDay && (
            <div>
              <label htmlFor="ins-end-time" className={LABEL}>Ende — Uhrzeit</label>
              <input
                id="ins-end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`${FIELD} [color-scheme:dark]`}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Ort ─────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium">
          Wo findet es statt?
        </h2>

        <div>
          <label htmlFor="ins-location" className={LABEL}>Veranstaltungsort</label>
          <input
            id="ins-location"
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="z.B. Schlosspark Esterházy"
            maxLength={200}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="ins-address" className={LABEL}>Adresse</label>
          <input
            id="ins-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Straße und Hausnummer"
            maxLength={300}
            className={FIELD}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ins-plz" className={LABEL}>PLZ</label>
            <input
              id="ins-plz"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="7000"
              maxLength={4}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="ins-bundesland" className={LABEL}>Bundesland</label>
            <select
              id="ins-bundesland"
              value={bundesland}
              onChange={(e) => setBundesland(e.target.value)}
              className={`${FIELD} [color-scheme:dark]`}
            >
              <option value="">— bitte wählen —</option>
              {BUNDESLAENDER.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-white/25">
          Je genauer die Adresse, desto sicherer landet dein Event auf der Karte.
        </p>
      </section>

      {/* ── Zusatzinfos ─────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium">
          Preis, Links & Bild
        </h2>

        <div>
          <label htmlFor="ins-price" className={LABEL}>Eintritt</label>
          <input
            id="ins-price"
            type="text"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="z.B. Eintritt frei / ab 15 €"
            maxLength={200}
            className={FIELD}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ins-event-url" className={LABEL}>Website zur Veranstaltung</label>
            <input
              id="ins-event-url"
              type="url"
              value={eventUrl}
              onChange={(e) => setEventUrl(e.target.value)}
              placeholder="https://…"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="ins-ticket-url" className={LABEL}>Ticket-Link</label>
            <input
              id="ins-ticket-url"
              type="url"
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              placeholder="https://…"
              className={FIELD}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ins-image-url" className={LABEL}>Bild-URL</label>
          <input
            id="ins-image-url"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… (direkter Link zum Bild, mind. 600 px breit)"
            className={FIELD}
          />
          <p className="mt-1.5 text-[11px] text-white/25">
            Wir laden keine Dateien hoch — bitte den direkten Link zu einem Bild angeben,
            das du selbst verwenden darfst.
          </p>
        </div>
      </section>

      {/* ── Inserent ────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className="text-sm uppercase tracking-wider text-white/40 font-medium">
          Wer inseriert?
        </h2>

        <div className="flex gap-2">
          {([
            ['company', 'Firma / Verein'],
            ['person', 'Privatperson'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSubmitterType(value)}
              aria-pressed={submitterType === value}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm border transition-colors ${
                submitterType === value
                  ? 'border-amber-400/40 bg-amber-400/[0.08] text-amber-300'
                  : 'border-white/10 bg-white/5 text-white/50 hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {submitterType === 'company' && (
          <div>
            <label htmlFor="ins-company" className={LABEL}>Firma / Verein *</label>
            <input
              id="ins-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Muster GmbH / Musikverein Musterdorf"
              required
              maxLength={200}
              className={FIELD}
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ins-contact" className={LABEL}>Ansprechpartner:in *</label>
            <input
              id="ins-contact"
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Max Mustermann"
              required
              maxLength={200}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="ins-email" className={LABEL}>E-Mail *</label>
            <input
              id="ins-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kontakt@beispiel.at"
              required
              maxLength={320}
              className={FIELD}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ins-phone" className={LABEL}>Telefon</label>
            <input
              id="ins-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+43 …"
              maxLength={50}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="ins-website" className={LABEL}>Website</label>
            <input
              id="ins-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className={FIELD}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ins-message" className={LABEL}>Nachricht an die Redaktion</label>
          <textarea
            id="ins-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Optional — alles, was wir zur Prüfung wissen sollten."
            className={`${FIELD} resize-y`}
          />
        </div>
      </section>

      {/* Honeypot — Bots füllen Felder aus, die sie im DOM finden.
          aria-hidden + tabIndex halten ihn von Screenreader und Tab-Fokus fern. */}
      <div className="absolute w-px h-px overflow-hidden -left-[9999px]" aria-hidden="true">
        <label htmlFor="ins-fax">Fax</label>
        <input
          id="ins-fax"
          type="text"
          name="fax"
          value={fax}
          onChange={(e) => setFax(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-white/60 cursor-pointer">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(e) => setRightsConfirmed(e.target.checked)}
          required
          className="mt-0.5 w-4 h-4 rounded accent-amber-400 shrink-0"
        />
        <span>
          Ich bestätige, dass die Angaben stimmen und ich die Rechte an Text und Bild
          habe bzw. sie verwenden darf. *
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'sending' ? 'Wird eingereicht …' : 'Inserat einreichen'}
      </button>

      <p className="text-[11px] text-white/25">
        Jedes Inserat wird von Hand geprüft. Wir behalten uns vor, Einreichungen
        abzulehnen oder Angaben zu korrigieren. Deine Kontaktdaten verwenden wir nur
        für die Rückmeldung zu diesem Inserat.
      </p>
    </form>
  );
}

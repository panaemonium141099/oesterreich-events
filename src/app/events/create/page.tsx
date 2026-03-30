'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { CalendarIcon, GlobeIcon, LockIcon, PartyIcon } from '@/components/UI/Icons';

const CATEGORIES = [
  'Musik', 'Nightlife', 'Kultur', 'Sport', 'Märkte',
  'Familie', 'Natur', 'Wein & Kulinarik', 'Feste & Brauchtum',
  'Religion', 'Gesundheit', 'Bildung', 'Sonstiges',
];

const BUNDESLAENDER = [
  'wien', 'niederoesterreich', 'oberoesterreich', 'salzburg',
  'tirol', 'vorarlberg', 'steiermark', 'kaernten', 'burgenland',
];

export default function CreateEventPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Sonstiges');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [bundesland, setBundesland] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [priceText, setPriceText] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');

    const startDateTime = isAllDay
      ? startDate
      : startDate && startTime
        ? `${startDate}T${startTime}`
        : startDate;

    const endDateTime = endDate
      ? isAllDay
        ? endDate
        : endDate && endTime
          ? `${endDate}T${endTime}`
          : endDate
      : null;

    const { error: err } = await supabase.from('events').insert({
      title,
      description: description || null,
      category,
      start_date: startDateTime,
      end_date: endDateTime,
      is_all_day: isAllDay,
      location_name: locationName || null,
      address: address || null,
      postal_code: postalCode || null,
      bundesland: bundesland || null,
      price_text: priceText || null,
      ticket_url: ticketUrl || null,
      visibility,
      source_type: profile?.role === 'business' ? 'business' : 'user',
      created_by: user.id,
      business_id: profile?.role === 'business' ? user.id : null,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
    } else {
      router.push('/map');
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white gradient-mesh"
    >
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
        <Link href="/map" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2 min-h-[44px] min-w-[44px]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </Link>
        <p className="text-xs tracking-[0.2em] uppercase text-white/30">Event erstellen</p>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2"><CalendarIcon size={24} /> Neues Event</h1>
        <p className="text-white/40 text-sm mb-8">
          {visibility === 'public' ? 'Wird auf der Karte für alle sichtbar sein' : 'Nur für dich und eingeladene Freunde sichtbar'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Sommerfest im Park"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-gray-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Was erwartet die Besucher?"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
            />
          </div>

          {/* Date & Time */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-white/40">Datum & Uhrzeit *</label>
              <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded"
                />
                Ganztägig
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
                />
              )}
            </div>
            <p className="text-xs text-white/30 mt-2">Ende (optional):</p>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
                />
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Ort</label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="z.B. Stadtpark Wien"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Adresse</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Straße, Nr."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">PLZ</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="1010"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Bundesland</label>
            <select
              value={bundesland}
              onChange={(e) => setBundesland(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
            >
              <option value="" className="bg-gray-900">— Wählen —</option>
              {BUNDESLAENDER.map(bl => (
                <option key={bl} value={bl} className="bg-gray-900">{bl.charAt(0).toUpperCase() + bl.slice(1).replace('oe', 'ö').replace('ae', 'ä')}</option>
              ))}
            </select>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Preis</label>
              <input
                type="text"
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="z.B. Eintritt frei, ab €15"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Ticket-Link</label>
              <input
                type="url"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-xs text-white/40 mb-3">Sichtbarkeit</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  visibility === 'public'
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
                }`}
              >
                <GlobeIcon size={16} className="inline-block mr-1 -mt-0.5" /> Öffentlich
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  visibility === 'private'
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/20'
                }`}
              >
                <LockIcon size={16} className="inline-block mr-1 -mt-0.5" /> Privat
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !title || !startDate}
            className="w-full py-3.5 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <><PartyIcon size={18} className="inline-block mr-1.5 -mt-0.5" /> Event erstellen</>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

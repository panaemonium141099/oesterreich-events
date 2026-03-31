'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { CrownIcon, BoltIcon, BuildingIcon, CheckIcon } from '@/components/UI/Icons';

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
      setBirthDate(profile.birth_date || '');
      setBio(profile.bio || '');
      setCity(profile.city || '');
      setPostalCode(profile.postal_code || '');
      setAddress(profile.address || '');
      setCountry(profile.country || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;

    // Validate required fields
    if (!firstName.trim() || !lastName.trim()) {
      setError('Vorname und Nachname sind Pflichtfelder.');
      return;
    }
    if (!birthDate) {
      setError('Geburtsdatum ist ein Pflichtfeld.');
      return;
    }
    if (!address.trim() || !postalCode.trim() || !city.trim() || !country.trim()) {
      setError('Adresse (Straße, PLZ, Stadt, Land) sind Pflichtfelder.');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    const { error: err } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        birth_date: birthDate,
        bio,
        city,
        postal_code: postalCode,
        address,
        country,
      })
      .eq('id', user.id);

    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      await refreshProfile();
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-24 gradient-mesh"
    >
      <SocialNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold mb-4 border-2 border-white/20">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white/60">
                {firstName?.[0]?.toUpperCase() || '?'}{lastName?.[0]?.toUpperCase() || ''}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold">{firstName} {lastName}</h1>
          <p className="text-sm text-white/40">{user.email}</p>
          {profile?.role !== 'user' && (
            <span className="mt-2 px-3 py-0.5 rounded-full text-xs bg-amber-400/20 text-amber-400 font-medium">
              {profile?.role === 'god' ? <><CrownIcon size={14} className="inline-block mr-1 -mt-0.5" /> God Mode</> : profile?.role === 'admin' ? <><BoltIcon size={14} className="inline-block mr-1 -mt-0.5" /> Admin</> : <><BuildingIcon size={14} className="inline-block mr-1 -mt-0.5" /> Business</>}
            </span>
          )}
        </div>

        {/* Form */}
        <div className="space-y-6">
          <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium">Persönliche Daten</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Vorname *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Nachname *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Geburtsdatum *</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Telefonnummer</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+43 ..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Erzähl etwas über dich..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
            />
          </div>

          <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium pt-4">Adresse</h2>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Straße *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">PLZ *</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Stadt *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Land *</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Connected Apps */}
          <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium pt-4">Verknüpfte Apps</h2>

          <div className="space-y-3">
            <button
              onClick={() => {
                if (!profile?.spotify_connected) {
                  const params = new URLSearchParams({
                    client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
                    response_type: 'code',
                    redirect_uri: `${window.location.origin}/auth/spotify/callback`,
                    scope: 'user-top-artists user-read-recently-played',
                    show_dialog: 'true',
                  });
                  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-green-400 text-sm">&#9834;</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Spotify</p>
                  <p className="text-xs text-white/40">
                    {profile?.spotify_connected ? 'Verbunden' : 'Nicht verbunden'}
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                profile?.spotify_connected
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/10 text-white/40'
              }`}>
                {profile?.spotify_connected ? '\u2713' : 'Verbinden'}
              </span>
            </button>

            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-blue-400 text-sm">f</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Facebook</p>
                  <p className="text-xs text-white/40">
                    {profile?.facebook_connected ? 'Verbunden' : 'Nicht verbunden'}
                  </p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                profile?.facebook_connected
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-white/10 text-white/40'
              }`}>
                {profile?.facebook_connected ? <CheckIcon size={14} /> : 'Verbinden'}
              </span>
            </button>
          </div>

          {/* Error / Success */}
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>
          )}
          {saved && (
            <p className="text-sm text-green-400 bg-green-400/10 px-4 py-2 rounded-lg flex items-center gap-1.5"><CheckIcon size={14} /> Profil gespeichert!</p>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving || !firstName || !lastName || !birthDate || !address || !postalCode || !city || !country}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              'Speichern'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

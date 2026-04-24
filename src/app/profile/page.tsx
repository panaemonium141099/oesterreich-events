'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { CrownIcon, BoltIcon, BuildingIcon, CheckIcon } from '@/components/UI/Icons';
import { NotificationSettings } from '@/components/Notifications/NotificationSettings';
import { toast } from 'sonner';

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
  const [isEditing, setIsEditing] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
      setIsEditing(false);
      await refreshProfile();
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const handleCancel = () => {
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
    setError('');
    setIsEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        toast.error('Avatar konnte nicht hochgeladen werden');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      await refreshProfile();
      toast.success('Avatar aktualisiert');
    } catch {
      toast.error('Avatar konnte nicht hochgeladen werden');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-white">
<main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col items-center mb-10 animate-pulse motion-reduce:animate-none">
            <div className="w-24 h-24 rounded-full bg-white/[0.06] mb-4" />
            <div className="h-6 w-40 rounded bg-white/[0.06] mb-2" />
            <div className="h-4 w-52 rounded bg-white/[0.04]" />
          </div>
          <div className="space-y-4 animate-pulse motion-reduce:animate-none">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-24 bg-surface"
    >
<main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold border-2 border-white/[0.10]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white/40">
                  {firstName?.[0]?.toUpperCase() || '?'}{lastName?.[0]?.toUpperCase() || ''}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors"
              aria-label="Avatar ändern"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/60">
                <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.2.32.58.529.986.529H19.5a3 3 0 013 3v7.5a3 3 0 01-3 3h-15a3 3 0 01-3-3v-7.5a3 3 0 013-3h.808c.406 0 .786-.21.986-.53l.821-1.316a2.338 2.338 0 012.332-1.39zM12 10.5a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" />
              </svg>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <h1 className="text-xl font-semibold">{firstName} {lastName}</h1>
          <p className="text-sm text-white/40">{user?.email}</p>
          {profile?.role !== 'user' && (
            <span className="mt-2 px-3 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 font-medium">
              {profile?.role === 'god' ? <><CrownIcon size={14} className="inline-block mr-1 -mt-0.5" /> God Mode</> : profile?.role === 'admin' ? <><BoltIcon size={14} className="inline-block mr-1 -mt-0.5" /> Admin</> : <><BuildingIcon size={14} className="inline-block mr-1 -mt-0.5" /> Business</>}
            </span>
          )}
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium">Persönliche Daten</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/40 hover:text-white/60 hover:border-white/[0.15] text-sm font-medium transition-all"
              >
                Bearbeiten
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="transition-all duration-200">
              <label className="block text-xs text-white/40 mb-1.5">Vorname *</label>
              {isEditing ? (
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              ) : (
                <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                  {firstName ? <span className="text-white/70">{firstName}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
                </p>
              )}
            </div>
            <div className="transition-all duration-200">
              <label className="block text-xs text-white/40 mb-1.5">Nachname *</label>
              {isEditing ? (
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              ) : (
                <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                  {lastName ? <span className="text-white/70">{lastName}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
                </p>
              )}
            </div>
          </div>

          <div className="transition-all duration-200">
            <label className="block text-xs text-white/40 mb-1.5">Geburtsdatum *</label>
            {isEditing ? (
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 focus:outline-none focus:border-white/[0.15] transition-colors"
              />
            ) : (
              <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                {birthDate ? <span className="text-white/70">{new Date(birthDate + 'T00:00:00').toLocaleDateString('de-AT')}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
              </p>
            )}
          </div>

          <div className="transition-all duration-200">
            <label className="block text-xs text-white/40 mb-1.5">Telefonnummer</label>
            {isEditing ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+43 ..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
              />
            ) : (
              <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                {phone ? <span className="text-white/70">{phone}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
              </p>
            )}
          </div>

          <div className="transition-all duration-200">
            <label className="block text-xs text-white/40 mb-1.5">Bio</label>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Erzähl etwas über dich..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors resize-none"
              />
            ) : (
              <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                {bio ? <span className="text-white/70 whitespace-pre-wrap">{bio}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
              </p>
            )}
          </div>

          <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium pt-4">Adresse</h2>

          <div className="transition-all duration-200">
            <label className="block text-xs text-white/40 mb-1.5">Straße *</label>
            {isEditing ? (
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
              />
            ) : (
              <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                {address ? <span className="text-white/70">{address}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="transition-all duration-200">
              <label className="block text-xs text-white/40 mb-1.5">PLZ *</label>
              {isEditing ? (
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              ) : (
                <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                  {postalCode ? <span className="text-white/70">{postalCode}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
                </p>
              )}
            </div>
            <div className="transition-all duration-200">
              <label className="block text-xs text-white/40 mb-1.5">Stadt *</label>
              {isEditing ? (
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
                />
              ) : (
                <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                  {city ? <span className="text-white/70">{city}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
                </p>
              )}
            </div>
          </div>

          <div className="transition-all duration-200">
            <label className="block text-xs text-white/40 mb-1.5">Land *</label>
            {isEditing ? (
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
              />
            ) : (
              <p className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm min-h-[46px]">
                {country ? <span className="text-white/70">{country}</span> : <span className="text-white/30 italic">Nicht angegeben</span>}
              </p>
            )}
          </div>

          {/* Connected Apps */}
          <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium pt-4">Verknüpfte Apps</h2>

          <div className="space-y-3">
            <button
              onClick={() => {
                if (!profile?.spotify_connected) {
                  // Canonical origin only — Spotify does exact-string match
                  // on redirect_uri. Using window.location.origin breaks when
                  // a user lands on the non-www host.
                  const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
                  const params = new URLSearchParams({
                    client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
                    response_type: 'code',
                    redirect_uri: `${ORIGIN}/auth/spotify/callback`,
                    scope: 'user-top-read user-read-recently-played user-follow-read',
                    show_dialog: 'true',
                  });
                  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
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
                  : 'bg-white/[0.06] text-white/40'
              }`}>
                {profile?.spotify_connected ? '\u2713' : 'Verbinden'}
              </span>
            </button>

            <Link
              href="/artists"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Kuenstler verwalten</p>
                  <p className="text-xs text-white/40">Folge Kuenstlern und erhalte Alerts</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/settings/notifications"
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Benachrichtigungen</p>
                  <p className="text-xs text-white/40">E-Mail, SMS und Erinnerungen konfigurieren</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Error / Success */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">{error}</p>
          )}
          {saved && (
            <p className="text-sm text-green-400 bg-green-500/10 px-4 py-2 rounded-lg flex items-center gap-1.5"><CheckIcon size={14} /> Profil gespeichert!</p>
          )}

          {/* Save / Cancel Buttons (edit mode only) */}
          {isEditing && (
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/40 hover:text-white/60 hover:border-white/[0.15] font-medium transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !firstName || !lastName || !birthDate || !address || !postalCode || !city || !country}
                className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Speichern'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="mt-8 p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
          <NotificationSettings
            preferredCitySlug={(profile as unknown as Record<string, unknown>)?.preferred_city_slug as string | null ?? null}
            studentMode={(profile as unknown as Record<string, unknown>)?.student_mode as boolean ?? false}
            onProfileUpdate={async (fields) => {
              if (!user) return;
              await supabase
                .from('profiles')
                .update(fields)
                .eq('id', user.id);
              await refreshProfile();
            }}
          />
        </div>
      </main>
    </div>
  );
}

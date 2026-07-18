'use client';

import { Suspense } from 'react';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { isProfileComplete } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { trackEvent } from '@/lib/analytics';

function CompleteProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [supabase] = useState(() => createClient());

  // Safe same-origin redirect target for post-completion navigation.
  const redirectTarget = useMemo(() => {
    const raw = searchParams.get('redirect');
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/map';
  }, [searchParams]);
  const loginPassthrough = redirectTarget === '/map' ? '' : `?redirect=${encodeURIComponent(redirectTarget)}`;

  // Form state — pre-filled from profile if available
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Österreich');

  const [agbAccepted, setAgbAccepted] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [hasExistingAgb, setHasExistingAgb] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from profile once loaded
  useEffect(() => {
    if (profile) {
      if (profile.first_name) setFirstName(profile.first_name);
      if (profile.last_name) setLastName(profile.last_name);
      if (profile.birth_date) setBirthDate(profile.birth_date);
      if (profile.phone) setPhone(profile.phone);
      if (profile.address) setStreet(profile.address);
      if (profile.postal_code) setPostalCode(profile.postal_code);
      if (profile.city) setCity(profile.city);
      if (profile.country) {
        setCountry(profile.country === 'AT' ? 'Österreich' : profile.country);
      }
      // Check if user already accepted AGB (e.g. during email registration)
      if (profile.agb_accepted_at) {
        setAgbAccepted(true);
        setHasExistingAgb(true);
      }
      if (profile.newsletter_opt_in) {
        setNewsletterOptIn(true);
      }
    }
  }, [profile]);

  // If not logged in, redirect to login (preserving the downstream redirect).
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/auth/login${loginPassthrough}`);
    }
  }, [user, loading, router, loginPassthrough]);

  // If profile is already complete, jump straight to the final destination.
  useEffect(() => {
    if (!loading && profile && isProfileComplete(profile)) {
      router.replace(redirectTarget);
    }
  }, [loading, profile, router, redirectTarget]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Vorname und Nachname sind Pflichtfelder.');
      return;
    }
    if (!birthDate) {
      setError('Bitte gib dein Geburtsdatum an.');
      return;
    }
    if (!agbAccepted) {
      setError('Bitte stimme den AGB und der Datenschutzerklärung zu.');
      return;
    }

    setSubmitting(true);

    const countryCode = country.trim().toLowerCase() === 'österreich' ? 'AT' : country.trim();

    const updateData: Record<string, unknown> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      birth_date: birthDate,
      phone: phone.trim() || null,
      address: street.trim() || null,
      postal_code: postalCode.trim() || null,
      city: city.trim() || null,
      country: countryCode || 'AT',
      newsletter_opt_in: newsletterOptIn,
      updated_at: new Date().toISOString(),
    };
    // Only set agb_accepted_at if not already set
    if (!hasExistingAgb && agbAccepted) {
      updateData.agb_accepted_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user!.id);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    trackEvent('profile_completed', { method: 'complete-profile' });

    // Fire-and-forget welcome email. Idempotent on the server side
    // (checks profiles.welcome_email_sent_at). We don't await — the user
    // shouldn't wait on Brevo's API for the redirect.
    fetch('/api/auth/send-welcome', { method: 'POST' }).catch((err) => {
      console.warn('[welcome] fire-and-forget failed:', err);
    });

    router.replace(redirectTarget);
  };

  // Show spinner while loading
  if (loading || !user || (profile && isProfileComplete(profile))) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Profil vervollständigen</h1>
        <p className="text-white/40 text-sm mt-2">
          Noch ein paar Infos, dann kann&apos;s losgehen!
        </p>
      </div>

      {/* Show email as read-only info */}
      {profile?.email && (
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-xs text-white/30 mb-0.5">Angemeldet als</p>
          <p className="text-sm text-white/70">{profile.email}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
        {/* Required fields */}
        <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Pflichtfelder</p>

        <div className="grid grid-cols-2 gap-3">
          <InputField
            id="first-name"
            label="Vorname"
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={setFirstName}
            placeholder="Max"
          />
          <InputField
            id="last-name"
            label="Nachname"
            type="text"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={setLastName}
            placeholder="Mustermann"
          />
        </div>

        <InputField
          id="birth-date"
          label="Geburtsdatum"
          type="date"
          required
          autoComplete="bday"
          value={birthDate}
          onChange={setBirthDate}
        />

        {/* Optional fields */}
        <div className="pt-2">
          <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-3">Optional</p>
        </div>

        <InputField
          id="phone"
          label="Telefonnummer"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+43 660 1234567"
        />

        <InputField
          id="street"
          label="Straße"
          type="text"
          autoComplete="street-address"
          value={street}
          onChange={setStreet}
          placeholder="Hauptstraße 1"
        />

        <div className="grid grid-cols-2 gap-3">
          <InputField
            id="postal-code"
            label="PLZ"
            type="text"
            autoComplete="postal-code"
            value={postalCode}
            onChange={setPostalCode}
            placeholder="7000"
          />
          <InputField
            id="city"
            label="Stadt"
            type="text"
            autoComplete="address-level2"
            value={city}
            onChange={setCity}
            placeholder="Eisenstadt"
          />
        </div>

        <InputField
          id="country"
          label="Land"
          type="text"
          autoComplete="country-name"
          value={country}
          onChange={setCountry}
          placeholder="Österreich"
        />

        {/* Legal Consent */}
        {!hasExistingAgb && (
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={agbAccepted}
                onChange={(e) => setAgbAccepted(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30 cursor-pointer shrink-0"
              />
              <span className="text-sm text-white/50 group-hover:text-white/70 transition-colors leading-relaxed">
                Ich stimme den{' '}
                <Link href="/agb" target="_blank" className="text-white/80 underline underline-offset-2 hover:text-white">
                  AGB
                </Link>{' '}
                zu und habe die{' '}
                <Link href="/datenschutz" target="_blank" className="text-white/80 underline underline-offset-2 hover:text-white">
                  Datenschutzerklärung
                </Link>{' '}
                gelesen. *
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/30 cursor-pointer shrink-0"
              />
              <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors leading-relaxed">
                Ich möchte über Events und Neuigkeiten per E-Mail informiert werden.
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm animate-shake">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !agbAccepted}
          className="w-full rounded-xl border border-white/20 bg-white/5 text-white font-medium py-3 px-4 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {submitting ? <Spinner /> : 'Weiter'}
        </button>
      </form>
    </div>
  );
}

/* --- Reusable Input ----------------------------------------- */

function InputField({
  id,
  label,
  type,
  required,
  autoComplete,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-white/50 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 px-4 py-3 outline-none focus:border-white/30 transition-colors"
        placeholder={placeholder}
      />
    </div>
  );
}

/* --- Spinner ------------------------------------------------ */

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// Ohne Root-loading.tsx (2026-07-15 entfernt — dessen Route-Boundary hatte
// den Suspense-Reveal-Bug, Inhalte blieben unsichtbar) braucht jede Seite
// mit useSearchParams ihre eigene Boundary fürs Prerendering.
export default function CompleteProfilePageWithBoundary() {
  return (
    <Suspense fallback={null}>
      <CompleteProfilePage />
    </Suspense>
  );
}

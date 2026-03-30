'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';

type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signUpWithEmail } = useAuth();

  const [step, setStep] = useState<Step>(1);

  // Step 1 — Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Step 2 — Persönliche Daten
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');

  // Step 3 — Adresse
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Österreich');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/map');
    }
  }, [user, loading, router]);

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setStep(2);
  };

  const handleStep2 = (e: FormEvent) => {
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

    setStep(3);
  };

  const handleStep3 = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!street.trim() || !postalCode.trim() || !city.trim() || !country.trim()) {
      setError('Bitte fülle alle Adressfelder aus.');
      return;
    }

    setSubmitting(true);

    const { error: authError } = await signUpWithEmail(email, password, {
      first_name: firstName,
      last_name: lastName,
      birth_date: birthDate,
      phone,
      address: street,
      postal_code: postalCode,
      city,
      country,
    });

    if (authError) {
      setError(authError);
      setSubmitting(false);
    } else {
      setSuccess(true);
    }
  };

  // Don't render form while checking auth
  if (loading || user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div className="text-center space-y-4 animate-fade-in-up">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckIcon />
        </div>
        <h2 className="text-xl font-bold">Fast geschafft!</h2>
        <p className="text-white/50 text-sm leading-relaxed">
          Wir haben dir eine Bestätigungs-E-Mail an<br />
          <span className="text-white/80 font-medium">{email}</span> gesendet.<br />
          Bitte bestätige deine E-Mail-Adresse.
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-4 text-sm text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors"
        >
          Zum Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Konto erstellen</h1>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className={`h-1 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-white/60' : 'bg-white/10'}`} />
          <div className={`h-1 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-white/60' : 'bg-white/10'}`} />
          <div className={`h-1 w-8 rounded-full transition-colors ${step >= 3 ? 'bg-white/60' : 'bg-white/10'}`} />
        </div>
      </div>

      {/* OAuth — only on step 1 */}
      {step === 1 && (
        <>
          <div className="space-y-3">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-gray-900 font-medium py-3 px-4 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <GoogleIcon />
              Mit Google registrieren
            </button>

            <div className="relative group">
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white/10 text-white/30 font-medium py-3 px-4 cursor-not-allowed"
              >
                <AppleIcon />
                Mit Apple registrieren
              </button>
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur text-white/60 text-xs rounded-lg px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Bald verfügbar
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-sm">oder</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </>
      )}

      {/* Step 1: Credentials */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4 animate-fade-in">
          <InputField
            id="email"
            label="E-Mail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={setEmail}
            placeholder="name@beispiel.at"
          />

          <div>
            <label htmlFor="password" className="block text-sm text-white/50 mb-1.5">
              Passwort
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 px-4 py-3 pr-12 outline-none focus:border-white/30 transition-colors"
                placeholder="Mindestens 8 Zeichen"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <InputField
            id="password-confirm"
            label="Passwort bestätigen"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            placeholder="Passwort wiederholen"
          />

          {error && (
            <p className="text-red-400 text-sm animate-shake">{error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl border border-white/20 bg-white/5 text-white font-medium py-3 px-4 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Weiter
          </button>
        </form>
      )}

      {/* Step 2: Profile Details */}
      {step === 2 && (
        <form onSubmit={handleStep2} className="space-y-4 animate-fade-in">
          <button
            type="button"
            onClick={() => { setStep(1); setError(null); }}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm mb-2 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Zurück
          </button>

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

          <InputField
            id="phone"
            label="Telefonnummer (optional)"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+43 660 1234567"
          />

          {error && (
            <p className="text-red-400 text-sm animate-shake">{error}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl border border-white/20 bg-white/5 text-white font-medium py-3 px-4 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Weiter
          </button>
        </form>
      )}

      {/* Step 3: Adresse */}
      {step === 3 && (
        <form onSubmit={handleStep3} className="space-y-4 animate-fade-in">
          <button
            type="button"
            onClick={() => { setStep(2); setError(null); }}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm mb-2 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Zurück
          </button>

          <p className="text-sm text-white/40 mb-2">Adresse</p>

          <InputField
            id="street"
            label="Straße"
            type="text"
            required
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
              required
              autoComplete="postal-code"
              value={postalCode}
              onChange={setPostalCode}
              placeholder="7000"
            />
            <InputField
              id="city"
              label="Stadt"
              type="text"
              required
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
            required
            autoComplete="country-name"
            value={country}
            onChange={setCountry}
            placeholder="Österreich"
          />

          {error && (
            <p className="text-red-400 text-sm animate-shake">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl border border-white/20 bg-white/5 text-white font-medium py-3 px-4 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? <Spinner /> : 'Registrieren'}
          </button>
        </form>
      )}

      {/* Link to login */}
      <p className="text-center text-sm text-white/30">
        Bereits ein Konto?{' '}
        <Link href="/auth/login" className="text-white/70 hover:text-white transition-colors underline underline-offset-2">
          Anmelden
        </Link>
      </p>
    </div>
  );
}

/* ─── Reusable Input ───────────────────────────────── */

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

/* ─── Inline Icons ─────────────────────────────────── */

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

'use client';

/**
 * Notification preferences UI component.
 *
 * Allows users to toggle:
 *   - Artist alerts on/off (master toggle)
 *   - Notification channels: in-app (always on), email (off by default), SMS (off by default)
 *   - Reminder intervals (7 days before, 1 day before)
 *   - Phone number input for SMS (E.164 format, +43 prefix helper)
 *
 * Reads and writes via /api/notifications/preferences API routes.
 * Shows GDPR consent text before enabling email/SMS.
 * Email goes to Supabase Auth email (no override field).
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.10
 */

import { useEffect, useState, useCallback } from 'react';

interface Preferences {
  artist_alerts_enabled: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  reminder_7d: boolean;
  reminder_1d: boolean;
  phone_number: string;
}

const DEFAULT_PREFS: Preferences = {
  artist_alerts_enabled: true,
  channel_in_app: true,
  channel_email: false,
  channel_sms: false,
  reminder_7d: true,
  reminder_1d: true,
  phone_number: '',
};

/** E.164 phone number: +<country code><number>, 7-15 digits total */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showGdprEmail, setShowGdprEmail] = useState(false);
  const [showGdprSms, setShowGdprSms] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notifications/preferences');

        if (res.status === 401) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setError('Fehler beim Laden der Einstellungen');
          setLoading(false);
          return;
        }

        const data = await res.json();
        const p = data.preferences;
        setPrefs({
          artist_alerts_enabled: p.artist_alerts_enabled ?? true,
          channel_in_app: true, // always on
          channel_email: p.channel_email ?? false,
          channel_sms: p.channel_sms ?? false,
          reminder_7d: p.reminder_7d ?? true,
          reminder_1d: p.reminder_1d ?? true,
          phone_number: p.phone_number ?? '',
        });
      } catch {
        setError('Fehler beim Laden der Einstellungen');
      }
      setLoading(false);
    }
    load();
  }, []);

  // Fetch user email for display
  useEffect(() => {
    async function fetchEmail() {
      try {
        // Use Supabase client to get the current user email
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setUserEmail(user.email);
      } catch {
        // Non-critical, UI will just not show email
      }
    }
    fetchEmail();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    setPhoneError(null);

    // Client-side phone validation
    if (prefs.channel_sms) {
      if (!prefs.phone_number.trim()) {
        setPhoneError('Telefonnummer erforderlich fuer SMS-Benachrichtigungen.');
        setSaving(false);
        return;
      }
      if (!E164_REGEX.test(prefs.phone_number.trim())) {
        setPhoneError('Ungueltige Telefonnummer. Bitte im Format +43... angeben (z.B. +436641234567).');
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_alerts_enabled: prefs.artist_alerts_enabled,
          channel_in_app: true,
          channel_email: prefs.channel_email,
          channel_sms: prefs.channel_sms,
          reminder_7d: prefs.reminder_7d,
          reminder_1d: prefs.reminder_1d,
          phone_number: prefs.channel_sms ? prefs.phone_number.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Fehler beim Speichern');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError('Fehler beim Speichern');
    }

    setSaving(false);
  }, [prefs]);

  const toggle = (key: keyof Preferences) => {
    if (key === 'channel_in_app') return; // in-app is always on

    // Show GDPR consent when enabling email or SMS
    if (key === 'channel_email' && !prefs.channel_email) {
      setShowGdprEmail(true);
      return;
    }
    if (key === 'channel_sms' && !prefs.channel_sms) {
      setShowGdprSms(true);
      return;
    }

    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const confirmGdprEmail = () => {
    setPrefs((prev) => ({ ...prev, channel_email: true }));
    setShowGdprEmail(false);
  };

  const confirmGdprSms = () => {
    setPrefs((prev) => ({ ...prev, channel_sms: true }));
    setShowGdprSms(false);
  };

  const handlePhoneChange = (value: string) => {
    setPhoneError(null);
    // Auto-prepend +43 if user starts typing a number without +
    let phone = value;
    if (phone && !phone.startsWith('+')) {
      phone = '+43' + phone.replace(/^0+/, '');
    }
    setPrefs((prev) => ({ ...prev, phone_number: phone }));
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6">
        <div className="h-6 w-48 rounded bg-zinc-800" />
        <div className="h-10 w-full rounded bg-zinc-800" />
        <div className="h-10 w-full rounded bg-zinc-800" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
        Bitte melde dich an, um deine Benachrichtigungseinstellungen zu verwalten.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Kuenstler-Benachrichtigungen
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Steuere, wie und wann du ueber Events deiner Kuenstler informiert wirst.
        </p>
      </div>

      {/* Master toggle */}
      <ToggleRow
        label="Artist-Alerts aktiviert"
        description="Benachrichtigungen wenn gefolgte Kuenstler Events haben"
        checked={prefs.artist_alerts_enabled}
        onChange={() => toggle('artist_alerts_enabled')}
      />

      {prefs.artist_alerts_enabled && (
        <>
          {/* Channel toggles */}
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <h3 className="text-sm font-medium text-zinc-300">Kanaele</h3>

            <ToggleRow
              label="In-App"
              description="Benachrichtigungen in der App (immer aktiv)"
              checked={true}
              onChange={() => {}}
              disabled
            />

            <ToggleRow
              label="E-Mail"
              description={
                userEmail
                  ? `Benachrichtigungen an ${userEmail}`
                  : 'Benachrichtigungen per E-Mail'
              }
              checked={prefs.channel_email}
              onChange={() => toggle('channel_email')}
            />

            <ToggleRow
              label="SMS"
              description="Benachrichtigungen per SMS"
              checked={prefs.channel_sms}
              onChange={() => toggle('channel_sms')}
            />
          </div>

          {/* Phone number input (only shown when SMS is enabled) */}
          {prefs.channel_sms && (
            <div className="space-y-2 border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-medium text-zinc-300">Telefonnummer</h3>
              <p className="text-xs text-zinc-500">
                Fuer SMS-Benachrichtigungen. Format: +43 gefolgt von deiner Nummer (z.B. +436641234567).
              </p>
              <input
                type="tel"
                value={prefs.phone_number}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+436641234567"
                className={`w-full rounded-lg border bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  phoneError ? 'border-red-500' : 'border-zinc-700'
                }`}
              />
              {phoneError && (
                <p className="text-xs text-red-400">{phoneError}</p>
              )}
            </div>
          )}

          {/* Reminder interval toggles */}
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <h3 className="text-sm font-medium text-zinc-300">Erinnerungen</h3>

            <ToggleRow
              label="7 Tage vorher"
              description="Erinnerung eine Woche vor dem Event"
              checked={prefs.reminder_7d}
              onChange={() => toggle('reminder_7d')}
            />

            <ToggleRow
              label="1 Tag vorher"
              description="Erinnerung am Tag vor dem Event"
              checked={prefs.reminder_1d}
              onChange={() => toggle('reminder_1d')}
            />
          </div>
        </>
      )}

      {/* GDPR consent dialog for email */}
      {showGdprEmail && (
        <GdprConsent
          channel="E-Mail"
          onConfirm={confirmGdprEmail}
          onCancel={() => setShowGdprEmail(false)}
        />
      )}

      {/* GDPR consent dialog for SMS */}
      {showGdprSms && (
        <GdprConsent
          channel="SMS"
          onConfirm={confirmGdprSms}
          onCancel={() => setShowGdprSms(false)}
        />
      )}

      {/* Save button */}
      <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>

        {saved && (
          <span className="text-sm text-green-400">Gespeichert!</span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

// -- GDPR consent dialog ----------------------------------------------------------

function GdprConsent({
  channel,
  onConfirm,
  onCancel,
}: {
  channel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-4">
      <h4 className="text-sm font-medium text-amber-300">
        Einwilligung fuer {channel}-Benachrichtigungen
      </h4>
      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
        Mit der Aktivierung stimmst du zu, {channel}-Benachrichtigungen ueber Events
        deiner gefolgten Kuenstler zu erhalten. Du kannst diese Einwilligung jederzeit
        hier in den Einstellungen oder ueber den Abmelde-Link in jeder E-Mail widerrufen.
        Deine Daten werden gemaess unserer Datenschutzerklaerung verarbeitet (DSGVO Art. 6
        Abs. 1 lit. a).
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onConfirm}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500"
        >
          Einwilligen und aktivieren
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// -- Toggle row sub-component ----------------------------------------------------

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-lg p-2 transition ${
        disabled
          ? 'cursor-default opacity-60'
          : 'cursor-pointer hover:bg-zinc-800/50'
      }`}
    >
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={`h-6 w-11 rounded-full transition ${
            checked ? 'bg-indigo-600' : 'bg-zinc-700'
          }`}
        >
          <div
            className={`h-5 w-5 transform rounded-full bg-white shadow transition ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            } mt-0.5`}
          />
        </div>
      </div>
    </label>
  );
}

'use client';

/**
 * Notification preferences UI component.
 *
 * Allows users to toggle:
 *   - Artist alerts on/off
 *   - Notification channels (in-app, email, SMS)
 *   - Reminder intervals (7 days before, 1 day before)
 *
 * Reads and writes from the `notification_preferences` table.
 * Upserts on save so the row is created if it does not exist.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.12
 */

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface Preferences {
  artist_alerts_enabled: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  reminder_7d: boolean;
  reminder_1d: boolean;
  phone_number: string | null;
}

const DEFAULT_PREFS: Preferences = {
  artist_alerts_enabled: true,
  channel_in_app: true,
  channel_email: false,
  channel_sms: false,
  reminder_7d: true,
  reminder_1d: true,
  phone_number: null,
};

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load preferences on mount
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows (expected for new users)
        setError('Fehler beim Laden der Einstellungen');
      }

      if (data) {
        setPrefs({
          artist_alerts_enabled: data.artist_alerts_enabled ?? true,
          channel_in_app: data.channel_in_app ?? true,
          channel_email: data.channel_email ?? false,
          channel_sms: data.channel_sms ?? false,
          reminder_7d: data.reminder_7d ?? true,
          reminder_1d: data.reminder_1d ?? true,
          phone_number: data.phone_number ?? null,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: upsertError } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      setError('Fehler beim Speichern');
      console.error('Failed to save notification preferences:', upsertError);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setSaving(false);
  }, [userId, prefs, supabase]);

  const toggle = (key: keyof Preferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
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

  if (!userId) {
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
          Benachrichtigungen
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Steuere, wie und wann du ueber Events deiner Kuenstler informiert wirst.
        </p>
      </div>

      {/* Master toggle */}
      <ToggleRow
        label="Artist-Alerts aktiviert"
        description="Benachrichtigungen wenn gefolgten Kuenstler Events haben"
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
              description="Benachrichtigungen in der App (Glocke)"
              checked={prefs.channel_in_app}
              onChange={() => toggle('channel_in_app')}
            />

            <ToggleRow
              label="E-Mail"
              description="Benachrichtigungen per E-Mail"
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
              description="Erinnerung am Tag vor dem Event (hoechste Conversion)"
              checked={prefs.reminder_1d}
              onChange={() => toggle('reminder_1d')}
            />
          </div>
        </>
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

// ── Toggle row sub-component ────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg p-2 transition hover:bg-zinc-800/50">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
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

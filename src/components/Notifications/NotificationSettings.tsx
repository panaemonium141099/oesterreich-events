'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { LANDING_CITIES, STUDENT_CITIES } from '@/lib/landing-slugs';
import { toast } from 'sonner';

interface Preferences {
  artist_alerts_enabled: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  reminder_7d: boolean;
  reminder_1d: boolean;
  phone_number: string | null;
  city_digest_enabled: boolean;
  venue_alerts_enabled: boolean;
  today_near_you_enabled: boolean;
  student_alerts_enabled: boolean;
}

const DEFAULT_PREFS: Preferences = {
  artist_alerts_enabled: true,
  channel_in_app: true,
  channel_email: false,
  channel_sms: false,
  reminder_7d: true,
  reminder_1d: true,
  phone_number: null,
  city_digest_enabled: true,
  venue_alerts_enabled: true,
  today_near_you_enabled: true,
  student_alerts_enabled: false,
};

// Deduplicated city options for dropdown
const CITY_OPTIONS = (() => {
  const seen = new Set<string>();
  const opts: { slug: string; name: string }[] = [];
  for (const c of [...LANDING_CITIES, ...STUDENT_CITIES]) {
    const key = 'slug' in c ? c.slug : '';
    if (key && !seen.has(key)) {
      seen.add(key);
      opts.push({ slug: key, name: c.name });
    }
  }
  return opts;
})();

interface NotificationSettingsProps {
  preferredCitySlug: string | null;
  studentMode: boolean;
  onProfileUpdate: (fields: {
    preferred_city_slug?: string | null;
    preferred_city_name?: string | null;
    student_mode?: boolean;
  }) => void;
}

export function NotificationSettings({
  preferredCitySlug,
  studentMode,
  onProfileUpdate,
}: NotificationSettingsProps) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [citySlug, setCitySlug] = useState(preferredCitySlug ?? '');
  const [studentModeLocal, setStudentModeLocal] = useState(studentMode);

  // Load preferences
  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications/preferences')
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) setPrefs(data.preferences);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!user || saving) return;
    setSaving(true);

    try {
      // Save notification preferences
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Speichern');
        return;
      }

      // Save profile fields
      const selectedCity = CITY_OPTIONS.find((c) => c.slug === citySlug);
      onProfileUpdate({
        preferred_city_slug: citySlug || null,
        preferred_city_name: selectedCity?.name ?? null,
        student_mode: studentModeLocal,
      });

      toast.success('Einstellungen gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, [user, prefs, citySlug, studentModeLocal, saving, onProfileUpdate]);

  const toggle = (key: keyof Preferences) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-white/10 rounded w-48" />
        <div className="h-10 bg-white/10 rounded" />
        <div className="h-10 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Benachrichtigungen</h3>

      {/* Preferred City */}
      <div>
        <label className="block text-sm text-white/60 mb-1.5">
          Bevorzugte Stadt
        </label>
        <select
          value={citySlug}
          onChange={(e) => setCitySlug(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="">Keine Auswahl</option>
          {CITY_OPTIONS.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Student Mode */}
      <ToggleRow
        label="Studenten-Modus"
        description="Erhalte Studenten-Alerts (Do/Fr)"
        checked={studentModeLocal}
        onChange={() => setStudentModeLocal(!studentModeLocal)}
      />

      {/* Channels */}
      <div>
        <p className="text-sm font-medium text-white/70 mb-2">Kanale</p>
        <div className="space-y-2">
          <ToggleRow
            label="In-App"
            description="Immer aktiv"
            checked={true}
            onChange={() => {}}
            disabled
          />
          <ToggleRow
            label="Email"
            checked={prefs.channel_email}
            onChange={() => toggle('channel_email')}
          />
          <ToggleRow
            label="SMS"
            description="Nur fur Reminders"
            checked={prefs.channel_sms}
            onChange={() => toggle('channel_sms')}
          />
        </div>
      </div>

      {/* Phone number (only if SMS enabled) */}
      {prefs.channel_sms && (
        <div>
          <label className="block text-sm text-white/60 mb-1.5">
            Telefonnummer (E.164)
          </label>
          <input
            type="tel"
            value={prefs.phone_number ?? ''}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, phone_number: e.target.value || null }))
            }
            placeholder="+43 664 1234567"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}

      {/* Trigger toggles */}
      <div>
        <p className="text-sm font-medium text-white/70 mb-2">Trigger</p>
        <div className="space-y-2">
          <ToggleRow
            label="City Digest"
            description="Wochentliche Zusammenfassung"
            checked={prefs.city_digest_enabled}
            onChange={() => toggle('city_digest_enabled')}
          />
          <ToggleRow
            label="Venue Alerts"
            description="Neue Events bei gefolgten Venues"
            checked={prefs.venue_alerts_enabled}
            onChange={() => toggle('venue_alerts_enabled')}
          />
          <ToggleRow
            label="Heute in deiner Nahe"
            description="Tagliche Highlights"
            checked={prefs.today_near_you_enabled}
            onChange={() => toggle('today_near_you_enabled')}
          />
          <ToggleRow
            label="Studenten-Alerts"
            description="Do/Fr Abend-Highlights"
            checked={prefs.student_alerts_enabled}
            onChange={() => toggle('student_alerts_enabled')}
          />
          <ToggleRow
            label="Artist Alerts"
            checked={prefs.artist_alerts_enabled}
            onChange={() => toggle('artist_alerts_enabled')}
          />
        </div>
      </div>

      {/* Reminders */}
      <div>
        <p className="text-sm font-medium text-white/70 mb-2">Erinnerungen</p>
        <div className="space-y-2">
          <ToggleRow
            label="7 Tage vorher"
            checked={prefs.reminder_7d}
            onChange={() => toggle('reminder_7d')}
          />
          <ToggleRow
            label="1 Tag vorher"
            checked={prefs.reminder_1d}
            onChange={() => toggle('reminder_1d')}
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? 'Speichern...' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer">
      <div>
        <span className="text-sm text-white">{label}</span>
        {description && (
          <span className="block text-xs text-white/40">{description}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors items-center ${
          checked ? 'bg-indigo-600' : 'bg-white/20'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </label>
  );
}

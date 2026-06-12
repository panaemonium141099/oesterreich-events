'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';

/** Boost-Dauer-Optionen. days=0 => unbegrenzt (kein Enddatum). */
export const BOOST_DURATIONS: { days: number; label: string }[] = [
  { days: 14, label: '2 Wochen' },
  { days: 28, label: '4 Wochen' },
  { days: 90, label: '3 Monate' },
  { days: 0, label: 'Unbegrenzt' },
];

/**
 * Boost-Steuerung pro Event: Dauer wählen + boosten, oder laufenden Boost
 * beenden. Rein präsentational — die eigentliche Mutation macht der Aufrufer
 * (siehe setEventBoost in src/lib/admin/boost.ts).
 */
export function BoostControl({
  boosted,
  busy,
  onStart,
  onEnd,
}: {
  boosted: boolean;
  busy: boolean;
  onStart: (days: number) => void;
  onEnd: () => void;
}) {
  const [days, setDays] = useState<number>(28);

  if (boosted) {
    return (
      <button
        onClick={onEnd}
        disabled={busy}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 transition-colors disabled:opacity-50"
        title="Boost sofort beenden"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Beenden
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <select
        value={days}
        onChange={(ev) => setDays(Number(ev.target.value))}
        disabled={busy}
        className="text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 [color-scheme:dark] disabled:opacity-50"
        title="Boost-Dauer"
      >
        {BOOST_DURATIONS.map((d) => (
          <option key={d.days} value={d.days} className="bg-gray-900">
            {d.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => onStart(days)}
        disabled={busy}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg text-white/50 hover:bg-violet-500/10 hover:text-violet-300 transition-colors disabled:opacity-50"
        title="Event boosten"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Boost
      </button>
    </div>
  );
}

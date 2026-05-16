'use client';

/**
 * V4PlanCountdown — Sticky-Strip direkt unter dem Hero.
 *
 * Live-Countdown bis zum Event-Start. Aktualisiert sich pro Minute.
 * Zeigt zusätzlich den nächsten Reminder + CTA "Reminder anpassen".
 */

import { useEffect, useState } from 'react';
import type { PlanWithEvents } from '@/types/plans';

interface Props {
  plan: PlanWithEvents;
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isLive: boolean;     // currently happening
  isPast: boolean;
}

function computeCountdown(target: Date): Countdown {
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, isLive: ms > -3 * 60 * 60 * 1000, isPast: ms <= -3 * 60 * 60 * 1000 };
  }
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((ms / (60 * 1000)) % 60);
  return { days, hours, minutes, isLive: false, isPast: false };
}

function nextReminderLabel(plan: PlanWithEvents, target: Date): string | null {
  const now = new Date();
  const candidates: { ms: number; label: string }[] = [];
  if (plan.reminder_7d) candidates.push({ ms: target.getTime() - 7 * 24 * 60 * 60 * 1000, label: 'Wetter & Anfahrt' });
  if (plan.reminder_1d) candidates.push({ ms: target.getTime() - 24 * 60 * 60 * 1000, label: 'Letzter Call' });
  if (plan.reminder_3h) candidates.push({ ms: target.getTime() - 3 * 60 * 60 * 1000, label: 'Aufbrechen · Route öffnen' });
  const future = candidates.filter(c => c.ms > now.getTime()).sort((a, b) => a.ms - b.ms);
  if (!future[0]) return null;
  const d = new Date(future[0].ms);
  const dateStr = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${dateStr} · ${future[0].label}`;
}

export function V4PlanCountdown({ plan }: Props) {
  const target = plan.events[0]?.start_date
    ? new Date(plan.events[0].start_date)
    : new Date(plan.plan_date + 'T19:00:00');
  const [cd, setCd] = useState<Countdown>(() => computeCountdown(target));

  useEffect(() => {
    setCd(computeCountdown(target));
    const t = setInterval(() => setCd(computeCountdown(target)), 30_000);
    return () => clearInterval(t);
  }, [target.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const reminder = nextReminderLabel(plan, target);

  if (cd.isPast) {
    return (
      <div className="border-b border-[var(--v4-hairline-1)] bg-[var(--v4-surface)]">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-3.5 md:py-4 flex items-center gap-4">
          <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--v4-ink-50)]">Plan abgeschlossen</span>
          <div className="flex-1"/>
          <span className="text-[12.5px] text-[var(--v4-ink-50)] hidden md:inline">Wie war's? Du kannst diesen Plan als Erinnerung speichern.</span>
        </div>
      </div>
    );
  }

  if (cd.isLive) {
    return (
      <div className="border-b border-[var(--v4-alert)]/30 bg-[color-mix(in_oklab,var(--v4-alert)_8%,var(--v4-surface))]">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-3.5 md:py-4 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--v4-alert)] animate-pulse"/>
          <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--v4-alert)]">Live · Veranstaltung läuft</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--v4-hairline-1)] bg-[var(--v4-surface)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-4 md:py-5 flex items-center gap-4 md:gap-8 flex-wrap">
        <TimeBlock value={cd.days} label="Tage" primary/>
        <TimeBlock value={cd.hours} label="Stunden"/>
        <TimeBlock value={cd.minutes} label="Minuten"/>
        <div className="flex-1 min-w-3"/>
        {reminder && (
          <div className="hidden md:flex items-center gap-2 text-[12.5px] text-[var(--v4-ink-50)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Nächster Reminder · {reminder}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeBlock({ value, label, primary }: { value: number; label: string; primary?: boolean }) {
  return (
    <div className="inline-flex items-baseline gap-2">
      <span
        className={`leading-none tracking-[-0.02em] ${primary ? 'text-[32px] md:text-[42px] text-[var(--v4-ink)]' : 'text-[24px] md:text-[32px] text-[var(--v4-ink-70)]'}`}
        style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}
      >
        {value}
      </span>
      <span className="text-[10.5px] md:text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--v4-ink-50)]">{label}</span>
    </div>
  );
}

'use client';

/**
 * V4PlanWizard — Plan-Sheet/Page mit zwei Modi:
 *
 *  - **Quick-Modus** wenn `initialEvent` gesetzt (vom Event-Detail aus):
 *    Single-Card-Form mit Name + Event (read-only) + Notiz + Save.
 *    Kein Stepper, kein "weitere Events suchen" — User hat ja ein
 *    konkretes Event vor sich und will einfach schnell speichern.
 *
 *  - **Wizard-Modus** wenn KEIN initialEvent (z.B. /plan/new oder
 *    "+ Neuer Plan" von /saved): 3-Step Wizard mit Wann / Events /
 *    Notiz — da hat der User noch nichts und braucht die geführte
 *    Auswahl.
 *
 * Dual-mount unverändert:
 *  - mode='sheet'   → Overlay über Event-Detail
 *  - mode='page'    → eigene /plan/new Page
 *
 * Edit-Modus: `initialPlan` setzt den State + macht PATCH /api/plans/{id}.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { V4Stepper } from '@/components/Events/v4';
import type { Event } from '@/types/events';
import { V4PlanWizardStep1 } from './V4PlanWizardStep1';
import { V4PlanWizardStep2 } from './V4PlanWizardStep2';
import { V4PlanWizardStep3 } from './V4PlanWizardStep3';

export interface WizardState {
  name: string;
  plan_date: string;        // ISO YYYY-MM-DD
  note: string;
  events: Event[];
}

interface V4PlanWizardProps {
  mode: 'sheet' | 'page';
  initialEvent?: Event;
  initialPlan?: { id: string; state: WizardState };
  onClose?: () => void;     // only used in sheet mode
}

const STEPS = ['Wann', 'Events', 'Notiz'];

function defaultState(initialEvent?: Event): WizardState {
  const today = new Date().toISOString().slice(0, 10);
  if (initialEvent) {
    const eventDate = (initialEvent.start_date || '').slice(0, 10);
    const city = (initialEvent.location_name || initialEvent.bundesland || '').trim();
    return {
      name: city ? `Abend in ${city}` : `Plan rund um ${initialEvent.title}`,
      plan_date: eventDate || today,
      note: '',
      events: [initialEvent],
    };
  }
  return { name: '', plan_date: today, note: '', events: [] };
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4PlanWizard({ mode, initialEvent, initialPlan, onClose }: V4PlanWizardProps) {
  const router = useRouter();
  // Quick-Mode: wir haben ein Start-Event und sind NICHT im Edit-Modus.
  const quickMode = !!initialEvent && !initialPlan;
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(() =>
    initialPlan?.state ?? defaultState(initialEvent),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = initialPlan ? `/api/plans/${initialPlan.id}` : '/api/plans';
      const method = initialPlan ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name.trim() || 'Mein Plan',
          plan_date: state.plan_date,
          note: state.note.trim() || null,
          event_ids: state.events.map(e => e.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Speichern fehlgeschlagen (${res.status})`);
        setSaving(false);
        return;
      }
      const data = await res.json();
      const planId = initialPlan?.id ?? data.plan?.id;
      if (mode === 'sheet' && onClose) {
        onClose();
        if (planId) router.push(`/plan/${planId}`);
      } else if (planId) {
        router.push(`/plan/${planId}`);
      } else {
        router.push('/saved');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const containerClass = mode === 'sheet'
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur p-4'
    : 'min-h-screen bg-[var(--v4-surface)]';
  const cardClass = mode === 'sheet'
    ? 'relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] shadow-2xl p-6 md:p-8'
    : 'max-w-[640px] mx-auto px-4 md:px-14 py-8 md:py-12';

  const closeButton = mode === 'sheet' && onClose ? (
    <button
      type="button"
      onClick={onClose}
      aria-label="Schließen"
      className="press-haptic absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)] hover:bg-[var(--v4-surface-elevated)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  ) : null;

  // ───────────────────────────────────────────────────────────────
  // QUICK MODE — single-card Form vom Event-Detail aus
  // ───────────────────────────────────────────────────────────────
  if (quickMode && initialEvent) {
    return (
      <div className={containerClass} onClick={mode === 'sheet' ? onClose : undefined}>
        <div className={cardClass} onClick={e => e.stopPropagation()}>
          {closeButton}

          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">Abend planen</p>
          <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-6 leading-tight">
            Plan für dieses Event
          </h2>

          <div className="flex flex-col gap-5">
            {/* Event als read-only Card */}
            <div className="rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] p-4">
              <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-match)] mb-1.5">Event</p>
              <p className="text-[15px] font-bold text-[var(--v4-ink)] leading-tight tracking-[-0.015em] mb-1">{initialEvent.title}</p>
              <p className="text-[12.5px] text-[var(--v4-ink-70)]">
                {formatEventDate(initialEvent.start_date)}
                {initialEvent.location_name ? ` · ${initialEvent.location_name}` : ''}
              </p>
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="plan-name-quick" className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Name (optional)</label>
              <input
                id="plan-name-quick"
                type="text"
                value={state.name}
                onChange={e => updateState({ name: e.target.value })}
                placeholder="Z.B. Mit Anna im Konzert"
                className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
              />
            </div>

            {/* Notiz */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="plan-note-quick" className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Notiz (optional)</label>
              <textarea
                id="plan-note-quick"
                value={state.note}
                onChange={e => updateState({ note: e.target.value })}
                placeholder="Z.B. Treffpunkt vorm Eingang, 18:00 — Anreise mit Öffis"
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[14px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)] resize-y min-h-[100px]"
              />
            </div>
          </div>

          {error && <p className="mt-4 text-[13px] text-[var(--v4-alert)]">{error}</p>}

          <div className="flex items-center justify-between gap-3 mt-8">
            <button
              type="button"
              onClick={() => mode === 'sheet' ? onClose?.() : router.back()}
              className="press-haptic px-4 py-2.5 rounded-full border border-[var(--v4-hairline-2)] text-[13.5px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-go)] text-[#0a0a0c] text-[13.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern …' : 'Plan speichern'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────
  // WIZARD MODE — 3-Step für /plan/new + Edit-Modus
  // ───────────────────────────────────────────────────────────────
  return (
    <div className={containerClass} onClick={mode === 'sheet' ? onClose : undefined}>
      <div className={cardClass} onClick={e => e.stopPropagation()}>
        {closeButton}

        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">{initialPlan ? 'Plan bearbeiten' : 'Neuer Plan'}</p>
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-6 leading-tight">
          {step === 1 ? 'Wann ist der Abend?' : step === 2 ? 'Welche Events?' : 'Notiz dazu?'}
        </h2>

        <V4Stepper current={step} steps={STEPS}/>

        {step === 1 && (
          <V4PlanWizardStep1 state={state} update={updateState}/>
        )}
        {step === 2 && (
          <V4PlanWizardStep2 state={state} update={updateState}/>
        )}
        {step === 3 && (
          <V4PlanWizardStep3 state={state} update={updateState}/>
        )}

        {error && (
          <p className="mt-4 text-[13px] text-[var(--v4-alert)]">{error}</p>
        )}

        <div className="flex items-center justify-between gap-3 mt-8">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : (mode === 'sheet' ? onClose?.() : router.back())}
            className="press-haptic px-4 py-2.5 rounded-full border border-[var(--v4-hairline-2)] text-[13.5px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
          >
            {step > 1 ? 'Zurück' : 'Abbrechen'}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13.5px] font-semibold"
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-go)] text-[#0a0a0c] text-[13.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern …' : 'Speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

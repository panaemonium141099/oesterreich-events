'use client';

/**
 * V4PlanWizard — Designer-aligned (Phase 6).
 *
 * Flow nach Anthropic-Design-Bundle (mockups/v4-wizard.jsx):
 *
 *   (Step 0 · Event wählen — nur wenn kein initialEvent)
 *   Step 1 · Tickets
 *   Step 2 · Anreise (ÖBB-Scotty)
 *   Step 3 · Unterkunft (booking.com — User-Erweiterung, gleicher Stil)
 *   Step 4 · Reminder (7d / 1d / 3h)
 *   Step 5 · Übersicht
 *   → Success-State nach "Plan speichern"
 *
 * Dual-mount:
 *   - mode='sheet': Overlay über Event-Detail (mit initialEvent + onClose)
 *   - mode='page':  /plan/new oder /plan/[id]/edit
 *
 * Wenn `initialEvent` gesetzt: Wir starten direkt in Step 1 (Tickets) und
 * überspringen Event-Auswahl (Step 0). Im Designer ist Event ja immer
 * gesetzt — wir folgen dem.
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { V4Stepper } from '@/components/Events/v4';
import type { Event } from '@/types/events';
import type { PlanItemStatus, ArrivalMode } from '@/types/plans';
import { V4PlanWizardStep2 } from './V4PlanWizardStep2';
import { V4WizardStepTickets } from './wizard/V4WizardStepTickets';
import { V4WizardStepArrival } from './wizard/V4WizardStepArrival';
import { V4WizardStepAccommodation } from './wizard/V4WizardStepAccommodation';
import { V4WizardStepReminder } from './wizard/V4WizardStepReminder';
import { V4WizardStepOverview } from './wizard/V4WizardStepOverview';
import { deriveAccommodationCity } from '@/lib/plans/deep-links';

export interface WizardState {
  name: string;
  plan_date: string;          // ISO YYYY-MM-DD
  note: string;
  events: Event[];
  // Tickets
  tickets_status: PlanItemStatus;
  // Anreise
  arrival_status: PlanItemStatus;
  arrival_mode: ArrivalMode | null;
  arrival_from: string;
  // Unterkunft
  accommodation_status: PlanItemStatus;
  accommodation_city: string;
  // Reminder
  reminder_7d: boolean;
  reminder_1d: boolean;
  reminder_3h: boolean;
}

interface V4PlanWizardProps {
  mode: 'sheet' | 'page';
  initialEvent?: Event;
  /**
   * Prefill wizard state without binding a DB event. Used when starting
   * a plan from a festival without parent_event_id — name/date/city are
   * already filled and the picker step is skipped, but events stays
   * empty so the save API doesn't hit an FK violation.
   */
  initialPrefill?: { name?: string; plan_date?: string; accommodation_city?: string };
  initialPlan?: { id: string; state: WizardState };
  onClose?: () => void;
}

const DESIGNER_STEPS = ['Tickets', 'Anreise', 'Unterkunft', 'Reminder', 'Übersicht'];

function defaultState(initialEvent?: Event, initialPrefill?: V4PlanWizardProps['initialPrefill']): WizardState {
  const today = new Date().toISOString().slice(0, 10);
  const base: WizardState = {
    name: '',
    plan_date: today,
    note: '',
    events: [],
    tickets_status: 'open',
    arrival_status: 'open',
    arrival_mode: null,
    arrival_from: '',
    accommodation_status: 'open',
    accommodation_city: '',
    reminder_7d: true,
    reminder_1d: true,
    reminder_3h: true,
  };
  if (initialEvent) {
    const eventDate = (initialEvent.start_date || '').slice(0, 10);
    const city = deriveAccommodationCity([initialEvent]);
    return {
      ...base,
      name: city ? `Abend in ${city}` : `Plan rund um ${initialEvent.title}`,
      plan_date: eventDate || today,
      events: [initialEvent],
      accommodation_city: city,
    };
  }
  if (initialPrefill) {
    return {
      ...base,
      name: initialPrefill.name ?? base.name,
      plan_date: initialPrefill.plan_date ?? base.plan_date,
      accommodation_city: initialPrefill.accommodation_city ?? base.accommodation_city,
    };
  }
  return base;
}

export function V4PlanWizard({ mode, initialEvent, initialPrefill, initialPlan, onClose }: V4PlanWizardProps) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(() =>
    initialPlan?.state ?? defaultState(initialEvent, initialPrefill),
  );
  // Step 0 = Event wählen. Skip it when we have an event already, or when
  // initialPrefill signals an external entry point (e.g. festival) where
  // the picker is not needed.
  const startStep = (state.events.length > 0 || initialPrefill) ? 1 : 0;
  const [step, setStep] = useState(startStep);
  const [saving, setSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  // When the wizard is opened from a festival without parent_event_id,
  // state.events is empty (so the save POST doesn't violate the events
  // FK) but the Designer-Step components still want an Event-shaped
  // object to render the summary card, derive the ticket provider, etc.
  // Build a render-only pseudo-event from initialPrefill in that case —
  // it lives only inside this component and never reaches the API.
  const pseudoEvent = useMemo<Event | null>(() => {
    if (!initialPrefill) return null;
    return {
      id: '',
      source_id: null,
      source_name: null,
      source_url: null,
      title: initialPrefill.name ?? '',
      description: null,
      start_date: initialPrefill.plan_date ?? '',
      end_date: null,
      location_name: initialPrefill.accommodation_city ?? null,
      address: null,
      postal_code: null,
      bundesland: null,
      district: null,
      latitude: null,
      longitude: null,
      category: null,
      price_text: null,
      price_min: null,
      price_max: null,
      image_url: null,
      organizer: null,
      tags: null,
      ticket_url: null,
    } as Event;
  }, [initialPrefill]);

  const primaryEvent = state.events[0] ?? pseudoEvent ?? undefined;
  const hasEvent = !!primaryEvent;
  const designerStep = step; // 1..5

  // Default-Stadt für Unterkunft setzen wenn noch leer & Event vorhanden
  const derivedCity = useMemo(() => deriveAccommodationCity(state.events), [state.events]);
  if (hasEvent && !state.accommodation_city && derivedCity) {
    // Side-effect via render is OK hier weil idempotent
    queueMicrotask(() => update({ accommodation_city: derivedCity }));
  }

  const planDate = hasEvent
    ? (primaryEvent.start_date || '').slice(0, 10) || state.plan_date
    : state.plan_date;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = initialPlan ? `/api/plans/${initialPlan.id}` : '/api/plans';
      const method = initialPlan ? 'PATCH' : 'POST';
      const finalName = state.name.trim() || (primaryEvent ? `Abend mit ${primaryEvent.title}` : 'Mein Plan');
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalName,
          plan_date: planDate,
          note: state.note.trim() || null,
          event_ids: state.events.map(e => e.id),
          tickets_status: state.tickets_status,
          arrival_status: state.arrival_status,
          arrival_mode: state.arrival_mode,
          arrival_from: state.arrival_from.trim() || null,
          accommodation_status: state.accommodation_status,
          accommodation_city: state.accommodation_city.trim() || null,
          reminder_7d: state.reminder_7d,
          reminder_1d: state.reminder_1d,
          reminder_3h: state.reminder_3h,
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
      setSavedPlanId(planId ?? null);
      setSaving(false);
      // Stay on Success-State; user clicks "Plan ansehen" oder Sheet schließt
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  // ─── Layout ──────────────────────────────────────────────────
  const containerClass = mode === 'sheet'
    ? 'fixed inset-0 z-50 flex items-start md:items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur p-3 md:p-6 overflow-y-auto'
    : 'min-h-screen bg-[var(--v4-surface)] py-6 md:py-12';
  const cardClass = mode === 'sheet'
    ? 'relative w-full max-w-[680px] my-auto rounded-3xl bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] shadow-2xl p-5 md:p-8'
    : 'max-w-[680px] mx-auto px-4 md:px-10';

  const closeButton = mode === 'sheet' && onClose ? (
    <button
      type="button"
      onClick={onClose}
      aria-label="Schließen"
      className="press-haptic absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)] hover:bg-[var(--v4-surface-elevated)] z-10"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  ) : null;

  // ─── Success-State ───────────────────────────────────────────
  if (savedPlanId) {
    return (
      <div className={containerClass} onClick={mode === 'sheet' ? onClose : undefined}>
        <div className={cardClass} onClick={e => e.stopPropagation()}>
          {closeButton}
          <div className="text-center py-8 md:py-12">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[color-mix(in_oklab,var(--v4-go)_18%,transparent)] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--v4-go)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-2">Plan gespeichert.</h2>
            <p className="text-[14px] text-[var(--v4-ink-70)] max-w-[420px] mx-auto leading-relaxed">
              Du findest ihn jederzeit unter „Meine Pläne“. Reminder feuern automatisch — keine Notification-Wand.
            </p>
            <div className="flex items-center justify-center gap-3 mt-7 flex-wrap">
              {/*
                Hard-Navigation via window.location: wenn der Wizard als Sheet
                über der Event-Detail-Page läuft, würde router.push() in der
                gleichen Render-Phase als der onClose-State-Update einen
                Race-Condition triggern (URL ändert sich, aber Next.js
                schafft kein soft-render mehr weil der Wizard schon
                unmounted ist). Full-Page-Load ist hier ohnehin gewünscht —
                der Plan ist frisch und braucht keinen Client-State.
              */}
              <a
                href={`/plan/${savedPlanId}`}
                className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13.5px] font-semibold no-underline"
              >
                Plan ansehen
              </a>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'sheet' && onClose) onClose();
                  else window.location.assign('/saved');
                }}
                className="press-haptic px-4 py-2.5 rounded-full border border-[var(--v4-hairline-2)] text-[13.5px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 0 — Event wählen (only if no initialEvent) ─────────
  if (step === 0) {
    return (
      <div className={containerClass} onClick={mode === 'sheet' ? onClose : undefined}>
        <div className={cardClass} onClick={e => e.stopPropagation()}>
          {closeButton}

          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">Neuer Plan</p>
          <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-6 leading-tight">Welches Event?</h2>

          <V4PlanWizardStep2 state={state} update={update}/>

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
              disabled={!hasEvent}
              onClick={() => setStep(1)}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13.5px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Weiter zu Tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Designer-Steps 1-5 ──────────────────────────────────────
  if (!hasEvent) {
    // Schutz: sollte nicht passieren — wir gehen zurück zu Step 0
    setStep(0);
    return null;
  }

  const eventForHelpers = primaryEvent;
  const ticketUrl = eventForHelpers.ticket_url || null;
  const hasTicketProvider = !!ticketUrl;
  // Provider-Name aus Domain ableiten (oeticket.com → "oeticket")
  let providerName: string | null = null;
  if (ticketUrl) {
    try {
      const host = new URL(ticketUrl).hostname.replace(/^www\./, '');
      providerName = host.split('.')[0] || null;
    } catch { providerName = null; }
  }

  return (
    <div className={containerClass} onClick={mode === 'sheet' ? onClose : undefined}>
      <div className={cardClass} onClick={e => e.stopPropagation()}>
        {closeButton}

        {/* Stepper */}
        <div className="mb-6 -mx-1 overflow-x-auto">
          <V4Stepper current={designerStep} steps={DESIGNER_STEPS}/>
        </div>

        {designerStep === 1 && (
          <V4WizardStepTickets
            event={eventForHelpers}
            status={state.tickets_status}
            onStatus={s => update({ tickets_status: s })}
            hasTicketProvider={hasTicketProvider}
            ticketUrl={ticketUrl}
            providerName={providerName}
          />
        )}
        {designerStep === 2 && (
          <V4WizardStepArrival
            event={eventForHelpers}
            planDate={planDate}
            status={state.arrival_status}
            onStatus={s => update({ arrival_status: s })}
            mode={state.arrival_mode}
            onMode={m => update({ arrival_mode: m, arrival_status: m ? 'open' : state.arrival_status })}
            from={state.arrival_from}
            onFrom={v => update({ arrival_from: v })}
          />
        )}
        {designerStep === 3 && (
          <V4WizardStepAccommodation
            planDate={planDate}
            status={state.accommodation_status}
            onStatus={s => update({ accommodation_status: s })}
            city={state.accommodation_city}
            onCity={v => update({ accommodation_city: v })}
          />
        )}
        {designerStep === 4 && (
          <V4WizardStepReminder
            event={eventForHelpers}
            reminder_7d={state.reminder_7d}
            reminder_1d={state.reminder_1d}
            reminder_3h={state.reminder_3h}
            onReminder={(key, next) => update({ [key]: next } as Partial<WizardState>)}
          />
        )}
        {designerStep === 5 && (
          <V4WizardStepOverview
            event={eventForHelpers}
            planName={state.name}
            planDate={planDate}
            note={state.note}
            tickets_status={state.tickets_status}
            arrival_status={state.arrival_status}
            arrival_mode={state.arrival_mode}
            arrival_from={state.arrival_from}
            accommodation_status={state.accommodation_status}
            accommodation_city={state.accommodation_city}
            reminder_7d={state.reminder_7d}
            reminder_1d={state.reminder_1d}
            reminder_3h={state.reminder_3h}
          />
        )}

        {error && <p className="mt-4 text-[13px] text-[var(--v4-alert)]">{error}</p>}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 mt-8">
          <button
            type="button"
            onClick={() => {
              if (designerStep > 1) {
                setStep(designerStep - 1);
              } else if (startStep === 0) {
                setStep(0); // back to event selection
              } else {
                mode === 'sheet' ? onClose?.() : router.back();
              }
            }}
            className="press-haptic px-4 py-2.5 rounded-full border border-[var(--v4-hairline-2)] text-[13.5px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
          >
            {designerStep > 1 ? 'Zurück' : startStep === 0 ? 'Zurück' : 'Abbrechen'}
          </button>
          {designerStep < 5 ? (
            <button
              type="button"
              onClick={() => setStep(designerStep + 1)}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13.5px] font-semibold"
            >
              {designerStep === 1 ? 'Weiter zur Anreise'
                : designerStep === 2 ? 'Weiter zur Unterkunft'
                : designerStep === 3 ? 'Weiter zum Reminder'
                : 'Zur Übersicht'}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-go)] text-[#0a0a0c] text-[13.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern …' : 'Plan speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

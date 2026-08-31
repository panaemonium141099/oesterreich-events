'use client';

/**
 * V4PlanModules — Status-Modul-Karten nach Designer 06b.
 *
 * 4-Spalten-Grid (Desktop) / 2-Spalten (Mobile):
 *   • Ticket   — Status + CTA "Jetzt sichern" / "Schon gekauft" badge
 *   • Anreise  — Mode + Route + CTA "Route bei ÖBB öffnen"
 *   • Unterkunft — Stadt + CTA "Hotels bei booking.com"
 *   • Reminder — N aktive Reminder + CTA "Anpassen" (führt zum Editor)
 *
 * Jede Card hat: Icon-Pill + Label + Primary-Text + Sub + Action-Button.
 * Optional left-edge accent stripe (für offene Tickets / aktive Status).
 */

import type { ReactNode } from 'react';
import type { PlanWithEvents, ArrivalMode, PlanItemStatus } from '@/types/plans';
import { buildOebbScottyUrl, buildBookingUrl } from '@/lib/plans/deep-links';
import { BookingStayWidget } from './BookingStayWidget';

interface Props {
  plan: PlanWithEvents;
}

const MODE_LABELS: Record<ArrivalMode, string> = {
  auto: 'Auto', oeffis: 'Öffis', fuss: 'Zu Fuß', fahrrad: 'Fahrrad',
};

export function V4PlanModules({ plan }: Props) {
  const ev = plan.events[0];
  const ticketUrl = ev?.ticket_url || null;

  // ─── Ticket Module ─────────────────────────────────────────
  const ticketCard = (() => {
    if (plan.tickets_status === 'done') {
      return (
        <ModuleCard
          icon={<IconTicket/>}
          label="Ticket"
          primary="Schon gekauft"
          sub="Du brauchst den Schritt nicht mehr."
          accent="var(--v4-go)"
          badge={{ text: 'Erledigt', color: 'var(--v4-go)' }}
        />
      );
    }
    if (plan.tickets_status === 'skip') {
      return (
        <ModuleCard
          icon={<IconTicket/>}
          label="Ticket"
          primary="Kein Ticket nötig"
          sub="Eintritt frei oder nicht zutreffend."
          dim
        />
      );
    }
    return (
      <ModuleCard
        icon={<IconTicket/>}
        label="Ticket"
        primary={plan.tickets_status === 'later' ? 'Später entscheiden' : 'Tickets offen'}
        sub={ev?.price_text || (ev?.price_min ? `ab ${ev.price_min} €` : 'Beim Anbieter sichern')}
        accent="var(--v4-ticket)"
        action={ticketUrl ? (
          <ExternalAction href={ticketUrl} accent="var(--v4-ticket)" inkColor="#0a0a0c">
            Jetzt sichern{ev?.price_min ? ` · ab ${ev.price_min} €` : ''}
          </ExternalAction>
        ) : undefined}
      />
    );
  })();

  // ─── Anreise Module ────────────────────────────────────────
  const arrivalCard = (() => {
    if (plan.arrival_status === 'skip') {
      return <ModuleCard icon={<IconNav/>} label="Anreise" primary="Übersprungen" sub="Du regelst die Anreise selbst." dim/>;
    }
    if (!plan.arrival_mode) {
      return <ModuleCard icon={<IconNav/>} label="Anreise" primary="Noch nicht festgelegt" sub="Wähle Modus + Startpunkt." dim/>;
    }
    const oebbUrl = ev && plan.arrival_mode === 'oeffis'
      ? buildOebbScottyUrl(ev, plan.arrival_from, plan.plan_date)
      : null;
    return (
      <ModuleCard
        icon={<IconNav/>}
        label="Anreise"
        primary={`${MODE_LABELS[plan.arrival_mode]}${plan.arrival_mode === 'oeffis' ? ' · ÖBB' : ''}`}
        sub={plan.arrival_from ? `Von ${plan.arrival_from}` : 'Startpunkt nicht gesetzt'}
        accent="var(--v4-go)"
        action={oebbUrl ? (
          <ExternalAction href={oebbUrl}>Route bei ÖBB öffnen</ExternalAction>
        ) : undefined}
      />
    );
  })();

  // ─── Unterkunft Module ─────────────────────────────────────
  const accCard = (() => {
    if (plan.accommodation_status === 'skip') {
      return <ModuleCard icon={<IconBed/>} label="Unterkunft" primary="Keine Übernachtung" sub="Plan ist tagesbasiert." dim/>;
    }
    if (plan.accommodation_status === 'done') {
      return (
        <ModuleCard
          icon={<IconBed/>}
          label="Unterkunft"
          primary="Schon gebucht"
          sub={plan.accommodation_city || 'Bestätigung beim Anbieter'}
          accent="var(--v4-go)"
          badge={{ text: 'Erledigt', color: 'var(--v4-go)' }}
        />
      );
    }
    const city = plan.accommodation_city?.trim();
    const bookingUrl = city ? buildBookingUrl(city, plan.plan_date, 1) : null;
    return (
      <ModuleCard
        icon={<IconBed/>}
        label="Unterkunft"
        primary={city ? `Hotels in ${city}` : 'Stadt nicht gesetzt'}
        sub={city ? 'Noch nicht gebucht. Suche bei booking.com.' : 'Wähle eine Stadt im Wizard.'}
        dim={!city}
        action={bookingUrl ? (
          <ExternalAction href={bookingUrl}>Bei booking.com ansehen</ExternalAction>
        ) : undefined}
      />
    );
  })();

  // ─── Reminder Module ───────────────────────────────────────
  const reminderCount = [plan.reminder_7d, plan.reminder_1d, plan.reminder_3h].filter(Boolean).length;
  const reminderCard = (
    <ModuleCard
      icon={<IconBell/>}
      label="Reminder"
      primary={reminderCount > 0 ? `${reminderCount} aktiv` : 'Keine Erinnerung'}
      sub={reminderCount > 0 ? remindersDetail(plan) : 'Wir schicken dir nichts.'}
      accent={reminderCount > 0 ? 'var(--v4-match)' : undefined}
      dim={reminderCount === 0}
    />
  );

  // fn-21: Booking-Suchwidget nur solange die Unterkunft offen ist —
  // erledigt/übersprungen braucht keine Suche.
  const showStayWidget = plan.accommodation_status !== 'skip' && plan.accommodation_status !== 'done';

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {ticketCard}
        {arrivalCard}
        {accCard}
        {reminderCard}
      </div>
      {showStayWidget && <BookingStayWidget />}
    </div>
  );
}

// ─── ModuleCard ────────────────────────────────────────────────

interface ModuleCardProps {
  icon: ReactNode;
  label: string;
  primary: string;
  sub?: string;
  accent?: string;
  dim?: boolean;
  action?: ReactNode;
  badge?: { text: string; color: string };
}

function ModuleCard({ icon, label, primary, sub, accent, dim, action, badge }: ModuleCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${dim ? 'border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)]/60' : 'border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)]'} p-4 md:p-[18px] flex flex-col gap-2.5`}
    >
      {accent && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} aria-hidden="true"/>
      )}
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 flex-shrink-0 rounded-lg border border-[var(--v4-hairline-1)] flex items-center justify-center bg-[var(--v4-surface-inset)] ${dim ? 'text-[var(--v4-ink-50)]' : 'text-[var(--v4-ink-70)]'}`}>
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--v4-ink-50)]">{label}</span>
        {badge && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: badge.color, background: `color-mix(in oklab, ${badge.color} 12%, transparent)` }}>
            {badge.text}
          </span>
        )}
      </div>
      <div>
        <p className="text-[15px] md:text-[16px] font-bold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">{primary}</p>
        {sub && <p className="text-[12px] text-[var(--v4-ink-50)] mt-1 leading-snug">{sub}</p>}
      </div>
      {action && <div className="mt-auto pt-1">{action}</div>}
    </div>
  );
}

function ExternalAction({ href, children, accent, inkColor }: { href: string; children: ReactNode; accent?: string; inkColor?: string }) {
  const isPrimary = !!accent;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`press-haptic inline-flex items-center justify-center gap-1.5 w-full px-3.5 py-2 rounded-full text-[12px] font-semibold ${isPrimary ? '' : 'border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]'}`}
      style={isPrimary ? { background: accent, color: inkColor || '#0a0a0c' } : undefined}
    >
      {children}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
      </svg>
    </a>
  );
}

function remindersDetail(plan: PlanWithEvents): string {
  const parts: string[] = [];
  if (plan.reminder_7d) parts.push('7 T');
  if (plan.reminder_1d) parts.push('1 T');
  if (plan.reminder_3h) parts.push('3 Std');
  return parts.length ? parts.join(' · ') + ' vorher' : 'Keine';
}

// ─── Icons ─────────────────────────────────────────────────────

function IconTicket() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
      <line x1="13" y1="5" x2="13" y2="19"/>
    </svg>
  );
}
function IconNav() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  );
}
function IconBed() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

// `PlanItemStatus` unused but kept for type-completeness — silence linter.
export type __ImportType = PlanItemStatus;

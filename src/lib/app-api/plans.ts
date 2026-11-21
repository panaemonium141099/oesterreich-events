/**
 * Pläne für die native App: Liste, Detail und Entwurf als anzeigefertige
 * Werte. Die Regeln sind die der Website (`src/components/Plans/v4/`):
 * Datumsbox und Status-Zeilen der Plan-Karte (`V4PlanCard`), Kennzahlen
 * (`V4SavedStats`), Module Ticket/Anreise/Unterkunft/Reminder
 * (`V4PlanModules`), Kopf und Countdown-Ziel (`V4PlanHero`,
 * `V4PlanCountdown`) und die Vorbelegung des Assistenten (`V4PlanWizard`).
 *
 * Pur: keine Abfragen, die Uhr kommt als Argument. Geschrieben wird weiter
 * über `/api/plans` (POST, PATCH, DELETE); `state` trägt deshalb genau die
 * Feldnamen dieses Bodys.
 */
import { buildBookingUrl, buildOebbScottyUrl, deriveAccommodationCity } from '@/lib/plans/deep-links';
import { DE_LOCALE } from '@/lib/site/intl';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { EVENT_TZ, viennaDayDiff, viennaDayStart, viennaToday } from '@/lib/utils/event-time';
import type { Event } from '@/types/events';
import type { ArrivalMode, Plan, PlanItemStatus, PlanWithEvents } from '@/types/plans';
import { toAppEventCard, type AppEventCard, type AppLandingContext } from './landing';

export const APP_PLANS_VERSION = 1;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type AppPlanBadgeKind = 'open' | 'done' | 'skip' | 'later' | 'plan';
export type AppPlanAccent = 'go' | 'ticket' | 'match';

export interface AppPlanBadge {
  kind: AppPlanBadgeKind;
  label: string;
}

export interface AppPlanReminder {
  key: '7d' | '1d' | '3h';
  /** Zeitpunkt der Erinnerung (UTC). */
  at: string;
  label: string;
}

export interface AppPlanSummary {
  id: string;
  name: string;
  planDate: string;
  dateBox: { dow: string; day: string; mon: string };
  /** „2 Events · Titel des ersten". */
  eventsLabel: string;
  badges: AppPlanBadge[];
  /** Aktive Erinnerungen mit Zeitpunkt: die App plant daraus ihre Mitteilungen. */
  reminders: AppPlanReminder[];
}

export interface AppPlanStat {
  label: string;
  value: number;
  sub: string;
  accent: AppPlanAccent | null;
}

export interface AppPlanList {
  version: typeof APP_PLANS_VERSION;
  /** Leer, solange es keinen Plan gibt. */
  stats: AppPlanStat[];
  /** Nächster Termin zuerst. */
  upcoming: AppPlanSummary[];
  /** Jüngster zuerst. */
  past: AppPlanSummary[];
}

/** Felder eines Plans, wie `/api/plans` sie beim Schreiben erwartet. */
export interface AppPlanState {
  name: string;
  plan_date: string;
  note: string | null;
  event_ids: string[];
  tickets_status: PlanItemStatus;
  arrival_status: PlanItemStatus;
  arrival_mode: ArrivalMode | null;
  arrival_from: string | null;
  accommodation_status: PlanItemStatus;
  accommodation_city: string | null;
  reminder_7d: boolean;
  reminder_1d: boolean;
  reminder_3h: boolean;
}

/** Was der Assistent zu einem Plan anzeigt und vorbelegt. */
export interface AppPlanDraft {
  /** Das Event, um das der Plan gebaut ist; null bei einem Plan ohne Event. */
  event: AppEventCard | null;
  /** „Samstag, 5. Dezember 2026". */
  dateLabel: string;
  ticket: { url: string; provider: string | null; priceLabel: string | null } | null;
  /** Ziel der Anreise in Worten. */
  destination: string;
  /** ÖBB-Routenplaner zum Ziel ohne Startort; die App hängt `&S=<Start>` an. */
  oebbUrl: string | null;
  state: AppPlanState;
}

export interface AppPlanModule {
  key: 'ticket' | 'arrival' | 'stay' | 'reminder';
  label: string;
  primary: string;
  sub: string;
  accent: AppPlanAccent | null;
  dim: boolean;
  badge: string | null;
  action: { label: string; url: string; primary: boolean } | null;
}

export interface AppPlanDetail {
  version: typeof APP_PLANS_VERSION;
  id: string;
  name: string;
  planDate: string;
  dateLabel: string;
  /** „In 5 Tagen", „Heute", „Vergangen". */
  statusLabel: string;
  isPast: boolean;
  ticketsOpen: boolean;
  image: string | null;
  place: string | null;
  /** Ziel des Countdowns: Beginn des ersten Events, sonst 19 Uhr am Plantag. */
  target: string;
  /** Aktive Erinnerungen mit Zeitpunkt, früheste zuerst. */
  reminders: AppPlanReminder[];
  modules: AppPlanModule[];
  events: AppEventCard[];
  note: string | null;
  draft: AppPlanDraft;
}

const STATUS_LABEL: Record<PlanItemStatus, string> = {
  open: 'offen',
  done: 'erledigt',
  skip: 'nicht nötig',
  later: 'später',
};

const MODE_LABEL: Record<ArrivalMode, string> = {
  auto: 'Auto',
  oeffis: 'Öffis',
  fuss: 'Zu Fuß',
  fahrrad: 'Fahrrad',
};

/** Kurzform in der Status-Zeile der Karte („zu Fuß" klein, wie `V4PlanCard`). */
const MODE_LABEL_SHORT: Record<ArrivalMode, string> = { ...MODE_LABEL, fuss: 'zu Fuß' };

/** Mittag UTC: derselbe Kalendertag in Wien, egal ob Sommer- oder Winterzeit. */
function planDay(planDate: string): Date {
  return new Date(`${planDate}T12:00:00Z`);
}

function longDate(planDate: string): string {
  const d = planDay(planDate);
  if (Number.isNaN(d.getTime())) return planDate;
  return d.toLocaleDateString(DE_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: EVENT_TZ,
  });
}

function reminderCount(plan: Plan): number {
  return [plan.reminder_7d, plan.reminder_1d, plan.reminder_3h].filter(Boolean).length;
}

function summaryBadges(plan: Plan): AppPlanBadge[] {
  const badges: AppPlanBadge[] = [
    { kind: plan.tickets_status, label: `Tickets: ${STATUS_LABEL[plan.tickets_status]}` },
    plan.arrival_mode
      ? { kind: 'plan', label: `Anreise: ${MODE_LABEL_SHORT[plan.arrival_mode]}` }
      : { kind: plan.arrival_status, label: `Anreise: ${STATUS_LABEL[plan.arrival_status]}` },
  ];
  if (plan.accommodation_status !== 'skip' && (plan.accommodation_status === 'done' || plan.accommodation_city)) {
    badges.push({ kind: plan.accommodation_status, label: `Hotel: ${STATUS_LABEL[plan.accommodation_status]}` });
  }
  const reminders = reminderCount(plan);
  badges.push(
    reminders > 0 ? { kind: 'done', label: `${reminders} Reminder` } : { kind: 'skip', label: 'Keine Reminder' },
  );
  return badges;
}

/** Ziel des Countdowns: Beginn des ersten Events, sonst 19 Uhr Wiener Zeit am Plantag. */
export function planTarget(planDate: string, firstStart: string | null): Date {
  const start = firstStart ? new Date(firstStart) : null;
  return start && !Number.isNaN(start.getTime())
    ? start
    : new Date(viennaDayStart(planDate).getTime() + 19 * HOUR_MS);
}

/** Aktive Erinnerungen eines Plans mit Zeitpunkt, früheste zuerst. */
export function planReminders(plan: Plan, target: Date): AppPlanReminder[] {
  const reminders: AppPlanReminder[] = [];
  if (plan.reminder_7d) reminders.push({ key: '7d', at: new Date(target.getTime() - 7 * DAY_MS).toISOString(), label: 'Wetter und Anfahrt prüfen' });
  if (plan.reminder_1d) reminders.push({ key: '1d', at: new Date(target.getTime() - DAY_MS).toISOString(), label: 'Letzter Check: alles da?' });
  if (plan.reminder_3h) reminders.push({ key: '3h', at: new Date(target.getTime() - 3 * HOUR_MS).toISOString(), label: 'Aufbrechen und Route öffnen' });
  return reminders;
}

/** Je Plan: Zahl der Events, Titel und Beginn des ersten. */
export type AppPlanMeta = Record<string, { count: number; firstTitle: string | null; firstStart?: string | null }>;

export function toAppPlanSummary(plan: Plan, meta: AppPlanMeta[string] | undefined): AppPlanSummary {
  const d = planDay(plan.plan_date);
  const part = (options: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString(DE_LOCALE, { ...options, timeZone: EVENT_TZ }).replace(/\.$/, '');
  const count = meta?.count ?? 0;
  const first = meta?.firstTitle ? decodeEntities(meta.firstTitle) : null;
  return {
    id: plan.id,
    name: plan.name,
    planDate: plan.plan_date,
    dateBox: { dow: part({ weekday: 'short' }), day: part({ day: 'numeric' }), mon: part({ month: 'short' }) },
    eventsLabel: `${count} ${count === 1 ? 'Event' : 'Events'}${first ? ` · ${first}` : ''}`,
    badges: summaryBadges(plan),
    reminders: planReminders(plan, planTarget(plan.plan_date, meta?.firstStart ?? null)),
  };
}

export function toAppPlanList(plans: Plan[], meta: AppPlanMeta, now: Date): AppPlanList {
  const today = viennaToday(now);
  const upcomingPlans = plans
    .filter(p => p.plan_date >= today)
    .sort((a, b) => a.plan_date.localeCompare(b.plan_date));
  const pastPlans = plans.filter(p => p.plan_date < today).sort((a, b) => b.plan_date.localeCompare(a.plan_date));

  const ticketsOpen = upcomingPlans.filter(p => p.tickets_status === 'open').length;
  const arrivalOpen = upcomingPlans.filter(p => p.arrival_status === 'open' && !p.arrival_mode).length;
  const remindersActive = upcomingPlans.filter(p => reminderCount(p) > 0).length;

  return {
    version: APP_PLANS_VERSION,
    stats:
      plans.length === 0
        ? []
        : [
            { label: 'Anstehende Pläne', value: upcomingPlans.length, sub: 'gesamt', accent: null },
            {
              label: 'Tickets offen',
              value: ticketsOpen,
              sub: ticketsOpen ? 'noch nicht gesichert' : 'alle sortiert',
              accent: 'ticket',
            },
            {
              label: 'Anreise offen',
              value: arrivalOpen,
              sub: arrivalOpen ? 'Anreise noch nicht gewählt' : 'überall geplant',
              accent: null,
            },
            {
              label: 'Reminder aktiv',
              value: remindersActive,
              sub: `von ${upcomingPlans.length} ${upcomingPlans.length === 1 ? 'Plan' : 'Plänen'}`,
              accent: 'go',
            },
          ],
    upcoming: upcomingPlans.map(p => toAppPlanSummary(p, meta[p.id])),
    past: pastPlans.map(p => toAppPlanSummary(p, meta[p.id])),
  };
}

/** Anbietername aus dem Ticketlink, wie der Assistent der Website („oeticket"). */
function providerOf(ticketUrl: string): string | null {
  try {
    return new URL(ticketUrl).hostname.replace(/^www\./, '').split('.')[0] || null;
  } catch {
    return null;
  }
}

function priceLabelOf(event: Event): string | null {
  if (event.price_text) return decodeEntities(event.price_text);
  return event.price_min ? `ab ${event.price_min} €` : null;
}

/**
 * Standardwerte eines neuen Plans rund um ein Event (wie `defaultState` des
 * Assistenten). `postOrt` ist der Post-Ort der PLZ des Events; ohne ihn gilt
 * die Ableitung der Website aus dem Namen des Veranstaltungsorts, die bei
 * „Veranstaltungszentrum Ottendorf" den Saal statt der Stadt liefert.
 */
export function defaultPlanState(event: Event, now: Date, postOrt: string | null = null): AppPlanState {
  const city = postOrt?.trim() || deriveAccommodationCity([event]);
  return {
    name: city ? `Abend in ${city}` : `Plan rund um ${decodeEntities(event.title ?? '')}`,
    plan_date: (event.start_date || '').slice(0, 10) || viennaToday(now),
    note: null,
    event_ids: [event.id],
    tickets_status: 'open',
    arrival_status: 'open',
    arrival_mode: null,
    arrival_from: null,
    accommodation_status: 'open',
    accommodation_city: city || null,
    reminder_7d: true,
    reminder_1d: true,
    reminder_3h: true,
  };
}

export function toAppPlanDraft(event: Event | null, state: AppPlanState, ctx: AppLandingContext): AppPlanDraft {
  return {
    event: event ? toAppEventCard(event, ctx) : null,
    dateLabel: longDate(state.plan_date),
    ticket:
      event?.ticket_url
        ? { url: event.ticket_url, provider: providerOf(event.ticket_url), priceLabel: priceLabelOf(event) }
        : null,
    destination: event ? decodeEntities(event.location_name || event.bundesland || '') || 'Veranstaltungsort' : '',
    oebbUrl: event ? buildOebbScottyUrl(event, null, state.plan_date) : null,
    state,
  };
}

function ticketModule(plan: PlanWithEvents): AppPlanModule {
  const base = { key: 'ticket' as const, label: 'Ticket', badge: null, action: null, dim: false, accent: null };
  const event = plan.events[0];
  if (plan.tickets_status === 'done') {
    return { ...base, primary: 'Schon gekauft', sub: 'Du brauchst den Schritt nicht mehr.', accent: 'go', badge: 'Erledigt' };
  }
  if (plan.tickets_status === 'skip') {
    return { ...base, primary: 'Kein Ticket nötig', sub: 'Eintritt frei oder nicht zutreffend.', dim: true };
  }
  return {
    ...base,
    primary: plan.tickets_status === 'later' ? 'Später entscheiden' : 'Tickets offen',
    sub: (event && priceLabelOf(event)) || 'Beim Anbieter sichern',
    accent: 'ticket',
    action: event?.ticket_url
      ? {
          label: `Jetzt sichern${event.price_min ? ` · ab ${event.price_min} €` : ''}`,
          url: event.ticket_url,
          primary: true,
        }
      : null,
  };
}

function arrivalModule(plan: PlanWithEvents): AppPlanModule {
  const base = { key: 'arrival' as const, label: 'Anreise', badge: null, action: null, dim: false, accent: null };
  if (plan.arrival_status === 'skip') {
    return { ...base, primary: 'Übersprungen', sub: 'Du regelst die Anreise selbst.', dim: true };
  }
  if (!plan.arrival_mode) {
    return { ...base, primary: 'Noch nicht festgelegt', sub: 'Wähle Verkehrsmittel und Startpunkt.', dim: true };
  }
  const event = plan.events[0];
  const oebb = event && plan.arrival_mode === 'oeffis';
  return {
    ...base,
    primary: `${MODE_LABEL[plan.arrival_mode]}${plan.arrival_mode === 'oeffis' ? ' · ÖBB' : ''}`,
    sub: plan.arrival_from ? `Von ${plan.arrival_from}` : 'Startpunkt nicht gesetzt',
    accent: 'go',
    action: oebb
      ? { label: 'Route bei ÖBB öffnen', url: buildOebbScottyUrl(event, plan.arrival_from, plan.plan_date), primary: false }
      : null,
  };
}

function stayModule(plan: PlanWithEvents): AppPlanModule {
  const base = { key: 'stay' as const, label: 'Unterkunft', badge: null, action: null, dim: false, accent: null };
  if (plan.accommodation_status === 'skip') {
    return { ...base, primary: 'Keine Übernachtung', sub: 'Du fährst am selben Tag heim.', dim: true };
  }
  if (plan.accommodation_status === 'done') {
    return {
      ...base,
      primary: 'Schon gebucht',
      sub: plan.accommodation_city || 'Bestätigung beim Anbieter',
      accent: 'go',
      badge: 'Erledigt',
    };
  }
  const city = plan.accommodation_city?.trim();
  return {
    ...base,
    primary: city ? `Hotels in ${city}` : 'Stadt nicht gesetzt',
    sub: city ? 'Noch nicht gebucht. Suche bei booking.com.' : 'Trag beim Bearbeiten eine Stadt ein.',
    dim: !city,
    action: city
      ? { label: 'Bei booking.com ansehen', url: buildBookingUrl(city, plan.plan_date, 1), primary: false }
      : null,
  };
}

function reminderModule(plan: PlanWithEvents): AppPlanModule {
  const count = reminderCount(plan);
  const parts = [plan.reminder_7d && '7 T', plan.reminder_1d && '1 T', plan.reminder_3h && '3 Std'].filter(Boolean);
  return {
    key: 'reminder',
    label: 'Reminder',
    primary: count > 0 ? `${count} aktiv` : 'Keine Erinnerung',
    sub: count > 0 ? `${parts.join(' · ')} vorher` : 'Wir schicken dir nichts.',
    accent: count > 0 ? 'match' : null,
    dim: count === 0,
    badge: null,
    action: null,
  };
}

export function planState(plan: PlanWithEvents): AppPlanState {
  return {
    name: plan.name,
    plan_date: plan.plan_date,
    note: plan.note,
    event_ids: plan.events.map(e => e.id),
    tickets_status: plan.tickets_status,
    arrival_status: plan.arrival_status,
    arrival_mode: plan.arrival_mode,
    arrival_from: plan.arrival_from,
    accommodation_status: plan.accommodation_status,
    accommodation_city: plan.accommodation_city,
    reminder_7d: plan.reminder_7d,
    reminder_1d: plan.reminder_1d,
    reminder_3h: plan.reminder_3h,
  };
}

export function toAppPlanDetail(plan: PlanWithEvents, ctx: AppLandingContext, now: Date): AppPlanDetail {
  const first = plan.events[0];
  const firstCard = first ? toAppEventCard(first, ctx) : null;
  const days = viennaDayDiff(viennaToday(now), plan.plan_date);

  const target = planTarget(plan.plan_date, first?.start_date ?? null);
  const reminders = planReminders(plan, target);

  return {
    version: APP_PLANS_VERSION,
    id: plan.id,
    name: plan.name?.trim() || 'Mein Plan',
    planDate: plan.plan_date,
    dateLabel: longDate(plan.plan_date),
    statusLabel: days < 0 ? 'Vergangen' : days === 0 ? 'Heute' : `In ${days} ${days === 1 ? 'Tag' : 'Tagen'}`,
    isPast: days < 0,
    ticketsOpen: plan.tickets_status === 'open' && Boolean(first?.ticket_url),
    image: firstCard?.imageResolved ?? null,
    place: firstCard?.place || null,
    target: target.toISOString(),
    reminders,
    modules: [ticketModule(plan), arrivalModule(plan), stayModule(plan), reminderModule(plan)],
    events: plan.events.map(e => toAppEventCard(e, ctx)),
    note: plan.note?.trim() || null,
    draft: toAppPlanDraft(first ?? null, planState(plan), ctx),
  };
}

import type { Event } from './events';

/** Designer-Status für Tickets/Anreise/Unterkunft. */
export type PlanItemStatus = 'open' | 'done' | 'skip' | 'later';

/** Verkehrsmittel — match exakt die 4 Transport-Cards aus dem Designer-Wizard. */
export type ArrivalMode = 'auto' | 'oeffis' | 'fuss' | 'fahrrad';

export interface Plan {
  id: string;
  user_id: string;
  name: string;
  plan_date: string;          // ISO YYYY-MM-DD
  note: string | null;
  visibility: 'private' | 'shared';
  // Phase 6 — Tickets
  tickets_status: PlanItemStatus;
  // Phase 6 — Anreise
  arrival_status: PlanItemStatus;
  arrival_mode: ArrivalMode | null;
  arrival_from: string | null;
  // Phase 6 — Unterkunft (Erweiterung gegenüber Designer)
  accommodation_status: PlanItemStatus;
  accommodation_city: string | null;
  // Phase 6 — Reminder
  reminder_7d: boolean;
  reminder_1d: boolean;
  reminder_3h: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  event_id: string;
  position: number;
  added_at: string;
}

export interface PlanWithEvents extends Plan {
  events: Event[];          // hydrated, sorted by position
  event_count: number;
}

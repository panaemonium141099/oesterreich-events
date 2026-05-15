import type { Event } from './events';

export interface Plan {
  id: string;
  user_id: string;
  name: string;
  plan_date: string;          // ISO YYYY-MM-DD
  note: string | null;
  visibility: 'private' | 'shared';
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

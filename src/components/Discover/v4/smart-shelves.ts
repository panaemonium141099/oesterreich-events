/**
 * smart-shelves — reine Ableitung der Regale aus einer Antwort von
 * /api/search/semantic (Variante A der Smart-Suche, 2026-10-23).
 *
 * Zwei Schnitte, je nachdem, was die Antwort hergibt:
 *   - Treffer an mehreren Kalendertagen → ein Regal pro Tag ("Heute",
 *     "Morgen", "Sa 25. Okt."), zeitlich sortiert, höchstens sieben.
 *   - Alles an einem Tag → Regale nach Tagesphase (Vormittag, Nachmittag,
 *     Abend, Nacht), damit sich ein Abend in Etappen lesen lässt; Events
 *     ohne bekannte Uhrzeit bilden ein eigenes Regal am Ende.
 * Ausflugsziele (activityMatches) sind immer ein eigenes Regal.
 *
 * Reine Funktion, keine Formatierung von Texten außer den Tageslabels.
 */

import { addViennaDays, toViennaDate, viennaFields, viennaToday, hasKnownStartTime } from '@/lib/utils/event-time';

export interface ShelfEvent {
  id: string;
  start_date: string;
  duration_type?: string | null;
  is_all_day?: boolean | null;
}

export type SmartShelfKind = 'day' | 'phase' | 'untimed';

export interface SmartShelf<T> {
  key: string;
  kind: SmartShelfKind;
  title: string;
  sub?: string;
  events: T[];
}

export type Phase = 'vormittag' | 'nachmittag' | 'abend' | 'nacht';

const PHASE_ORDER: Phase[] = ['vormittag', 'nachmittag', 'abend', 'nacht'];
const PHASE_LABEL: Record<Phase, { title: string; sub: string }> = {
  vormittag: { title: 'Vormittag', sub: 'bis 12 Uhr' },
  nachmittag: { title: 'Nachmittag', sub: '12 bis 17 Uhr' },
  abend: { title: 'Abend', sub: '17 bis 21 Uhr' },
  nacht: { title: 'Nacht', sub: 'ab 21 Uhr' },
};

const MAX_DAY_SHELVES = 7;

export function phaseOf(hour: number): Phase {
  if (hour < 12) return 'vormittag';
  if (hour < 17) return 'nachmittag';
  if (hour < 21) return 'abend';
  return 'nacht';
}

function dayLabel(day: string, today: string): string {
  if (day === today) return 'Heute';
  if (day === addViennaDays(today, 1)) return 'Morgen';
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('de-AT', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

function dayLong(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('de-AT', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

export function planSmartShelves<T extends ShelfEvent>(events: T[], now: Date = new Date()): SmartShelf<T>[] {
  if (events.length === 0) return [];
  const today = viennaToday(now);
  const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));

  const byDay = new Map<string, T[]>();
  for (const e of sorted) {
    const d = new Date(e.start_date);
    if (Number.isNaN(d.getTime())) continue;
    const day = toViennaDate(d);
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }

  if (byDay.size > 1) {
    const days = [...byDay.keys()].sort();
    const shown = days.slice(0, MAX_DAY_SHELVES);
    const shelves: SmartShelf<T>[] = shown.map(day => ({
      key: `day:${day}`,
      kind: 'day',
      title: dayLabel(day, today),
      sub: dayLong(day),
      events: byDay.get(day)!,
    }));
    const rest = days.slice(MAX_DAY_SHELVES).flatMap(d => byDay.get(d)!);
    if (rest.length > 0) {
      shelves.push({ key: 'day:rest', kind: 'day', title: 'Später', sub: `ab ${dayLabel(days[MAX_DAY_SHELVES], today)}`, events: rest });
    }
    return shelves;
  }

  const byPhase = new Map<Phase, T[]>();
  const untimed: T[] = [];
  for (const e of sorted) {
    if (!hasKnownStartTime({ start_date: e.start_date, duration_type: e.duration_type ?? null, is_all_day: e.is_all_day ?? null })) {
      untimed.push(e);
      continue;
    }
    const phase = phaseOf(viennaFields(new Date(e.start_date)).hour);
    const list = byPhase.get(phase);
    if (list) list.push(e);
    else byPhase.set(phase, [e]);
  }
  const shelves: SmartShelf<T>[] = PHASE_ORDER
    .filter(p => byPhase.has(p))
    .map(p => ({ key: `phase:${p}`, kind: 'phase', title: PHASE_LABEL[p].title, sub: PHASE_LABEL[p].sub, events: byPhase.get(p)! }));
  if (untimed.length > 0) {
    shelves.push({ key: 'untimed', kind: 'untimed', title: 'Ohne feste Uhrzeit', sub: 'ganztägig oder Zeit unbekannt', events: untimed });
  }
  return shelves;
}


import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import type { AppLandingContext, AppTranslate } from '@/lib/app-api/landing';
import {
  defaultPlanState,
  toAppPlanDetail,
  toAppPlanDraft,
  toAppPlanList,
} from '@/lib/app-api/plans';
import type { Event } from '@/types/events';
import type { Plan, PlanWithEvents } from '@/types/plans';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppLandingContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
  mapboxToken: null,
};

const NOW = new Date('2026-11-05T10:00:00Z'); // Donnerstag

function event(over: Partial<Event> = {}): Event {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    slug: 'konzert-im-orpheum',
    title: 'Konzert im Orpheum',
    start_date: '2026-11-07T19:00:00+00:00', // Samstag, 20:00 Wien
    end_date: null,
    location_name: 'Orpheum, Graz',
    address: 'Orpheumgasse 8',
    postal_code: '8020',
    district: null,
    bundesland: 'steiermark',
    country: 'AT',
    category: 'Musik',
    image_url: 'https://img.example/a.jpg',
    price_text: null,
    price_min: 29,
    price_max: null,
    ticket_url: 'https://www.oeticket.com/event/1',
    source_name: 'oeticket',
    ...over,
  } as Event;
}

function plan(over: Partial<Plan> = {}): Plan {
  return {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    user_id: 'cccccccc-0000-4000-8000-000000000001',
    name: 'Abend in Graz',
    plan_date: '2026-11-07',
    note: null,
    visibility: 'private',
    tickets_status: 'open',
    arrival_status: 'open',
    arrival_mode: null,
    arrival_from: null,
    accommodation_status: 'open',
    accommodation_city: null,
    reminder_7d: true,
    reminder_1d: true,
    reminder_3h: false,
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    ...over,
  };
}

function withEvents(p: Plan, events: Event[]): PlanWithEvents {
  return { ...p, events, event_count: events.length };
}

describe('toAppPlanList', () => {
  it('trennt anstehend und vergangen am Wiener Tag, nächster Termin zuerst', () => {
    const list = toAppPlanList(
      [
        plan({ id: 'p-spaeter', plan_date: '2026-12-01' }),
        plan({ id: 'p-heute', plan_date: '2026-11-05' }),
        plan({ id: 'p-alt', plan_date: '2026-10-01' }),
        plan({ id: 'p-gestern', plan_date: '2026-11-04' }),
      ],
      {},
      NOW,
    );
    expect(list.upcoming.map(p => p.id)).toEqual(['p-heute', 'p-spaeter']);
    expect(list.past.map(p => p.id)).toEqual(['p-gestern', 'p-alt']);
  });

  it('zählt die Kennzahlen nur über anstehende Pläne', () => {
    const list = toAppPlanList(
      [
        plan({ id: 'a', tickets_status: 'open', arrival_mode: 'oeffis' }),
        plan({ id: 'b', tickets_status: 'done', reminder_7d: false, reminder_1d: false }),
        plan({ id: 'alt', plan_date: '2026-10-01' }),
      ],
      {},
      NOW,
    );
    expect(list.stats.map(s => [s.label, s.value])).toEqual([
      ['Anstehende Pläne', 2],
      ['Tickets offen', 1],
      ['Anreise offen', 1],
      ['Reminder aktiv', 1],
    ]);
    expect(list.stats[3].sub).toBe('von 2 Plänen');
  });

  it('liefert ohne Pläne keine Kennzahlen', () => {
    expect(toAppPlanList([], {}, NOW)).toMatchObject({ stats: [], upcoming: [], past: [] });
  });

  it('baut Datumsbox, Event-Zeile und Status-Zeilen der Karte', () => {
    const [card] = toAppPlanList(
      [plan({ arrival_mode: 'fuss', accommodation_city: 'Graz' })],
      { 'bbbbbbbb-0000-4000-8000-000000000001': { count: 2, firstTitle: 'Rock &amp; Roll' } },
      NOW,
    ).upcoming;
    expect(card.dateBox).toEqual({ dow: 'Sa', day: '7', mon: 'Nov' });
    expect(card.eventsLabel).toBe('2 Events · Rock & Roll');
    expect(card.badges).toEqual([
      { kind: 'open', label: 'Tickets: offen' },
      { kind: 'plan', label: 'Anreise: zu Fuß' },
      { kind: 'open', label: 'Hotel: offen' },
      { kind: 'done', label: '2 Reminder' },
    ]);
  });

  it('gibt jeder Karte die Zeitpunkte ihrer aktiven Erinnerungen mit', () => {
    const id = 'bbbbbbbb-0000-4000-8000-000000000001';
    const [withEvent] = toAppPlanList([plan()], { [id]: { count: 1, firstTitle: 'A', firstStart: '2026-11-07T19:00:00+00:00' } }, NOW).upcoming;
    expect(withEvent.reminders.map(r => [r.key, r.at])).toEqual([
      ['7d', '2026-10-31T19:00:00.000Z'],
      ['1d', '2026-11-06T19:00:00.000Z'],
    ]);
    // Ohne Event: 19 Uhr Wiener Zeit am Plantag.
    const [noEvent] = toAppPlanList([plan({ reminder_7d: false, reminder_1d: false, reminder_3h: true })], {}, NOW).upcoming;
    expect(noEvent.reminders).toEqual([{ key: '3h', at: '2026-11-07T15:00:00.000Z', label: 'Aufbrechen und Route öffnen' }]);
  });

  it('nennt ein einzelnes Event in der Einzahl und lässt das Hotel ohne Stadt weg', () => {
    const [card] = toAppPlanList(
      [plan({ reminder_7d: false, reminder_1d: false })],
      { 'bbbbbbbb-0000-4000-8000-000000000001': { count: 1, firstTitle: null } },
      NOW,
    ).upcoming;
    expect(card.eventsLabel).toBe('1 Event');
    expect(card.badges.map(b => b.label)).toEqual(['Tickets: offen', 'Anreise: offen', 'Keine Reminder']);
  });
});

describe('defaultPlanState und toAppPlanDraft', () => {
  it('belegt Name, Tag, Stadt und Erinnerungen wie der Assistent der Website vor', () => {
    const state = defaultPlanState(event(), NOW);
    expect(state).toMatchObject({
      name: 'Abend in Graz',
      plan_date: '2026-11-07',
      event_ids: ['aaaaaaaa-0000-4000-8000-000000000001'],
      accommodation_city: 'Graz',
      tickets_status: 'open',
      reminder_7d: true,
      reminder_1d: true,
      reminder_3h: true,
    });
  });

  it('nimmt den Post-Ort der PLZ vor dem Namen des Saals', () => {
    const state = defaultPlanState(event({ location_name: 'Veranstaltungszentrum Ottendorf' }), NOW, 'Ottendorf an der Rittschein');
    expect(state.name).toBe('Abend in Ottendorf an der Rittschein');
    expect(state.accommodation_city).toBe('Ottendorf an der Rittschein');
  });

  it('nennt den Plan nach dem Event, wenn kein Ort bekannt ist', () => {
    const state = defaultPlanState(event({ location_name: null, bundesland: null }), NOW);
    expect(state.name).toBe('Plan rund um Konzert im Orpheum');
    expect(state.accommodation_city).toBeNull();
  });

  it('liefert Ticketlink mit Anbieter und Preis, Ziel und ÖBB-Link ohne Startort', () => {
    const ev = event();
    const draft = toAppPlanDraft(ev, defaultPlanState(ev, NOW), ctx);
    expect(draft.dateLabel).toBe('Samstag, 7. November 2026');
    expect(draft.ticket).toEqual({ url: 'https://www.oeticket.com/event/1', provider: 'oeticket', priceLabel: 'ab 29 €' });
    expect(draft.destination).toBe('Orpheum, Graz');
    expect(draft.event?.id).toBe(ev.id);
    const oebb = new URL(draft.oebbUrl!);
    expect(oebb.origin).toBe('https://fahrplan.oebb.at');
    expect(oebb.searchParams.get('S')).toBeNull();
    expect(oebb.searchParams.get('date')).toBe('07.11.2026');
    expect(oebb.searchParams.get('time')).toBe('20:00');
  });

  it('kommt ohne Ticketlink und ohne Event aus', () => {
    const ev = event({ ticket_url: null });
    expect(toAppPlanDraft(ev, defaultPlanState(ev, NOW), ctx).ticket).toBeNull();
    const empty = toAppPlanDraft(null, { ...defaultPlanState(ev, NOW), event_ids: [] }, ctx);
    expect(empty).toMatchObject({ event: null, ticket: null, destination: '', oebbUrl: null });
  });
});

describe('toAppPlanDetail', () => {
  it('rechnet Status, Countdown-Ziel und Erinnerungen aus dem ersten Event', () => {
    const detail = toAppPlanDetail(withEvents(plan(), [event()]), ctx, NOW);
    expect(detail.statusLabel).toBe('In 2 Tagen');
    expect(detail.isPast).toBe(false);
    expect(detail.ticketsOpen).toBe(true);
    expect(detail.target).toBe('2026-11-07T19:00:00.000Z');
    expect(detail.reminders).toEqual([
      { key: '7d', at: '2026-10-31T19:00:00.000Z', label: 'Wetter und Anfahrt prüfen' },
      { key: '1d', at: '2026-11-06T19:00:00.000Z', label: 'Letzter Check: alles da?' },
    ]);
    expect(detail.events).toHaveLength(1);
    expect(detail.draft.state.event_ids).toEqual(['aaaaaaaa-0000-4000-8000-000000000001']);
  });

  it('zielt ohne Event auf 19 Uhr Wiener Zeit am Plantag', () => {
    const detail = toAppPlanDetail(withEvents(plan(), []), ctx, NOW);
    expect(detail.target).toBe('2026-11-07T18:00:00.000Z'); // Winterzeit: 19:00 Wien
    expect(detail.image).toBeNull();
    expect(detail.ticketsOpen).toBe(false);
  });

  it('nennt heute und vergangen', () => {
    expect(toAppPlanDetail(withEvents(plan({ plan_date: '2026-11-05' }), []), ctx, NOW).statusLabel).toBe('Heute');
    const past = toAppPlanDetail(withEvents(plan({ plan_date: '2026-11-04' }), []), ctx, NOW);
    expect(past).toMatchObject({ statusLabel: 'Vergangen', isPast: true });
    expect(toAppPlanDetail(withEvents(plan({ plan_date: '2026-11-06' }), []), ctx, NOW).statusLabel).toBe('In 1 Tag');
  });

  it('baut das Ticket-Modul je Status', () => {
    const open = toAppPlanDetail(withEvents(plan(), [event()]), ctx, NOW).modules[0];
    expect(open).toMatchObject({
      key: 'ticket',
      primary: 'Tickets offen',
      sub: 'ab 29 €',
      accent: 'ticket',
      action: { label: 'Jetzt sichern · ab 29 €', url: 'https://www.oeticket.com/event/1', primary: true },
    });
    const done = toAppPlanDetail(withEvents(plan({ tickets_status: 'done' }), [event()]), ctx, NOW).modules[0];
    expect(done).toMatchObject({ primary: 'Schon gekauft', badge: 'Erledigt', action: null });
    const skip = toAppPlanDetail(withEvents(plan({ tickets_status: 'skip' }), [event()]), ctx, NOW).modules[0];
    expect(skip).toMatchObject({ primary: 'Kein Ticket nötig', dim: true });
  });

  it('öffnet die ÖBB-Route nur bei Öffis und trägt den Startort ein', () => {
    const oeffis = toAppPlanDetail(
      withEvents(plan({ arrival_mode: 'oeffis', arrival_from: 'Wien Hbf' }), [event()]),
      ctx,
      NOW,
    ).modules[1];
    expect(oeffis).toMatchObject({ primary: 'Öffis · ÖBB', sub: 'Von Wien Hbf' });
    expect(new URL(oeffis.action!.url).searchParams.get('S')).toBe('Wien Hbf');
    const auto = toAppPlanDetail(withEvents(plan({ arrival_mode: 'auto' }), [event()]), ctx, NOW).modules[1];
    expect(auto).toMatchObject({ primary: 'Auto', sub: 'Startpunkt nicht gesetzt', action: null });
    const none = toAppPlanDetail(withEvents(plan(), [event()]), ctx, NOW).modules[1];
    expect(none).toMatchObject({ primary: 'Noch nicht festgelegt', dim: true });
  });

  it('verlinkt die Hotelsuche nur mit Stadt und nur solange sie offen ist', () => {
    const open = toAppPlanDetail(withEvents(plan({ accommodation_city: 'Graz' }), [event()]), ctx, NOW).modules[2];
    expect(open.primary).toBe('Hotels in Graz');
    expect(decodeURIComponent(open.action!.url)).toContain('ss=Graz');
    expect(decodeURIComponent(open.action!.url)).toContain('checkin=2026-11-07');
    const noCity = toAppPlanDetail(withEvents(plan(), [event()]), ctx, NOW).modules[2];
    expect(noCity).toMatchObject({ primary: 'Stadt nicht gesetzt', dim: true, action: null });
    const done = toAppPlanDetail(
      withEvents(plan({ accommodation_status: 'done', accommodation_city: 'Graz' }), [event()]),
      ctx,
      NOW,
    ).modules[2];
    expect(done).toMatchObject({ primary: 'Schon gebucht', sub: 'Graz', action: null });
  });

  it('fasst die Erinnerungen zusammen', () => {
    const some = toAppPlanDetail(withEvents(plan(), []), ctx, NOW).modules[3];
    expect(some).toMatchObject({ primary: '2 aktiv', sub: '7 T · 1 T vorher', accent: 'match' });
    const none = toAppPlanDetail(
      withEvents(plan({ reminder_7d: false, reminder_1d: false, reminder_3h: false }), []),
      ctx,
      NOW,
    ).modules[3];
    expect(none).toMatchObject({ primary: 'Keine Erinnerung', dim: true });
  });

  it('enthält keine Gedankenstriche in sichtbaren Texten', () => {
    const detail = toAppPlanDetail(
      withEvents(plan({ arrival_mode: 'oeffis', accommodation_city: 'Graz', note: 'Notiz' }), [event()]),
      ctx,
      NOW,
    );
    const texts = detail.modules.flatMap(m => [m.label, m.primary, m.sub, m.badge ?? '', m.action?.label ?? '']);
    expect(texts.join(' ')).not.toMatch(/[–—]/);
  });
});

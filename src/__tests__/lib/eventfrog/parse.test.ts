import { describe, it, expect } from 'vitest';
import {
  parseEventfrogEvents, normalizeTimes, standingOfferKeys, unusableImageUrls, htmlToText, pickText,
} from '@/lib/eventfrog/parse';
import { RubricIndex } from '@/lib/eventfrog/rubric-map';
import type { EventfrogEvent, EventfrogLocation, EventfrogRubric } from '@/lib/eventfrog/types';

const RUBRICS: EventfrogRubric[] = [
  { id: 908, parentId: 0, title: { de: 'Konzerte' } },
  { id: 75, parentId: 908, title: { de: 'Jazz & Blues' } },
  { id: 902, parentId: 0, title: { de: 'Freizeit & Ausflüge' } },
  { id: 16, parentId: 902, title: { de: 'Wanderung' } },
  { id: 907, parentId: 0, title: { de: 'Klassik & Opern' } },
  { id: 61, parentId: 907, title: { de: 'Oper & Operette' } },
];
const rubrics = new RubricIndex(RUBRICS);

const LOC: EventfrogLocation = {
  id: 'L1', title: { de: 'Porgy & Bess' }, url: 'https://eventfrog.at/l/1', addressLine: 'Riemergasse 11',
  country: 'AT', zip: '1010', city: 'Wien', lat: 48.2068, lng: 16.3753, modifyDate: '2026-10-01T00:00:00Z',
};
const CITY_ONLY: EventfrogLocation = {
  id: 'L2', title: { de: 'Wien' }, url: 'https://eventfrog.at/l/2',
  country: 'AT', zip: '1010', city: 'Wien', lat: 48.2081743, lng: 16.3738189, modifyDate: '2026-10-01T00:00:00Z',
};
const locations = new Map([LOC, CITY_ONLY].map((l) => [l.id, l]));

const ev = (over: Partial<EventfrogEvent> = {}): EventfrogEvent => ({
  id: '1', rubricId: 75, title: { de: 'Jazz Night', en: null }, url: 'https://eventfrog.at/de/p/1.html',
  organizerId: 'O1', organizerName: 'Porgy', begin: '2026-11-03T20:00:00+01:00', end: '2026-11-03T23:00:00+01:00',
  cancelled: false, visible: true, published: true, agendaEntryOnly: false, soldOut: false,
  lowestTicketPrice: 25, presaleLink: 'https://eventfrog.at/de/p/1.html', locationIds: ['L1'],
  modifyDate: '2026-10-20T10:00:00Z', shortDescription: { de: 'Kurz' },
  descriptionAsHTML: { de: '<p>Erster&nbsp;Absatz</p><p>Zweiter<br>Teil</p>' },
  emblemToShow: { url: 'https://res.eventfrog.net/jazz-ABC.webp?_=1', width: 800, height: 600 },
  ...over,
});

/** `n` tägliche Termine ab einem Datum, wie die Rätsel-Touren im AT-Bestand. */
const daily = (n: number, over: Partial<EventfrogEvent> = {}): EventfrogEvent[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
    return ev({ id: `D${i}`, title: { de: 'Schatzsuche Wien' }, organizerId: 'Q', begin: `${d}T00:00:00+01:00`, end: `${d}T23:59:00+01:00`, ...over });
  });

describe('parseEventfrogEvents', () => {
  it('bildet ein Konzert vollständig ab', () => {
    const { events, stats } = parseEventfrogEvents([ev()], locations, rubrics, 'AT');
    expect(stats.output).toBe(1);
    expect(events[0]).toMatchObject({
      source_name: 'Eventfrog', source_id: '1', title: 'Jazz Night',
      start_date: '2026-11-03T20:00:00+01:00', end_date: '2026-11-03T23:00:00+01:00',
      location_name: 'Porgy & Bess', address: 'Riemergasse 11', postal_code: '1010', city: 'Wien',
      source_venue_id: 'eventfrog:L1', coords_precision: 'venue', country: 'AT',
      category: 'Musik', category_locked: true, price_min: 25, price_text: 'ab 25,00 €',
      ticket_url: 'https://eventfrog.at/de/p/1.html', organizer: 'Porgy',
      description: 'Erster Absatz\nZweiter\nTeil',
    });
    expect(events[0].tags).toEqual(expect.arrayContaining(['jazz']));
  });

  it('verwirft abgesagte, versteckte und titellose Events', () => {
    const { stats } = parseEventfrogEvents([
      ev({ id: 'c', cancelled: true }), ev({ id: 'h', visible: false }), ev({ id: 't', title: { de: null, en: '  ' } }),
    ], locations, rubrics, 'AT');
    expect(stats).toMatchObject({ cancelled: 1, hidden: 1, noTitle: 1, output: 0 });
  });

  it('nimmt den englischen Titel, wenn der deutsche fehlt', () => {
    expect(pickText({ de: null, en: 'Open Session', fr: 'Session' })).toBe('Open Session');
  });

  it('verwirft tägliche Dauerangebote, behält eine Wochenreihe', () => {
    const weekly = Array.from({ length: 35 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 1 + i * 7)).toISOString().slice(0, 10);
      return ev({ id: `W${i}`, title: { de: 'Improv Open Session' }, organizerId: 'I', begin: `${d}T19:00:00+01:00`, end: null });
    });
    const { events, stats } = parseEventfrogEvents([...daily(40), ...weekly, ev()], locations, rubrics, 'AT');
    expect(stats.standingOffer).toBe(40);
    expect(stats.standingOfferTitles).toEqual({ 'Schatzsuche Wien': 40 });
    expect(events.filter((e) => e.title === 'Improv Open Session')).toHaveLength(35);
  });

  it('bleibt unter der Schwelle von 30 Tagen bei kurzen Serien', () => {
    expect(standingOfferKeys(daily(29)).size).toBe(0);
    expect(standingOfferKeys(daily(30)).size).toBe(1);
  });

  it('gibt Tickets nur, wenn Eventfrog verkauft und nicht ausverkauft ist', () => {
    const { events } = parseEventfrogEvents([
      ev({ id: 'agenda', agendaEntryOnly: true, presaleLink: 'https://praxis.example.at/aktuelles/' }),
      ev({ id: 'sold', soldOut: true }),
      ev({ id: 'noLink', presaleLink: undefined }),
    ], locations, rubrics, 'AT');
    const byId = Object.fromEntries(events.map((e) => [e.source_id, e]));
    expect(byId.agenda.ticket_url).toBeUndefined();
    expect(byId.sold.ticket_url).toBeUndefined();
    expect(byId.noLink.ticket_url).toBe('https://eventfrog.at/de/p/1.html');
  });

  it('setzt keinen Preis bei 0 und keinen in Franken', () => {
    const chLoc: EventfrogLocation = { ...LOC, id: 'CH', country: 'CH', zip: '8000', city: 'Zürich', lat: 47.37, lng: 8.54 };
    const { events } = parseEventfrogEvents([
      ev({ id: 'free', lowestTicketPrice: 0 }), ev({ id: 'ch', locationIds: ['CH'] }),
    ], new Map([...locations, ['CH', chLoc]]), rubrics, 'AT');
    for (const e of events) expect(e.price_min).toBeUndefined();
    expect(events.find((e) => e.source_id === 'ch')?.country).toBe('CH');
  });

  it('stuft eine Location, die nur den Ort nennt, auf Gemeinde-Ebene', () => {
    const { events } = parseEventfrogEvents([ev({ locationIds: ['L2'] })], locations, rubrics, 'AT');
    expect(events[0].coords_precision).toBe('municipality');
  });

  it('übergibt mehrdeutige Rubriken als Rohtext an den Classifier', () => {
    const { events } = parseEventfrogEvents([ev({ rubricId: 16 })], locations, rubrics, 'AT');
    expect(events[0].category).toBe('Freizeit & Ausflüge: Wanderung');
    expect(events[0].category_locked).toBeUndefined();
  });

  it('ordnet Oper der Bühne zu, nicht der Musik', () => {
    expect(rubrics.map(61)).toMatchObject({ category: 'Kultur & Bühne', locked: true });
  });

  it('verwirft Events ohne bekannte Location', () => {
    const { stats } = parseEventfrogEvents([ev({ locationIds: ['UNKNOWN'] })], locations, rubrics, 'AT');
    expect(stats.noLocation).toBe(1);
  });
});

describe('normalizeTimes', () => {
  it('macht aus 00:01 die Platzhalter-Mitternacht und lässt das Ende 23:59 fallen', () => {
    expect(normalizeTimes('2026-10-27T00:01:00+01:00', '2026-10-27T23:59:00+01:00'))
      .toEqual({ start: '2026-10-27T00:00:00+01:00' });
  });
  it('behält das Ende mehrtägiger Ausstellungen', () => {
    expect(normalizeTimes('2026-10-06T00:00:00+02:00', '2026-11-30T23:59:00+01:00'))
      .toEqual({ start: '2026-10-06T00:00:00+02:00', end: '2026-11-30T23:59:00+01:00' });
  });
  it('verwirft ein Ende vor dem Beginn', () => {
    expect(normalizeTimes('2026-10-27T20:00:00+01:00', '2026-10-27T19:00:00+01:00'))
      .toEqual({ start: '2026-10-27T20:00:00+01:00' });
  });
});

describe('unusableImageUrls', () => {
  it('erkennt KI-Stockbilder und von drei Veranstaltern geteilte Rubrikbilder', () => {
    const shared = { url: 'https://res.eventfrog.net/production_res_public/essentrinken-X.webp?_=2' };
    const bad = unusableImageUrls([
      ev({ id: 'a', organizerId: 'A', emblemToShow: shared }),
      ev({ id: 'b', organizerId: 'B', emblemToShow: shared }),
      ev({ id: 'c', organizerId: 'C', emblemToShow: shared }),
      ev({ id: 'd', emblemToShow: { url: 'https://res.eventfrog.net/x-ai-generated-1.webp' } }),
      ev({ id: 'e' }),
    ]);
    expect(bad).toEqual(new Set([
      'https://res.eventfrog.net/production_res_public/essentrinken-X.webp',
      'https://res.eventfrog.net/x-ai-generated-1.webp',
    ]));
  });
});

describe('htmlToText', () => {
  it('behält Absätze und dekodiert Entities', () => {
    expect(htmlToText('<p>A &amp; B</p>\n <br>\n <p>C</p>')).toBe('A & B\n\nC');
  });
});

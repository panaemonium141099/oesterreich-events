import { describe, it, expect } from 'vitest';
import type { Event } from '@/types/events';
import type { FestivalPost } from '@/content/blog/types';
import {
  festivalActs,
  pickActivities,
  pickArtistsLive,
  pickDorffeste,
  pickLandingSelection,
  pickPosts,
  pickProgram,
  pickTip,
  readCountryTotal,
  weekendWindow,
  type ArtistEventRow,
  type LandingPin,
} from '@/lib/v4/landing-picks';

// Donnerstag, 5. November 2026, 11:00 Wien (CET = UTC+1).
const NOW = new Date('2026-11-05T10:00:00Z');
const TODAY = '2026-11-05';

const ev = (id: string, over: Partial<Event> = {}): Event => ({
  id,
  title: `Event ${id}`,
  start_date: '2026-11-06T18:00:00Z',
  end_date: null,
  publish_status: 'published',
  country: 'AT',
  event_score: 50,
  image_width: 1200,
  image_url: `https://img/${id}.jpg`,
  ...over,
} as unknown as Event);

const pin = (event: Event, over: Partial<LandingPin> = {}): LandingPin => ({
  event,
  kind: 'sponsored',
  sponsorName: 'Sponsor GmbH',
  startsAt: '2026-11-04T23:00:00Z', // 00:00 Wien am 5.11.
  endsAt: '2026-11-05T23:00:00Z',   // 24:00 Wien am 5.11.
  createdAt: '2026-11-01T10:00:00Z',
  ...over,
});

describe('pickTip', () => {
  const pool = [ev('b', { image_width: 1200, event_score: 80 }), ev('a', { image_width: 222, event_score: 90 })];

  it('ohne Buchung: bestgescortes Event mit scharfem Bild, ohne Label', () => {
    expect(pickTip([], pool, TODAY)).toEqual({ event: pool[0], kind: 'auto', sponsorName: null });
    expect(pickTip([], [], TODAY)).toBeNull();
  });

  it('sponsored-Buchung des Wiener Tags gewinnt und trägt den Sponsor', () => {
    const tip = pickTip([pin(ev('s', { start_date: '2026-11-05T19:00:00Z' }))], pool, TODAY);
    expect(tip).toMatchObject({ kind: 'sponsored', sponsorName: 'Sponsor GmbH' });
    expect(tip?.event.id).toBe('s');
  });

  it('eine Buchung außerhalb des Tages, ein editorial-Pin oder ein hinfälliges Event greifen nicht', () => {
    const s = ev('s', { start_date: '2026-11-05T19:00:00Z' });
    const cases: LandingPin[] = [
      pin(s, { endsAt: '2026-11-04T23:00:00Z' }),                       // gestern geendet
      pin(s, { startsAt: '2026-11-05T23:00:00Z', endsAt: null }),       // beginnt morgen
      pin(s, { kind: 'editorial' }),                                    // speist die Saison
      pin(ev('s', { start_date: '2026-11-05T19:00:00Z', publish_status: 'suppressed' })),
      pin(ev('s', { start_date: '2026-11-05T19:00:00Z', country: 'DE' })),
      pin(ev('s', { start_date: '2026-11-01T19:00:00Z', end_date: '2026-11-04T20:00:00Z' })), // vorbei
    ];
    for (const p of cases) {
      expect(pickTip([p], pool, TODAY)?.kind, JSON.stringify(p)).toBe('auto');
    }
  });

  it('ein mehrtägiges gepinntes Event bleibt bis zu seinem Ende buchbar', () => {
    const laeuft = ev('l', { start_date: '2026-11-01T19:00:00Z', end_date: '2026-11-05T20:00:00Z' });
    expect(pickTip([pin(laeuft)], pool, TODAY)?.event.id).toBe('l');
  });
});

describe('weekendWindow (Wiener Tage)', () => {
  it('Mo bis Do zeigen das kommende Wochenende Fr bis So', () => {
    expect(weekendWindow('2026-11-02')).toEqual({ from: '2026-11-06', to: '2026-11-08' }); // Mo
    expect(weekendWindow('2026-11-05')).toEqual({ from: '2026-11-06', to: '2026-11-08' }); // Do
  });

  it('Fr bis So zeigen das laufende Wochenende ab heute', () => {
    expect(weekendWindow('2026-11-06')).toEqual({ from: '2026-11-06', to: '2026-11-08' }); // Fr
    expect(weekendWindow('2026-11-07')).toEqual({ from: '2026-11-07', to: '2026-11-08' }); // Sa
    expect(weekendWindow('2026-11-08')).toEqual({ from: '2026-11-08', to: '2026-11-08' }); // So
  });
});

describe('pickProgram', () => {
  it('nur heutige Events mit bekannter Startzeit ab 17:00 Wien, nach Uhrzeit', () => {
    const pool = [
      ev('spaet', { start_date: '2026-11-05T22:30:00Z', event_score: 90 }),   // 23:30 Wien
      ev('frueh', { start_date: '2026-11-05T15:30:00Z', event_score: 95 }),   // 16:30 Wien: zu früh
      ev('abend', { start_date: '2026-11-05T18:00:00Z', event_score: 10 }),   // 19:00 Wien
      ev('platzhalter', { start_date: '2026-11-05T00:00:00Z' }),             // Form A, keine Uhrzeit
      ev('ganztag', { start_date: '2026-11-05T19:00:00Z', is_all_day: true }),
      ev('morgen', { start_date: '2026-11-05T23:30:00Z' }),                  // 00:30 Wien am 6.11.
      ev('punkt17', { start_date: '2026-11-05T16:00:00Z' }),                 // 17:00 Wien
    ];
    expect(pickProgram(pool, TODAY, new Set()).map(e => e.id)).toEqual(['punkt17', 'abend', 'spaet']);
  });

  it('lässt die Bühne aus und schneidet auf count', () => {
    const pool = Array.from({ length: 12 }, (_, i) => ev(`p${i}`, { start_date: `2026-11-05T${17 + (i % 5)}:0${i % 10}:00Z` }));
    const out = pickProgram(pool, TODAY, new Set(['p0']), 10);
    expect(out).toHaveLength(10);
    expect(out.map(e => e.id)).not.toContain('p0');
  });
});

describe('pickLandingSelection: Tipp → Saison → Programm → Wochenende ohne Dubletten', () => {
  it('jedes Event erscheint höchstens einmal, der Tipp wählt zuerst', () => {
    const T = ev('T', { event_score: 99 });
    const E = ev('E', { start_date: '2026-11-10T18:00:00Z' });
    const S1 = ev('S1', { start_date: '2026-11-05T18:00:00Z' }); // heute 19:00: wäre auch Programm
    const S2 = ev('S2');
    const P1 = ev('P1', { start_date: '2026-11-05T19:00:00Z' });
    const P2 = ev('P2', { start_date: '2026-11-05T20:00:00Z' });
    const W1 = ev('W1', { start_date: '2026-11-07T18:00:00Z' });
    const W2 = ev('W2', { start_date: '2026-11-07T19:00:00Z' });

    const sel = pickLandingSelection({
      pins: [pin(E, { kind: 'editorial', startsAt: '2026-11-01T00:00:00Z', endsAt: null })],
      tipPool: [T, S1],
      seasonPool: [T, E, S1, S2],
      programPool: [T, S1, P1, P2],
      weekendPool: [T, S1, P1, W1, W2],
      today: TODAY,
      now: NOW,
    });

    expect(sel.tip?.event.id).toBe('T');
    expect(sel.season.map(e => e.id)).not.toContain('T');
    expect(sel.season.find(e => e.id === 'E')?.featured).toBe(true);
    expect(sel.season.map(e => e.id).sort()).toEqual(['E', 'S1', 'S2']);
    expect(sel.program.map(e => e.id)).toEqual(['P1', 'P2']);
    expect(sel.weekend.map(e => e.id)).toEqual(['W1', 'W2']);
    expect(sel.dorffeste).toEqual([]);

    const all = [sel.tip!.event, ...sel.season, ...sel.program, ...sel.weekend].map(e => e.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('Dorffeste kommen nach dem Wochenende und wiederholen kein Event', () => {
    const W1 = ev('W1', { title: 'Kirtag Palfau', start_date: '2026-11-07T18:00:00Z' });
    const D1 = ev('D1', { title: 'Dorffest Spannberg', start_date: '2026-11-21T14:00:00Z' });
    const sel = pickLandingSelection({
      pins: [], tipPool: [], seasonPool: [], programPool: [],
      weekendPool: [W1],
      dorffestePool: [W1, D1],
      today: TODAY,
      now: NOW,
    });
    expect(sel.weekend.map(e => e.id)).toEqual(['W1']);
    expect(sel.dorffeste.map(e => e.id)).toEqual(['D1']);
  });
});

describe('pickDorffeste', () => {
  it('nur Fest-Titel, ohne Dubletten, die besten nach Pool-Reihenfolge, Ausgabe in Terminfolge', () => {
    const pool = [
      ev('spaet', { title: 'Weinfest Gols', start_date: '2026-11-28T16:00:00Z', event_score: 60 }),
      ev('streu', { title: 'Sparefroh Weltspartag', event_score: 59 }),
      ev('frueh', { title: 'Palfauer Kirtag', start_date: '2026-11-08T10:00:00Z', event_score: 55 }),
      ev('dublette', { title: 'Weinfest Gols', start_date: '2026-11-29T16:00:00Z', image_url: 'https://img/spaet.jpg', event_score: 50 }),
      ev('mitte', { title: 'Zeltfest Leonding', start_date: '2026-11-14T19:00:00Z', event_score: 40 }),
      ev('rest', { title: 'Oktoberfest Linz', start_date: '2026-11-20T19:00:00Z', event_score: 30 }),
    ];
    expect(pickDorffeste(pool, new Set(), 3).map(e => e.id)).toEqual(['frueh', 'mitte', 'spaet']);
    expect(pickDorffeste(pool, new Set(['frueh']), 3).map(e => e.id)).toEqual(['mitte', 'rest', 'spaet']);
    expect(pickDorffeste([], new Set())).toEqual([]);
  });

  it('ein editorial-Pin, der schon Tipp ist, wiederholt sich nicht in der Saison', () => {
    const T = ev('T');
    const sel = pickLandingSelection({
      pins: [pin(T, { kind: 'editorial', startsAt: '2026-11-01T00:00:00Z', endsAt: null })],
      tipPool: [T], seasonPool: [T], programPool: [], weekendPool: [],
      today: TODAY, now: NOW,
    });
    expect(sel.tip?.event.id).toBe('T');
    expect(sel.season).toEqual([]);
  });
});

describe('pickArtistsLive', () => {
  const row = (event: Event, artists: Array<[string, string | null]>): ArtistEventRow => ({
    event,
    artists: artists.map(([id, img]) => ({ artist_id: id, artist_name: `Act ${id}`, artist_image: img, evo_link: null })),
  });
  const rows: ArtistEventRow[] = [
    row(ev('e1', { start_date: '2026-11-06T19:00:00Z' }), [['A', 'a.jpg'], ['B', null]]),
    row(ev('e2', { start_date: '2026-11-05T19:00:00Z' }), [['A', 'a.jpg']]),
    row(ev('e3', { start_date: '2026-11-07T19:00:00Z', publish_status: 'duplicate', duplicate_of: 'p3' }), [['C', 'c.jpg']]),
    row(ev('e4', { start_date: '2026-11-07T19:00:00Z', publish_status: 'duplicate', duplicate_of: 'p4' }), [['D', 'd.jpg']]),
    row(ev('e5'), [['E', null], ['F', null]]),
  ];
  const primaries = new Map([['p3', ev('p3', { start_date: '2026-11-07T19:00:00Z' })]]);

  it('je Künstler ein Termin (der nächste), Bilder zuerst, drei Zeilen', () => {
    const out = pickArtistsLive(rows, primaries, NOW);
    expect(out).toHaveLength(3);
    expect(out.slice(0, 2).map(a => a.artistId).sort()).toEqual(['A', 'C']);
    expect(out.find(a => a.artistId === 'A')?.event.id).toBe('e2');
    expect(['B', 'E', 'F']).toContain(out[2].artistId);
    expect(out[2].image).toBeNull();
  });

  it('unterdrückte Zeilen zeigen den Primary, ohne Primary fallen sie weg', () => {
    const out = pickArtistsLive(rows, primaries, NOW, 10);
    expect(out.find(a => a.artistId === 'C')?.event.id).toBe('p3');
    expect(out.map(a => a.artistId)).not.toContain('D');
  });

  it('rotiert stündlich, stabil innerhalb der Stunde', () => {
    const a = pickArtistsLive(rows, primaries, NOW).map(x => x.artistId);
    expect(pickArtistsLive(rows, primaries, new Date(NOW.getTime() + 60_000)).map(x => x.artistId)).toEqual(a);
    const seen = new Set<string>();
    for (let h = 0; h < 24; h++) seen.add(pickArtistsLive(rows, primaries, new Date(NOW.getTime() + h * 3_600_000)).map(x => x.artistId).join());
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('festivalActs', () => {
  it('Headliner zuerst, höchstens drei Namen, Dubletten weg', () => {
    const acts = festivalActs([
      { artist_name_raw: 'Support One', billing: 'support' },
      { artist_name_raw: 'Big Head', billing: 'headliner' },
      { artist_name_raw: 'big head', billing: 'headliner' },
      { artist_name_raw: 'Sub Head', billing: 'sub_headliner' },
      { artist_name_raw: 'Opener', billing: 'opener' },
    ]);
    expect(acts).toEqual(['Big Head', 'Sub Head', 'Support One']);
  });
});

describe('pickPosts', () => {
  const post = (slug: string, title: string, publishDate: string): FestivalPost =>
    ({ slug, title, subtitle: 's', heroImage: `/h/${slug}.jpg`, publishDate, category: 'Festival', readingTime: 4 } as unknown as FestivalPost);
  const posts = [
    post('zukunft', 'Noch nicht da', '2026-11-06'),
    post('nova-rock-2027', 'Nova Rock 2027: alles zum Festival', '2026-11-04'),
    post('halloween', 'Halloween in Österreich', '2026-11-03'),
    post('frequency-2027', 'Frequency Festival 2027', '2026-11-02'),
    post('maerkte', 'Christkindlmärkte', '2026-11-01'),
    post('alt', 'Alter Post', '2026-10-01'),
  ];

  it('nur veröffentlichte Posts, Festival-Dubletten nach hinten, vier Stück', () => {
    const out = pickPosts(posts, [{ slug: 'nova-rock', canonical_name: 'Nova Rock' }], TODAY);
    expect(out.map(p => p.slug)).toEqual(['halloween', 'frequency-2027', 'maerkte', 'alt']);
    expect(out[0].image).toBe('/h/halloween.jpg');
  });

  it('Festival-Posts rücken nur nach hinten, sie fallen nicht weg', () => {
    const out = pickPosts(posts.slice(0, 3), [{ slug: 'nova-rock', canonical_name: 'Nova Rock' }], TODAY);
    expect(out.map(p => p.slug)).toEqual(['halloween', 'nova-rock-2027']);
  });
});

describe('pickActivities', () => {
  const act = (id: string, urls: string[] | null) => ({ id, images: urls ? [{ urls }] : null });

  it('nur mit renderbarem Bild, acht Stück, stabil pro Stunde', () => {
    const pool = [act('ohne', null), act('leer', []), ...Array.from({ length: 20 }, (_, i) => act(`a${i}`, [`u${i}`]))];
    const out = pickActivities(pool, NOW);
    expect(out).toHaveLength(8);
    expect(out.map(a => a.id)).not.toContain('ohne');
    expect(out.map(a => a.id)).not.toContain('leer');
    expect(pickActivities(pool, new Date(NOW.getTime() + 60_000))).toEqual(out);
  });
});

describe('readCountryTotal', () => {
  it('liest country_total, sonst null', () => {
    expect(readCountryTotal({ country_total: 88123, total: 1 })).toBe(88123);
    expect(readCountryTotal({ total: 1 })).toBeNull();
    expect(readCountryTotal(null)).toBeNull();
    expect(readCountryTotal({ country_total: '5' })).toBeNull();
  });
});

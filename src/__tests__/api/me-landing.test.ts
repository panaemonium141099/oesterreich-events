/**
 * GET /api/me/landing: anonym unverändert und no-store; eingeloggt
 * followedLive (gefolgte Künstler mit Termin in 7 Tagen) und followedNames
 * (normalisiert). Supabase ist gemockt, jede Abfrage wird mitgeschnitten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EVENT_URL_COLUMNS } from '@/lib/utils/slugify';

type Filter = [string, ...unknown[]];
interface Call { table: string; select?: string; filters: Filter[] }
type TableResult = { data: unknown[] | null; error: { message: string } | null };

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  tables: {} as Record<string, TableResult>,
  ctx: { signedIn: false } as Record<string, unknown>,
}));

vi.mock('@/lib/v4/get-landing-context', () => ({
  getLandingContext: async () => state.ctx,
}));

vi.mock('@/lib/artists/appearances', () => ({
  fetchArtistAppearances: vi.fn(async () => [{ id: 'm1' }]),
}));

vi.mock('@supabase/supabase-js', () => {
  const chain = (table: string): unknown => {
    const call: Call = { table, filters: [] };
    state.calls.push(call);
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') {
          const p = Promise.resolve(state.tables[table] ?? { data: [], error: null });
          return p.then.bind(p);
        }
        return (...args: unknown[]) => {
          if (prop === 'select') call.select = String(args[0]);
          else call.filters.push([String(prop), ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { createClient: () => ({ from: (t: string) => chain(t) }) };
});

import { GET } from '@/app/api/me/landing/route';

const future = (days: number, hour = 19) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

const event = (id: string, start: string, extra: Record<string, unknown> = {}) => ({
  id, slug: id, title: id, start_date: start, postal_code: '1010', address: null, bundesland: 'wien',
  location_name: 'Halle', country: 'AT', publish_status: 'published', ...extra,
});

const signedInCtx = {
  signedIn: true,
  userId: 'u1',
  savedEventIds: new Set(['s1']),
  artistMatchEventIds: new Set<string>(),
  lineupMatchEventIds: new Set(['l1']),
};

describe('GET /api/me/landing', () => {
  beforeEach(() => {
    state.calls.length = 0;
    state.tables = {};
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test';
  });

  it('anonym: Antwort unverändert, no-store, keine Datenbank-Abfrage', async () => {
    state.ctx = { signedIn: false, userId: null };
    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      signedIn: false, matches: [], savedEventIds: [], artistMatchEventIds: [], lineupMatchEventIds: [],
    });
    expect(state.calls).toEqual([]);
  });

  it('eingeloggt: followedNames normalisiert, followedLive mit Primary-Auflösung, privat 60 s', async () => {
    state.ctx = signedInCtx;
    state.tables.followed_artists = {
      data: [{ artist_name: 'Beyoncé' }, { artist_name: ' bilderbuch ' }, { artist_name: 'Beyonce' }],
      error: null,
    };
    state.tables.event_artists = {
      data: [
        { artist_id: 'a1', artist_name: 'Bilderbuch', artist_image: 'img', evo_link: 'evo', event: event('e1', future(2)) },
        { artist_id: 'a2', artist_name: 'Wanda', artist_image: null, evo_link: null, event: event('e2', future(2)) },
        { artist_id: 'a3', artist_name: 'Beyoncé', artist_image: null, evo_link: null,
          event: event('e3', future(1), { publish_status: 'duplicate', duplicate_of: 'p3' }) },
      ],
      error: null,
    };
    state.tables.events = { data: [event('p3', future(1))], error: null };

    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('private, max-age=60');
    const body = await res.json();

    expect(body.signedIn).toBe(true);
    expect(body.matches).toEqual([{ id: 'm1' }]);
    expect(body.savedEventIds).toEqual(['s1']);
    expect(body.lineupMatchEventIds).toEqual(['l1']);
    expect(body.followedNames).toEqual(['beyonce', 'bilderbuch']);
    expect(body.followedLive.map((a: { name: string; event: { id: string } }) => [a.name, a.event.id]))
      .toEqual([['Beyoncé', 'p3'], ['Bilderbuch', 'e1']]);
    expect(body.followedLive[1]).toMatchObject({ artistId: 'a1', image: 'img', evoLink: 'evo' });

    // Abfrage der Feed-Künstler: Land, Fenster, Namensfilter, URL-Spalten.
    const liveCall = state.calls.find(c => c.table === 'event_artists')!;
    expect(liveCall.select).toContain('event:events!inner(');
    for (const col of EVENT_URL_COLUMNS.split(',')) expect(liveCall.select).toContain(col);
    expect(liveCall.filters).toContainEqual(['eq', 'event.country', 'AT']);
    expect(liveCall.filters).toContainEqual(['or', 'publish_status.eq.published,duplicate_of.not.is.null', { referencedTable: 'event' }]);
    const nameFilter = liveCall.filters.find(f => f[0] === 'or' && String(f[1]).startsWith('artist_name.ilike.'))!;
    expect(nameFilter[1]).toContain('artist_name.ilike."Beyoncé"');
    expect(nameFilter[1]).toContain('artist_name.ilike."beyonce"');
    expect(nameFilter[1]).toContain('artist_name.ilike."bilderbuch"');
    expect(liveCall.filters.some(f => f[0] === 'gte' && f[1] === 'event.start_date')).toBe(true);
    expect(liveCall.filters.some(f => f[0] === 'lt' && f[1] === 'event.start_date')).toBe(true);

    // Primaries nur für unterdrückte Zeilen, veröffentlicht und im Land.
    const primaryCall = state.calls.find(c => c.table === 'events')!;
    expect(primaryCall.filters).toContainEqual(['in', 'id', ['p3']]);
    expect(primaryCall.filters).toContainEqual(['eq', 'country', 'AT']);
    expect(primaryCall.filters).toContainEqual(['eq', 'publish_status', 'published']);
    for (const col of EVENT_URL_COLUMNS.split(',')) expect(primaryCall.select).toContain(col);
  });

  it('ohne gefolgte Künstler keine Künstler-Abfrage, Listen leer', async () => {
    state.ctx = signedInCtx;
    state.tables.followed_artists = { data: [], error: null };
    const body = await (await GET()).json();
    expect(body.followedLive).toEqual([]);
    expect(body.followedNames).toEqual([]);
    expect(state.calls.map(c => c.table)).toEqual(['followed_artists']);
  });

  it('Fehler der Künstler-Abfrage lässt die übrige Antwort stehen', async () => {
    state.ctx = signedInCtx;
    state.tables.followed_artists = { data: [{ artist_name: 'Bilderbuch' }], error: null };
    state.tables.event_artists = { data: null, error: { message: 'canceling statement due to statement timeout' } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.matches).toEqual([{ id: 'm1' }]);
    expect(body.followedLive).toEqual([]);
    expect(body.followedNames).toEqual([]);
    spy.mockRestore();
  });
});

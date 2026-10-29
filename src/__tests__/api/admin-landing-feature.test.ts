/**
 * POST /api/admin/landing-feature (fn-30.7): Tipp des Tages buchen.
 *
 * sponsored legt eine Zeile mit Wiener Tagesgrenzen an, ein zweites Event am
 * selben Tag bekommt 409; ohne sponsorName oder day 400; Event nicht
 * published, nicht AT oder am Buchungstag vorbei 422; editorial verhält
 * sich wie bisher (Fenster ab jetzt bis `until`). Nach jeder Änderung wird
 * die Startseite neu gebaut. Supabase und revalidatePath sind gemockt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { viennaDayRange } from '@/lib/utils/event-time';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

type Result = { data: unknown; error: unknown };

/** Chainable Query-Builder: jede Methode gibt sich selbst zurück, await liefert `result`. */
function makeBuilder(result: Result) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'or', 'in', 'is', 'order', 'limit', 'delete', 'upsert', 'insert', 'update']) {
    b[m] = vi.fn().mockImplementation(() => b);
  }
  b.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(result));
  b.single = vi.fn().mockImplementation(() => Promise.resolve(result));
  b.then = vi.fn().mockImplementation((onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onOk, onErr),
  );
  return b;
}

/** Ergebnisse je Tabelle in Aufrufreihenfolge; jeder from() nimmt das nächste. */
const queues: Record<string, Result[]> = {};
const builders: Record<string, ReturnType<typeof makeBuilder>[]> = {};

function queue(table: string, ...results: Result[]) {
  (queues[table] ??= []).push(...results);
}

const mockFrom = vi.fn((table: string) => {
  const result = queues[table]?.shift() ?? { data: null, error: null };
  const b = makeBuilder(result);
  (builders[table] ??= []).push(b);
  return b;
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

let authUser: { id: string } | null = { id: 'admin-1' };
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: authUser }, error: null })) },
  }),
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { POST } = await import('@/app/api/admin/landing-feature/route');

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost:3000/api/admin/landing-feature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const DAY = '2026-11-05';
const EVENT = {
  id: 'ev-1',
  title: 'Konzert im Konzerthaus',
  publish_status: 'published',
  country: 'AT',
  start_date: '2026-11-05T19:00:00.000Z',
  end_date: null,
};

function admin() {
  queue('profiles', { data: { role: 'admin' }, error: null });
}

describe('POST /api/admin/landing-feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(queues)) delete queues[k];
    for (const k of Object.keys(builders)) delete builders[k];
    authUser = { id: 'admin-1' };
  });

  it('401 ohne Login, 403 ohne Admin-Rolle', async () => {
    authUser = null;
    expect((await post({ eventId: 'ev-1', featured: true })).status).toBe(401);

    authUser = { id: 'u-1' };
    queue('profiles', { data: { role: 'user' }, error: null });
    expect((await post({ eventId: 'ev-1', featured: true })).status).toBe(403);
  });

  it('sponsored: Zeile mit Wiener Tagesgrenzen (00:00 bis 24:00 Wien)', async () => {
    admin();
    queue('events', { data: EVENT, error: null });
    queue('landing_features', { data: [], error: null }); // Belegungsprüfung: frei
    queue('landing_features', {
      data: { event_id: 'ev-1', kind: 'sponsored', sponsor_name: 'Wiener Städtische', starts_at: 'x', ends_at: 'y' },
      error: null,
    });

    const res = await post({ eventId: 'ev-1', featured: true, kind: 'sponsored', sponsorName: 'Wiener Städtische', day: DAY });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.feature.kind).toBe('sponsored');

    const range = viennaDayRange(DAY);
    const upsert = builders.landing_features[1].upsert;
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, opts] = upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: 'event_id' });
    expect(row).toMatchObject({
      event_id: 'ev-1',
      kind: 'sponsored',
      sponsor_name: 'Wiener Städtische',
      starts_at: range.start.toISOString(),
      ends_at: range.next.toISOString(),
      created_by: 'admin-1',
    });
    // 5. November 2026 ist Winterzeit: 00:00 Wien = 23:00Z am Vortag.
    expect(row.starts_at).toBe('2026-11-04T23:00:00.000Z');
    expect(row.ends_at).toBe('2026-11-05T23:00:00.000Z');

    // Belegungsprüfung: nur sponsored, nicht dasselbe Event, Fenster überlappt den Tag.
    const check = builders.landing_features[0];
    expect(check.eq).toHaveBeenCalledWith('kind', 'sponsored');
    expect(check.neq).toHaveBeenCalledWith('event_id', 'ev-1');
    expect(check.lt).toHaveBeenCalledWith('starts_at', range.next.toISOString());
    expect(check.or).toHaveBeenCalledWith(`ends_at.is.null,ends_at.gt.${range.start.toISOString()}`);

    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
  });

  it('sponsored: zweite Buchung desselben Tages für ein anderes Event → 409 mit belegtem Event', async () => {
    admin();
    queue('events', { data: EVENT, error: null });
    queue('landing_features', {
      data: [{ event_id: 'ev-9', sponsor_name: 'Brauerei X', starts_at: 'a', ends_at: 'b', event: { title: 'Oktoberfest Wien' } }],
      error: null,
    });

    const res = await post({ eventId: 'ev-1', featured: true, kind: 'sponsored', sponsorName: 'Sponsor', day: DAY });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain(DAY);
    expect(json.error).toContain('Oktoberfest Wien');
    expect(json.conflict).toEqual({ eventId: 'ev-9', title: 'Oktoberfest Wien', sponsorName: 'Brauerei X' });
    // Kein Upsert, keine Revalidierung.
    expect(builders.landing_features).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('sponsored ohne sponsorName oder day → 400, ungültiger kind → 400', async () => {
    admin();
    let res = await post({ eventId: 'ev-1', featured: true, kind: 'sponsored', day: DAY });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/sponsorName/);

    admin();
    res = await post({ eventId: 'ev-1', featured: true, kind: 'sponsored', sponsorName: 'S' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/day/);

    admin();
    res = await post({ eventId: 'ev-1', featured: true, kind: 'sponsored', sponsorName: 'S', day: '2026-02-30' });
    expect(res.status).toBe(400);

    admin();
    res = await post({ eventId: 'ev-1', featured: true, kind: 'premium' });
    expect(res.status).toBe(400);

    expect(mockFrom).not.toHaveBeenCalledWith('events');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('422: Event nicht published, nicht AT oder am Buchungstag vorbei; 404 unbekannt', async () => {
    const booking = { eventId: 'ev-1', featured: true, kind: 'sponsored', sponsorName: 'S', day: DAY };

    admin();
    queue('events', { data: { ...EVENT, publish_status: 'needs_review' }, error: null });
    expect((await post(booking)).status).toBe(422);

    admin();
    queue('events', { data: { ...EVENT, country: 'DE' }, error: null });
    expect((await post(booking)).status).toBe(422);

    admin();
    queue('events', { data: { ...EVENT, start_date: '2026-11-04T19:00:00.000Z' }, error: null });
    expect((await post(booking)).status).toBe(422);

    // Mehrtägig: end_date am Buchungstag reicht.
    admin();
    queue('events', { data: { ...EVENT, start_date: '2026-11-01T10:00:00.000Z', end_date: '2026-11-05T20:00:00.000Z' }, error: null });
    queue('landing_features', { data: [], error: null });
    queue('landing_features', { data: { event_id: 'ev-1' }, error: null });
    expect((await post(booking)).status).toBe(200);

    admin();
    queue('events', { data: null, error: null });
    expect((await post(booking)).status).toBe(404);
  });

  it('editorial (Default): Fenster ab jetzt bis until, kein Sponsor, keine Belegungsprüfung', async () => {
    admin();
    queue('events', { data: EVENT, error: null });
    queue('landing_features', { data: { event_id: 'ev-1', kind: 'editorial' }, error: null });

    const until = '2026-11-20T00:00:00.000Z';
    const res = await post({ eventId: 'ev-1', featured: true, until, note: 'Saison' });
    expect(res.status).toBe(200);

    expect(builders.landing_features).toHaveLength(1);
    const [row] = builders.landing_features[0].upsert.mock.calls[0];
    expect(row).toMatchObject({ event_id: 'ev-1', kind: 'editorial', sponsor_name: null, ends_at: until, note: 'Saison' });
    expect(Date.parse(row.starts_at)).toBeGreaterThan(Date.now() - 60_000);
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
  });

  it('featured: false löscht die Buchung und baut die Startseite neu', async () => {
    admin();
    queue('landing_features', { data: null, error: null });

    const res = await post({ eventId: 'ev-1', featured: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, featured: false });
    const b = builders.landing_features[0];
    expect(b.delete).toHaveBeenCalled();
    expect(b.eq).toHaveBeenCalledWith('event_id', 'ev-1');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('500 mit Klartext, wenn der Upsert scheitert (supabase-js wirft nicht)', async () => {
    admin();
    queue('events', { data: EVENT, error: null });
    queue('landing_features', { data: null, error: { code: '42703', message: 'column kind does not exist' } });

    const res = await post({ eventId: 'ev-1', featured: true });
    expect(res.status).toBe(500);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

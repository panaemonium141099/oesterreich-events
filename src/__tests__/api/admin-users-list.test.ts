/**
 * GET /api/admin/users (2026-11-21): Nutzerliste und Zähler für /admin.
 *
 * Seit der Sperre 20261121120100 liest der Browser E-Mail, Anlagedatum und
 * Werbefrei-Schalter nicht mehr selbst aus profiles. Die Route antwortet nur
 * Admins, liest mit dem Service-Key und lässt den Suchtext nie aus seinem
 * Platz im PostgREST-Filter ausbrechen. Supabase und requireAdmin sind gemockt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

type Result = { data?: unknown; error?: unknown; count?: number | null };

const calls: Array<{ method: string; args: unknown[] }> = [];
let results: Result[] = [];

function makeBuilder(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'or', 'gte']) {
    b[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return b; };
  }
  b.then = (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => Promise.resolve(result).then(onOk, onErr);
  return b;
}

const createClient = vi.fn((..._args: unknown[]) => ({
  from: (table: string) => {
    calls.push({ method: 'from', args: [table] });
    return makeBuilder(results.shift() ?? { data: [], error: null, count: 0 });
  },
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => createClient(...args) }));

let authError: NextResponse | null = null;
vi.mock('@/lib/supabase/require-admin', () => ({
  requireAdmin: vi.fn().mockImplementation(() => Promise.resolve(authError)),
}));

const { GET } = await import('@/app/api/admin/users/route');
const get = (query = '') => GET(new NextRequest(`http://localhost:3000/api/admin/users${query}`));
const argsOf = (method: string) => calls.filter(c => c.method === method).map(c => c.args);

beforeEach(() => {
  calls.length = 0;
  results = [];
  authError = null;
  createClient.mockClear();
});

describe('GET /api/admin/users', () => {
  it('antwortet Nicht-Admins mit dem Fehler von requireAdmin und liest nichts', async () => {
    authError = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const res = await get();
    expect(res.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('liefert die 50 neuesten Profile mit den Spalten der Admin-Seite, über den Service-Key', async () => {
    results = [{ data: [{ id: 'u1', email: 'a@example.test' }], error: null }];
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ users: [{ id: 'u1', email: 'a@example.test' }] });
    expect(createClient.mock.calls[0].slice(0, 2)).toEqual(['https://test.supabase.co', 'test-service-role-key']);
    expect(argsOf('from')).toEqual([['profiles']]);
    expect(argsOf('select')).toEqual([['id, first_name, last_name, email, role, avatar_url, created_at, ads_disabled']]);
    expect(argsOf('order')).toEqual([['created_at', { ascending: false }]]);
    expect(argsOf('limit')).toEqual([[50]]);
    expect(argsOf('or')).toEqual([]);
  });

  it('sucht in Vorname, Nachname und E-Mail', async () => {
    await get('?search=' + encodeURIComponent('  max@example.test '));
    expect(argsOf('or')).toEqual([[
      'first_name.ilike.%max@example.test%,last_name.ilike.%max@example.test%,email.ilike.%max@example.test%',
    ]]);
  });

  it('nimmt dem Suchtext alles, was den Filter erweitern würde', async () => {
    await get('?search=' + encodeURIComponent('x%,role.eq.god)*("\\'));
    expect(argsOf('or')).toEqual([[
      'first_name.ilike.%x role.eq.god%,last_name.ilike.%x role.eq.god%,email.ilike.%x role.eq.god%',
    ]]);
    calls.length = 0;
    await get('?search=' + encodeURIComponent(' ,%() '));
    expect(argsOf('or')).toEqual([]);
  });

  it('meldet einen Lesefehler als 500 statt einer leeren Liste', async () => {
    results = [{ data: null, error: { message: 'statement timeout' } }];
    const res = await get();
    expect(res.status).toBe(500);
  });

  it('zählt gesamt, seit heute und seit sieben Tagen', async () => {
    results = [{ count: 99, error: null }, { count: 2, error: null }, { count: 7, error: null }];
    // Testuhr: 2026-11-05 (src/test/clock.ts). Tagesbeginn in Wien = 23:00 UTC am Vortag.
    const today = '2026-11-04T23:00:00.000Z';
    const res = await get(`?stats=1&today=${encodeURIComponent(today)}`);
    expect(await res.json()).toEqual({ total: 99, today: 2, week: 7 });
    expect(argsOf('select')).toEqual(Array(3).fill(['id', { count: 'exact', head: true }]));
    const since = argsOf('gte');
    expect(since).toHaveLength(2);
    expect(since[0]).toEqual(['created_at', today]);
    expect(Date.now() - Date.parse(since[1][1] as string)).toBe(7 * 24 * 3600_000);
  });

  it('nimmt einen unbrauchbaren Tagesbeginn nicht an', async () => {
    results = [{ count: 1, error: null }, { count: 1, error: null }, { count: 1, error: null }];
    await get('?stats=1&today=2020-01-01T00:00:00.000Z');
    const [day] = argsOf('gte');
    expect(Date.now() - Date.parse(day[1] as string)).toBeLessThan(24 * 3600_000);
  });

  it('meldet einen Zählfehler als 500', async () => {
    results = [{ count: 99, error: null }, { count: null, error: { message: 'boom' } }, { count: 7, error: null }];
    const res = await get('?stats=1');
    expect(res.status).toBe(500);
  });
});

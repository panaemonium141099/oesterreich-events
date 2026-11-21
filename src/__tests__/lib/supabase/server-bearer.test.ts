import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.c2lnbmF0dXI';

const requestHeaders = new Map<string, string>();
const cookieStore = { getAll: vi.fn(() => []), set: vi.fn() };

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null }),
  cookies: async () => cookieStore,
}));

const ssrClient = { kind: 'cookie' };
const createServerClient = vi.fn(() => ssrClient);
vi.mock('@supabase/ssr', () => ({ createServerClient: (...args: unknown[]) => createServerClient(...(args as [])) }));

const getUser = vi.fn(async (jwt?: string) => ({ data: { user: { id: 'user-1' } }, error: null, jwt }));
const createClient = vi.fn(() => ({ kind: 'bearer', auth: { getUser } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => createClient(...(args as [])) }));

const { bearerUserToken, createServerSupabaseClient } = await import('@/lib/supabase/server');

beforeEach(() => {
  requestHeaders.clear();
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'aaa.bbb.anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'aaa.bbb.service');
  vi.stubEnv('CRON_SECRET', 'cron-geheim');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('bearerUserToken', () => {
  it('liest das Token eines Nutzers', () => {
    expect(bearerUserToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(bearerUserToken(`bearer   ${TOKEN}`)).toBe(TOKEN);
  });

  it('gibt null ohne Header oder ohne JWT-Form', () => {
    expect(bearerUserToken(null)).toBeNull();
    expect(bearerUserToken('')).toBeNull();
    expect(bearerUserToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(bearerUserToken('Bearer cron-geheim')).toBeNull();
    expect(bearerUserToken(`Bearer ${TOKEN} extra`)).toBeNull();
  });

  it('hält die eigenen Schlüssel nie für ein Nutzer-Token', () => {
    expect(bearerUserToken('Bearer aaa.bbb.anon')).toBeNull();
    expect(bearerUserToken('Bearer aaa.bbb.service')).toBeNull();
    vi.stubEnv('CRON_SECRET', TOKEN);
    expect(bearerUserToken(`Bearer ${TOKEN}`)).toBeNull();
  });
});

describe('createServerSupabaseClient', () => {
  it('nutzt ohne Bearer-Token die Cookies wie bisher', async () => {
    const client = await createServerSupabaseClient();
    expect(client).toBe(ssrClient);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('bleibt bei den Cookies, wenn der Header das Cron-Secret trägt', async () => {
    requestHeaders.set('authorization', 'Bearer cron-geheim');
    expect(await createServerSupabaseClient()).toBe(ssrClient);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('arbeitet mit Bearer-Token im Namen dieses Nutzers', async () => {
    requestHeaders.set('authorization', `Bearer ${TOKEN}`);
    const client = await createServerSupabaseClient();

    expect(createServerClient).not.toHaveBeenCalled();
    expect(createClient).toHaveBeenCalledWith(
      'https://db.example.test',
      'aaa.bbb.anon',
      expect.objectContaining({
        global: { headers: { Authorization: `Bearer ${TOKEN}` } },
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );

    // Die Routen rufen getUser() ohne Argument: geprüft wird das Token der Anfrage.
    await client.auth.getUser();
    expect(getUser).toHaveBeenLastCalledWith(TOKEN);
  });
});

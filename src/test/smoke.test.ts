import { describe, it, expect, vi } from 'vitest';

// Hoist mock to top level as required by Vitest
vi.mock('@/lib/supabase/client', async () => {
  return await import('@/test/mocks/supabase');
});

describe('Test Infrastructure Smoke Test', () => {
  it('vitest runs and basic assertions work', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toContain('ell');
    expect([1, 2, 3]).toHaveLength(3);
  });

  it('path alias @/ resolves correctly', async () => {
    // Import from @/ alias to verify it resolves to src/
    const supabaseClient = await import('@/lib/supabase/client');
    expect(supabaseClient).toBeDefined();
    expect(typeof supabaseClient.createClient).toBe('function');
  });

  it('supabase mock is importable and functional', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('supabase mock query builder resolves on await', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const client = createClient();

    // Verify that awaiting a query chain resolves instead of hanging
    const result = await client.from('events').select('*');
    expect(result).toEqual({ data: null, error: null });

    // Verify chained queries also resolve
    const filtered = await client.from('events').select('*').eq('id', '1').order('created_at');
    expect(filtered).toEqual({ data: null, error: null });
  });

  it('next-navigation mock is importable and functional', async () => {
    const navMock = await import('@/test/mocks/next-navigation');
    expect(navMock.useRouter).toBeDefined();
    expect(navMock.usePathname).toBeDefined();
    expect(navMock.useSearchParams).toBeDefined();
    expect(navMock.useParams).toBeDefined();

    const router = navMock.useRouter();
    expect(router.push).toBeDefined();
    expect(typeof router.push).toBe('function');
  });

  it('next-navigation mock supports dynamic route params', async () => {
    const navMock = await import('@/test/mocks/next-navigation');

    // Default params should be empty
    expect(navMock.useParams()).toEqual({});

    // Set params for a dynamic route like /messages/[userId]
    navMock.setMockParams({ userId: 'abc-123' });
    expect(navMock.useParams()).toEqual({ userId: 'abc-123' });

    // Reset clears params
    navMock.resetNavigationMocks();
    expect(navMock.useParams()).toEqual({});
  });

  it('jest-dom matchers are available', () => {
    const matchers = expect(document.createElement('div'));
    expect(typeof matchers.toBeInTheDocument).toBe('function');
    expect(typeof matchers.toHaveTextContent).toBe('function');
    expect(typeof matchers.toBeVisible).toBe('function');
  });
});

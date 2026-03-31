import { vi } from 'vitest';

/**
 * Mock Supabase client that replaces the cached singleton from @/lib/supabase/client.
 *
 * Usage in tests:
 *   vi.mock('@/lib/supabase/client', () => await import('@/test/mocks/supabase'));
 *
 * Then configure return values per-test:
 *   mockSupabaseClient.from.mockReturnValue({ select: ... });
 */

const defaultResponse = { data: null, error: null };

/**
 * Creates a thenable query builder that resolves by default.
 * All chain methods return the same builder, and awaiting any chain
 * resolves to { data: null, error: null } unless overridden.
 */
function createQueryBuilder() {
  const builder: Record<string, any> = {};

  // Chain methods that return the builder itself
  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'in', 'contains', 'containedBy',
    'order', 'limit', 'range', 'filter', 'match',
    'not', 'or', 'is', 'overlaps', 'textSearch',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockImplementation(() => builder);
  }

  // Terminal methods that resolve with data
  builder.single = vi.fn().mockResolvedValue(defaultResponse);
  builder.maybeSingle = vi.fn().mockResolvedValue(defaultResponse);

  // Make the builder thenable so `await client.from('x').select('*')` resolves
  builder.then = vi.fn().mockImplementation(
    (onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any) =>
      Promise.resolve(defaultResponse).then(onFulfilled, onRejected)
  );

  return builder;
}

export const mockSupabaseClient = {
  from: vi.fn().mockImplementation(() => createQueryBuilder()),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: null, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  }),
  removeChannel: vi.fn(),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.jpg' } }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
};

/** Drop-in replacement for `createClient()` from `@/lib/supabase/client` */
export function createClient() {
  return mockSupabaseClient;
}

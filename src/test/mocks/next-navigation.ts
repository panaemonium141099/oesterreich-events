import { vi } from 'vitest';

/**
 * Mock for next/navigation used by App Router components.
 *
 * Usage in tests:
 *   vi.mock('next/navigation', () => await import('@/test/mocks/next-navigation'));
 *
 * Then configure per-test:
 *   mockRouter.push.mockImplementation(...);
 *   mockPathname.mockReturnValue('/events');
 */

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
};

let currentPathname = '/';
let currentSearchParams = new URLSearchParams();

export function useRouter() {
  return mockRouter;
}

export function usePathname() {
  return currentPathname;
}

export function useSearchParams() {
  return currentSearchParams;
}

export function useParams() {
  return {};
}

export function useSelectedLayoutSegment() {
  return null;
}

export function useSelectedLayoutSegments() {
  return [];
}

export function redirect(url: string) {
  mockRouter.push(url);
  throw new Error(`NEXT_REDIRECT: ${url}`);
}

export function notFound() {
  throw new Error('NEXT_NOT_FOUND');
}

/** Helper to set the mock pathname for tests */
export function setMockPathname(pathname: string) {
  currentPathname = pathname;
}

/** Helper to set the mock search params for tests */
export function setMockSearchParams(params: Record<string, string>) {
  currentSearchParams = new URLSearchParams(params);
}

/** Reset all mocks to defaults */
export function resetNavigationMocks() {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.refresh.mockClear();
  mockRouter.back.mockClear();
  mockRouter.forward.mockClear();
  mockRouter.prefetch.mockClear();
  currentPathname = '/';
  currentSearchParams = new URLSearchParams();
}

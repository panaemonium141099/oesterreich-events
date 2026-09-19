import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Hoisted mock so it's set up before module import.
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

// Pathname per Test veränderbar (simuliert den Routenwechsel), Router-Push
// als Spy, damit RouteTransitions den abgefangenen Klick dort abliefert.
const mockPathname = vi.fn(() => '/');
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { V4TopNavAuth } from '@/components/Layout/v4/V4TopNavAuth';
import { RouteTransitions } from '@/components/Layout/RouteTransitions';

describe('V4TopNavAuth', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockClear();
    mockPathname.mockReturnValue('/');
    mockPush.mockClear();
  });

  it('renders Anmelden link by default (SSR / anon)', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<V4TopNavAuth />);
    expect(screen.getByRole('link', { name: /anmelden/i })).toBeInTheDocument();
  });

  it('shows bell + avatar after hydration when session present', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            email: 'jona@example.com',
            user_metadata: { first_name: 'Jona' },
          },
        },
      },
    });
    render(<V4TopNavAuth />);
    await waitFor(() => {
      expect(screen.getByLabelText(/benachrichtigungen/i)).toBeInTheDocument();
    });
    // Initial of first_name "J"
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('subscribes and unsubscribes to auth state changes on unmount', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const unsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    const { unmount } = render(<V4TopNavAuth />);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('Bell linkt zu /notifications für authed user', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { email: 'jona@example.com', user_metadata: {} } },
      },
    });
    render(<V4TopNavAuth />);
    await waitFor(() => {
      const bell = screen.getByLabelText(/benachrichtigungen/i);
      expect(bell.closest('a')?.getAttribute('href')).toBe('/notifications');
    });
  });

  describe('Profilmenü mit RouteTransitions (Chromium-Pfad)', () => {
    // RouteTransitions greift nur in Browsern mit View-Transition-Support
    // (Feature-Detect auf document.startViewTransition). happy-dom hat die
    // API nicht, also nachrüsten — Callback sofort ausführen wie in Chromium.
    beforeEach(() => {
      (document as unknown as { startViewTransition: unknown }).startViewTransition =
        (cb: () => void | Promise<void>) => ({
          finished: Promise.resolve(cb()).then(() => undefined),
        });
    });
    afterEach(() => {
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    });

    it('schließt das Menü nach dem Routenwechsel, obwohl der Link-onClick nie feuert', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { email: 'jona@example.com', user_metadata: { first_name: 'Jona' } },
          },
        },
      });
      // Frisches Element pro Render: mit derselben Element-Referenz würde
      // React den Teilbaum überspringen und usePathname nie neu lesen — im
      // Next-Router erzwingt der Context-Wechsel diesen Re-Render.
      const ui = () => (
        <>
          <RouteTransitions />
          <V4TopNavAuth />
        </>
      );
      const view = render(ui());

      fireEvent.click(await screen.findByLabelText('Profilmenü'));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('menuitem', { name: 'Mein Profil' }));
      // Prämisse des Tests: RouteTransitions hat den Klick in der Capture-
      // Phase übernommen (preventDefault + stopPropagation) und selbst
      // navigiert — Reacts onClick auf dem Link kam nie dran.
      expect(mockPush).toHaveBeenCalledWith('/profile');

      // Navigation abgeschlossen: Pathname wechselt, das Menü muss zu sein.
      mockPathname.mockReturnValue('/profile');
      view.rerender(ui());
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

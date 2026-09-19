import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Pathname per Test veränderbar (simuliert den Routenwechsel), Router-Push
// als Spy, damit RouteTransitions den abgefangenen Klick dort abliefert.
const mockPathname = vi.fn(() => '/admin/overview');
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

import { AdminSidebar } from '@/components/Admin/AdminSidebar';
import { RouteTransitions } from '@/components/Layout/RouteTransitions';

/** Der mobile Drawer ist offen, wenn die aside-Klasse nicht mehr wegschiebt. */
function drawerIsOpen(): boolean {
  const aside = document.querySelector('aside');
  if (!aside) throw new Error('aside fehlt');
  return aside.className.includes('translate-x-0') && !aside.className.includes('-translate-x-full');
}

describe('AdminSidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/admin/overview');
    mockPush.mockClear();
  });

  it('markiert den aktiven Eintrag über den Pathname', () => {
    mockPathname.mockReturnValue('/admin/seo/experiments');
    render(<AdminSidebar />);
    expect(screen.getByRole('link', { name: 'SEO' }).className).toContain('text-amber-400');
    expect(screen.getByRole('link', { name: 'Overview' }).className).not.toContain('text-amber-400');
  });

  describe('mobiler Drawer mit RouteTransitions (Chromium-Pfad)', () => {
    // happy-dom kennt document.startViewTransition nicht; nachrüsten, damit
    // RouteTransitions wie in Chromium aktiv wird.
    beforeEach(() => {
      (document as unknown as { startViewTransition: unknown }).startViewTransition =
        (cb: () => void | Promise<void>) => ({
          finished: Promise.resolve(cb()).then(() => undefined),
        });
    });
    afterEach(() => {
      delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    });

    it('schließt den Drawer nach dem Routenwechsel, obwohl der Link-onClick nie feuert', () => {
      // Frisches Element pro Render: mit derselben Element-Referenz würde
      // React den Teilbaum überspringen und usePathname nie neu lesen — im
      // Next-Router erzwingt der Context-Wechsel diesen Re-Render.
      const ui = () => (
        <>
          <RouteTransitions />
          <AdminSidebar />
        </>
      );
      const view = render(ui());

      fireEvent.click(screen.getByLabelText('Open navigation'));
      expect(drawerIsOpen()).toBe(true);

      fireEvent.click(screen.getByRole('link', { name: 'Events' }));
      // Prämisse: RouteTransitions hat den Klick übernommen und navigiert.
      expect(mockPush).toHaveBeenCalledWith('/admin/events');

      mockPathname.mockReturnValue('/admin/events');
      view.rerender(ui());
      expect(drawerIsOpen()).toBe(false);
    });
  });
});

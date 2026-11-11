import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import { RouteTransitions } from '@/components/Layout/RouteTransitions';

/**
 * `view-transition-name` darf NUR während der Übergangs-Animation am
 * Seiten-Wrapper stehen. Dauerhaft gesetzt macht der Name `.route-root`
 * zum Stacking-Context, und jedes fixed-Overlay innerhalb der Seiten
 * (Filter-Sheets, Dialoge, Admin-Drawer) liegt unter V4TopNav/V4TabBar —
 * der Admin-Hamburger war so mobil nicht anklickbar (Mobile-Audit
 * 2026-10-22).
 */
describe('RouteTransitions — view-transition-name nur während des Übergangs', () => {
  let resolveFinished: () => void = () => {};
  let nameDuringCallback: string | undefined;

  beforeEach(() => {
    mockPush.mockClear();
    nameDuringCallback = undefined;
    (document as unknown as { startViewTransition: unknown }).startViewTransition =
      (cb: () => void | Promise<void>) => {
        const routeRoot = document.querySelector<HTMLElement>('.route-root');
        // Alt-Schnappschuss: der Name muss beim Aufruf schon stehen.
        nameDuringCallback = routeRoot?.style.getPropertyValue('view-transition-name');
        cb();
        return {
          finished: new Promise<void>(resolve => { resolveFinished = resolve; }),
        };
      };
  });
  afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  });

  it('setzt den Namen vor dem Übergang und entfernt ihn nach `finished`', async () => {
    const { getByText } = render(
      <>
        <RouteTransitions />
        <div className="route-root">
          <a href="/entdecken">Entdecken</a>
        </div>
      </>,
    );
    const routeRoot = document.querySelector<HTMLElement>('.route-root')!;
    expect(routeRoot.style.getPropertyValue('view-transition-name')).toBe('');

    fireEvent.click(getByText('Entdecken'));
    expect(mockPush).toHaveBeenCalledWith('/entdecken');
    expect(nameDuringCallback).toBe('route-root');
    // Während die Animation läuft, bleibt der Name (Neu-Schnappschuss).
    expect(routeRoot.style.getPropertyValue('view-transition-name')).toBe('route-root');

    resolveFinished();
    await Promise.resolve();
    await Promise.resolve();
    expect(routeRoot.style.getPropertyValue('view-transition-name')).toBe('');
  });
});

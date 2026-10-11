import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Nav-Suchfeld (2026-10-11): Die Top-Nav lebt im Root-Layout und bleibt
 * über Seitenwechsel gemountet. Der zuletzt gesuchte Begriff stand deshalb
 * auf jeder Folgeseite noch im Feld — auf der Landing sah es aus, als hinge
 * die Suche fest. Beim Seitenwechsel übernimmt das Feld den ?search-Wert der
 * neuen Seite (auf /entdecken) bzw. leert sich (überall sonst).
 */

vi.mock('next/navigation', async () => await import('@/test/mocks/next-navigation'));

const { setMockPathname, resetNavigationMocks, mockRouter } =
  await import('@/test/mocks/next-navigation');
const { V4SearchInput } = await import('@/components/Layout/v4/V4SearchInput');

describe('V4SearchInput (nav)', () => {
  beforeEach(() => {
    resetNavigationMocks();
    window.history.replaceState(null, '', '/');
  });

  it('leert sich beim Wechsel auf eine Seite ohne Suche', () => {
    setMockPathname('/entdecken');
    window.history.replaceState(null, '', '/entdecken?search=Konzert');
    const { rerender } = render(<V4SearchInput variant="nav" />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Konzert' } });
    fireEvent.submit(input.closest('form')!);
    expect(mockRouter.push).toHaveBeenCalledWith('/entdecken?search=Konzert');
    expect(input.value).toBe('Konzert');

    // Logo-Klick → Landing: die Nav bleibt gemountet, nur der Pfad ändert sich.
    setMockPathname('/');
    window.history.replaceState(null, '', '/');
    rerender(<V4SearchInput variant="nav" />);

    expect(input.value).toBe('');
  });
});

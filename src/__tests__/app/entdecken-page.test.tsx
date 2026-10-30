import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * /entdecken folgt der URL (2026-10-11): Der Modus (Liste/Smart) war
 * lokaler State, der nur beim Mount aus ?mode gelesen wurde. Eine Suche aus
 * der Top-Nav schob ?search=… in die URL, der Smart-Tab blieb aber mit der
 * alten Unterhaltung stehen — „erneute Eingabe wird nicht genommen".
 */

vi.mock('next/navigation', async () => await import('@/test/mocks/next-navigation'));

vi.mock('@/components/Discover/v4', () => ({
  V4EntdeckenHero: ({ mode, onModeChange }: { mode: string; onModeChange: (m: 'list' | 'smart') => void }) => (
    <div>
      <span data-testid="mode">{mode}</span>
      <button type="button" onClick={() => onModeChange('smart')}>smart</button>
      <button type="button" onClick={() => onModeChange('list')}>list</button>
    </div>
  ),
  V4EntdeckenListMode: ({ initialFilters }: { initialFilters?: { search?: string; dateFrom?: string; dateTo?: string } }) => (
    <div data-testid="list-mode" data-from={initialFilters?.dateFrom} data-to={initialFilters?.dateTo}>
      {initialFilters?.search ?? ''}
    </div>
  ),
  V4EntdeckenSmartMode: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="smart-mode">{initialQuery ?? ''}</div>
  ),
}));

const { setMockSearchParams, setMockPathname, resetNavigationMocks, mockRouter } =
  await import('@/test/mocks/next-navigation');
const { default: EntdeckenPage } = await import('@/app/[locale]/entdecken/page');

describe('/entdecken — Modus folgt der URL', () => {
  beforeEach(() => {
    resetNavigationMocks();
    setMockPathname('/entdecken');
  });

  it('wechselt vom Smart-Tab in die Liste, wenn die URL eine neue Suche trägt', () => {
    setMockSearchParams({ mode: 'smart', q: 'Techno' });
    const { rerender } = render(<EntdeckenPage />);
    expect(screen.getByTestId('smart-mode')).toHaveTextContent('Techno');

    // Top-Nav-Suche: router.push('/entdecken?search=Jazz') → neue Search-Params
    setMockSearchParams({ search: 'Jazz' });
    rerender(<EntdeckenPage />);

    expect(screen.queryByTestId('smart-mode')).toBeNull();
    expect(screen.getByTestId('list-mode')).toHaveTextContent('Jazz');
    expect(screen.getByTestId('mode')).toHaveTextContent('list');
  });

  it('schreibt den Tab-Wechsel in die URL und behält die Suche dabei', () => {
    setMockSearchParams({ search: 'Jazz' });
    render(<EntdeckenPage />);
    expect(screen.getByTestId('list-mode')).toHaveTextContent('Jazz');

    fireEvent.click(screen.getByText('smart'));

    expect(mockRouter.replace).toHaveBeenCalledWith(
      '/entdecken?search=Jazz&mode=smart',
      { scroll: false },
    );
  });

  // Tagesausgabe (fn-30.6): „Ganzes Programm" und „Alle anzeigen" der
  // Startseite verlinken einen Tagesbereich als ?von=&bis= (Wiener Tage).
  it('setzt dateFrom/dateTo aus ?von=&bis=, nur mit gültigen Kalendertagen', () => {
    setMockSearchParams({ von: '2026-10-30', bis: '2026-11-01' });
    render(<EntdeckenPage />);
    const list = screen.getByTestId('list-mode');
    expect(list).toHaveAttribute('data-from', '2026-10-30');
    expect(list).toHaveAttribute('data-to', '2026-11-01');
  });

  it('ignoriert ungültige von/bis-Werte', () => {
    setMockSearchParams({ von: 'heute', bis: '2026-02-30' });
    render(<EntdeckenPage />);
    const list = screen.getByTestId('list-mode');
    expect(list).not.toHaveAttribute('data-from');
    expect(list).not.toHaveAttribute('data-to');
  });
});

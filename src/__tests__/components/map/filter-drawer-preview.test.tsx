import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { FilterDrawer } from '@/components/MapV3/FilterDrawer';
import type { EventFilters } from '@/types/events';
import type { EventPreview } from '@/lib/v4/use-filtered-events';

// de-AT trennt Tausender mit einem schmalen Leerzeichen, daher `.` im Muster.
// Der Drawer rendert Desktop- und Mobil-Variante gleichzeitig (CSS schaltet).
const first = <T,>(xs: T[]) => xs[0];

function setup(previewCount?: (d: EventFilters, bl: string[]) => Promise<EventPreview | null>) {
  const onFiltersChange = vi.fn();
  const onBundeslandIdsChange = vi.fn();
  render(
    <FilterDrawer
      open
      onClose={vi.fn()}
      filters={{}}
      onFiltersChange={onFiltersChange}
      bundeslandIds={['all']}
      onBundeslandIdsChange={onBundeslandIdsChange}
      resultCount={999}
      categoryCounts={{}}
      previewCount={previewCount}
    />,
  );
  return { onFiltersChange, onBundeslandIdsChange };
}

describe('FilterDrawer: Vorschauzahl gilt für den Entwurf', () => {
  beforeEach(() => vi.useRealTimers());

  it('zeigt die Zahl für den geänderten Entwurf, bevor übernommen wird', async () => {
    const preview = vi.fn(async (_d: EventFilters, bl: string[]) =>
      ({ count: bl.includes('burgenland') ? 77 : 5000 }));
    setup(preview);

    await waitFor(() => expect(first(screen.getAllByText(/^5.000 Events anzeigen$/))).toBeTruthy());

    await act(async () => { fireEvent.click(first(screen.getAllByRole('button', { name: 'Burgenland' }))); });
    await waitFor(() => expect(first(screen.getAllByText('77 Events anzeigen'))).toBeTruthy());
    expect(preview).toHaveBeenLastCalledWith(expect.anything(), ['burgenland'], expect.anything());
  });

  it('zeigt während der Rechnung keine veraltete Zahl', async () => {
    let resolve: (p: EventPreview) => void = () => {};
    const preview = vi.fn(() => new Promise<EventPreview>((r) => { resolve = r; }));
    setup(preview);
    expect(first(screen.getAllByText('Events anzeigen'))).toBeTruthy();
    expect(screen.queryByText('999 Events anzeigen')).toBeNull();
    await waitFor(() => expect(preview).toHaveBeenCalled());
    await act(async () => { resolve({ count: 12 }); });
    await waitFor(() => expect(first(screen.getAllByText('12 Events anzeigen'))).toBeTruthy());
  });

  it('kennzeichnet eine Serverzählung als ungefähr', async () => {
    setup(async () => ({ count: 1234, approximate: true }));
    await waitFor(() => expect(first(screen.getAllByText(/^ca\. 1.234 Events anzeigen$/))).toBeTruthy());
  });

  it('ohne Vorschau-Funktion bleibt die Zahl des übernommenen Stands', () => {
    setup(undefined);
    expect(first(screen.getAllByText('999 Events anzeigen'))).toBeTruthy();
  });
});

describe('FilterDrawer: Region', () => {
  it('bietet die Karten-Pseudo-Region nicht als Bundesland an', () => {
    setup(undefined);
    expect(screen.queryByRole('button', { name: 'Österreich, Deutschland, Schweiz' })).toBeNull();
  });

  it('Deutschland & Schweiz laufen über atOnly', () => {
    const { onFiltersChange } = setup(undefined);
    fireEvent.click(first(screen.getAllByRole('button', { name: 'Auch Deutschland & Schweiz' })));
    fireEvent.click(first(screen.getAllByRole('button', { name: '999 Events anzeigen' })));
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ atOnly: false }));
  });
});

/**
 * Programmliste „Heute Abend" (fn-30.6): Server-Zeilen mit Uhrzeit, Bild,
 * Titel, Ort und Preis; die Client-Insel blendet nach dem Laden Zeilen aus,
 * deren Start mehr als 60 Minuten zurückliegt, folgt dem Wiener Tag der
 * DateLine und entfernt den Abschnitt, wenn keine Zeile bleibt. „Ganzes
 * Programm" zeigt immer den aktuellen Tag.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import type { Event } from '@/types/events';

vi.mock('@/components/Events/EventImage', () => ({
  EventImage: (props: Record<string, unknown>) => <img alt={String(props.alt ?? '')} data-testid="event-image"/>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { ProgramList } from '@/components/Landing/v4/ProgramList';
import { PROGRAM_GRACE_MS, programHref, programRowVisible } from '@/components/Landing/v4/ProgramListIsland';
import { announceViennaDay, resetViennaDayForTests } from '@/lib/landing/vienna-day';

// 30.10.2026 ist nach der Zeitumstellung (UTC+1): 18:00Z = 19:00 Wien.
const NOW = new Date('2026-10-30T18:00:00Z');
const TODAY = '2026-10-30';

const event = (id: string, startIso: string, extra: Partial<Event> = {}): Event => ({
  id, slug: id, title: `Event ${id}`, start_date: startIso, postal_code: '1010', address: null,
  bundesland: 'wien', location_name: `Ort ${id}`, country: 'AT', publish_status: 'published',
  image_url: `https://img.test/${id}.jpg`, category: 'konzert', ...extra,
} as Event);

// A 17:30 Wien (90 min her), B 18:30 Wien (30 min her), C 20:00 Wien.
const events = [
  event('a', '2026-10-30T16:30:00Z', { price_tier: 'gratis' }),
  event('b', '2026-10-30T17:30:00Z', { price_min: 12 }),
  event('c', '2026-10-30T19:00:00Z', { price_min: 20, price_max: 45 }),
];

describe('programRowVisible', () => {
  it('hält Zeilen bis 60 Minuten nach dem Start und nur am aktuellen Wiener Tag', () => {
    expect(programRowVisible('2026-10-30T17:30:00Z', NOW, TODAY)).toBe(true);
    expect(programRowVisible(new Date(NOW.getTime() - PROGRAM_GRACE_MS).toISOString(), NOW, TODAY)).toBe(true);
    expect(programRowVisible('2026-10-30T16:30:00Z', NOW, TODAY)).toBe(false);
    expect(programRowVisible('2026-10-30T19:00:00Z', NOW, '2026-10-31')).toBe(false);
    expect(programRowVisible('kein datum', NOW, TODAY)).toBe(false);
  });

  it('baut den Tageslink für /entdecken', () => {
    expect(programHref('2026-10-30')).toBe('/entdecken?von=2026-10-30&bis=2026-10-30');
  });
});

describe('ProgramList', () => {
  beforeEach(() => {
    resetViennaDayForTests();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt Uhrzeit, Bild, Titel, Ort und Preis und blendet die abgelaufene Zeile aus', () => {
    render(<ProgramList events={events} today={TODAY}/>);

    const section = screen.getByTestId('program-list');
    const rows = within(section).getAllByTestId('program-row');
    expect(rows).toHaveLength(2);
    expect(within(section).queryByText('Event a')).toBeNull();

    const b = rows[0];
    expect(b).toHaveTextContent('18:30');
    expect(b).toHaveTextContent('Event b');
    expect(b).toHaveTextContent('Ort b · Wien');
    expect(b).toHaveTextContent('12 €');
    expect(within(b).getByTestId('event-image')).toBeInTheDocument();
    expect(b).toHaveAttribute('data-track', 'landing_program_click');
    expect(rows[1]).toHaveTextContent('ab 20 €');

    expect(screen.getByRole('heading', { level: 2, name: 'Heute Abend' })).toBeInTheDocument();
    expect(screen.getByTestId('program-sub')).toHaveTextContent('Freitag, ab 17 Uhr');
    const all = screen.getByRole('link', { name: /Ganzes Programm/ });
    expect(all).toHaveAttribute('href', '/entdecken?von=2026-10-30&bis=2026-10-30');
    expect(all).toHaveAttribute('data-track', 'landing_program_all');
  });

  it('zeigt „Gratis" in der Preisspalte', () => {
    vi.setSystemTime(new Date('2026-10-30T16:00:00Z'));
    render(<ProgramList events={events} today={TODAY}/>);
    expect(within(screen.getAllByTestId('program-row')[0]).getByText('Gratis')).toBeInTheDocument();
  });

  it('entfällt, wenn keine Zeile mehr sichtbar ist, und folgt dem Tag der DateLine', () => {
    render(<ProgramList events={events} today={TODAY}/>);
    expect(screen.getByTestId('program-list')).toBeInTheDocument();

    // Mitternacht: die DateLine meldet den nächsten Wiener Tag, die Zeilen
    // von gestern gehören nicht mehr ins Programm.
    act(() => { announceViennaDay('2026-10-31'); });
    expect(screen.queryByTestId('program-list')).toBeNull();
  });

  it('rendert nichts ohne Events', () => {
    const { container } = render(<ProgramList events={[]} today={TODAY}/>);
    expect(container).toBeEmptyDOMElement();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Event } from '@/types/events';

vi.mock('@/i18n/navigation', () => ({
  Link: (p: { href: string; className?: string; children: React.ReactNode }) => (
    <a href={p.href} className={p.className}>{p.children}</a>
  ),
}));

import { ApproxEventsList } from '@/components/Map/ApproxEventsList';

/** Punkt aus dem Karten-Snapshot: Kurz-ID, kein Titel, kein Slug. */
const shortId = (i: number) => i.toString(16).padStart(12, '0');
const point = (i: number) => ({
  id: shortId(i),
  title: null,
  slug: null,
  start_date: '2026-10-03T00:00:00.000Z',
  category: 'Konzert',
  bundesland: 'Oberösterreich',
  district: 'Linz (Stadt)',
  image_url: null,
  location_name: null,
}) as unknown as Event;

/** /api/events/details-Antwort für die angefragten Kurz-IDs. */
function mockDetails() {
  const requested: string[][] = [];
  const fetchMock = vi.fn(async (url: string) => {
    const ids = new URL(url, 'http://x').searchParams.get('ids')!.split(',');
    requested.push(ids);
    return {
      ok: true,
      json: async () => ({
        events: ids.map((id) => ({
          id: `${id.slice(0, 8)}-${id.slice(8)}-0000-0000-000000000000`,
          slug: `event-${id}`,
          title: `Titel ${parseInt(id, 16)}`,
          image_url: null,
          location_name: 'Circus Roncalli',
          address: null,
          postal_code: '4020',
          start_date: '2026-10-03T17:30:00+00:00',
          end_date: null,
          price_text: null,
        })),
      }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return requested;
}

afterEach(() => vi.unstubAllGlobals());

describe('ApproxEventsList', () => {
  it('zeigt Anzahl, Hinweis und lädt die erste Seite als Links zur Eventseite', async () => {
    const requested = mockDetails();
    render(<ApproxEventsList events={Array.from({ length: 30 }, (_, i) => point(i))} onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: '30 Events' })).toBeInTheDocument();
    expect(screen.getByText(/Genauer Ort noch nicht bestätigt/)).toBeInTheDocument();

    const first = await screen.findByRole('link', { name: /Titel 0/ });
    expect(first.getAttribute('href')).toMatch(/^\/events\/4020-[a-z-]+\/2026-10-03\/event-000000000000$/);
    expect(first.textContent).toContain('Circus Roncalli');
    // Eine Seite = ein Request mit 24 IDs; der Rest bleibt ungeladen.
    expect(requested).toHaveLength(1);
    expect(requested[0]).toHaveLength(24);
    expect(screen.getAllByRole('link')).toHaveLength(24);
  });

  it('lädt über „Weitere anzeigen" den Rest nach und blendet den Button dann aus', async () => {
    const requested = mockDetails();
    render(<ApproxEventsList events={Array.from({ length: 30 }, (_, i) => point(i))} onClose={() => {}} />);
    await screen.findByRole('link', { name: /Titel 0/ });

    fireEvent.click(screen.getByRole('button', { name: 'Weitere anzeigen' }));

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(30));
    expect(requested).toHaveLength(2);
    expect(requested[1]).toHaveLength(6);
    expect(screen.queryByRole('button', { name: 'Weitere anzeigen' })).toBeNull();
  });

  it('meldet das Schließen und kommt bei einem Event ohne Mehr-Button aus', () => {
    mockDetails();
    const onClose = vi.fn();
    render(<ApproxEventsList events={[point(1)]} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: '1 Event' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Weitere anzeigen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Liste schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

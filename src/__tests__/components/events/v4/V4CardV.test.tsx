import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4CardV } from '@/components/Events/v4/V4CardV';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} data-priority={priority ? 'true' : 'false'} {...rest as object} />;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function ev(over: Partial<Event & { state: V4EventState }> = {}): Event & { state: V4EventState } {
  return {
    id: 'e1',
    source_id: null, source_name: null, source_url: null,
    title: 'Bilderbuch in der Arena',
    description: null,
    start_date: '2026-06-15T19:00:00Z',
    end_date: null,
    location_name: 'Arena Wien',
    address: null, postal_code: null, bundesland: 'Wien', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/bilderbuch.jpg',
    organizer: null, tags: null, ticket_url: 'https://eventim.de/x',
    slug: 'bilderbuch-arena',
    created_at: '', updated_at: '',
    state: 'ticket',
    ...over,
  };
}

describe('V4CardV', () => {
  it('renders title, date eyebrow and location', () => {
    render(<V4CardV event={ev()}/>);
    expect(screen.getByText('Bilderbuch in der Arena')).toBeInTheDocument();
    expect(screen.getByText('Arena Wien')).toBeInTheDocument();
  });

  it('links to /events/<slug>', () => {
    render(<V4CardV event={ev()}/>);
    const link = screen.getByRole('link', { name: /bilderbuch/i });
    expect(link.getAttribute('href')).toBe('/events/bilderbuch-arena');
  });

  it('renders the badge that matches event.state', () => {
    render(<V4CardV event={ev({ state: 'match' })}/>);
    const badge = document.querySelector('[data-v4-badge]');
    expect(badge?.getAttribute('data-kind')).toBe('match');
  });

  it('priority prop forwards to next/image (LCP optimisation)', () => {
    const { container } = render(<V4CardV event={ev()} priority/>);
    const img = container.querySelector('img');
    expect(img?.getAttribute('data-priority')).toBe('true');
  });

  it('hides badge for unknown state (no visual clutter)', () => {
    render(<V4CardV event={ev({ state: 'unknown' })}/>);
    expect(document.querySelector('[data-v4-badge]')).toBeNull();
  });
});

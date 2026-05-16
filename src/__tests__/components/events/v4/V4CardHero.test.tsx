import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4CardHero } from '@/components/Events/v4/V4CardHero';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} data-priority={priority ? 'true' : 'false'} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function ev(over: Partial<Event & { state: V4EventState }> = {}): Event & { state: V4EventState } {
  return {
    id: 'h1', source_id: null, source_name: null, source_url: null,
    title: 'FM4 Frequency 2026',
    description: 'Drei Tage Festival in St. Pölten',
    start_date: '2026-08-13T16:00:00Z', end_date: null,
    location_name: 'Green Park, St. Pölten',
    address: null, postal_code: null, bundesland: 'Niederösterreich', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/frequency.jpg',
    organizer: null, tags: null, ticket_url: 'https://eventim.de/freq',
    slug: 'fm4-frequency-2026', created_at: '', updated_at: '',
    state: 'lineup',
    ...over,
  };
}

describe('V4CardHero', () => {
  it('renders title and link (canonical V2 URL)', () => {
    render(<V4CardHero event={ev()}/>);
    expect(screen.getByText('FM4 Frequency 2026')).toBeInTheDocument();
    const href = screen.getByRole('link').getAttribute('href') || '';
    expect(href).toMatch(/^\/events\/.+\/2026-08-13\/fm4-frequency-2026$/);
  });

  it('respects priority prop for next/image LCP', () => {
    const { container } = render(<V4CardHero event={ev()} priority/>);
    expect(container.querySelector('img')?.getAttribute('data-priority')).toBe('true');
  });

  it('shows lineup badge floating top-left', () => {
    render(<V4CardHero event={ev({ state: 'lineup' })}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
  });
});

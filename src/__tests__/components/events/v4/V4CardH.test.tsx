import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4CardH } from '@/components/Events/v4/V4CardH';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object} />;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function ev(over: Partial<Event & { state: V4EventState }> = {}): Event & { state: V4EventState } {
  return {
    id: 'e2', source_id: null, source_name: null, source_url: null,
    title: 'Wanda im Volksgarten', description: null,
    start_date: '2026-06-20T20:30:00Z', end_date: null,
    location_name: 'Volksgarten Pavillon',
    address: null, postal_code: null, bundesland: 'Wien', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/wanda.jpg',
    organizer: null, tags: null, ticket_url: 'https://eventim.de/y',
    slug: 'wanda-volksgarten', created_at: '', updated_at: '',
    state: 'match',
    ...over,
  };
}

describe('V4CardH', () => {
  it('renders title and location inline', () => {
    render(<V4CardH event={ev()}/>);
    expect(screen.getByText('Wanda im Volksgarten')).toBeInTheDocument();
    expect(screen.getByText('Volksgarten Pavillon')).toBeInTheDocument();
  });

  it('links to event slug', () => {
    render(<V4CardH event={ev()}/>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/events/wanda-volksgarten');
  });

  it('renders badge for match state', () => {
    render(<V4CardH event={ev({ state: 'match' })}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="match"]')).toBeTruthy();
  });
});

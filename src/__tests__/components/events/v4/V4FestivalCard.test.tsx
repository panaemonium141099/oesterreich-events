import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FestivalCard } from '@/components/Events/v4/V4FestivalCard';
import type { Festival } from '@/types/festivals';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function fest(over: Partial<Festival> = {}): Festival {
  return {
    id: 'f1',
    slug: 'nova-rock-2026',
    canonical_name: 'Nova Rock 2026',
    starts_at: '2026-06-10',
    ends_at: '2026-06-13',
    state: 'Burgenland',
    website_url: null,
    lineup_url: null,
    city: null,
    genres: null,
    registry_source: null,
    spotify_priority: null,
    direct_lineup_candidate: false,
    lineup_fetch_mode: null,
    lineup_status: 'fetched',
    lineup_hash: null,
    lineup_last_checked_at: null,
    parent_event_id: null,
    created_at: '',
    updated_at: '',
    ...over,
  } as Festival;
}

describe('V4FestivalCard', () => {
  it('renders festival name and date range', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(screen.getByText('Nova Rock 2026')).toBeInTheDocument();
  });

  it('links to /events/<slug>', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/events/nova-rock-2026');
  });

  it('shows lineup badge when lineupMatch is true', () => {
    render(<V4FestivalCard festival={fest()} lineupMatch/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
  });

  it('no badge when lineupMatch is false', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeNull();
  });
});

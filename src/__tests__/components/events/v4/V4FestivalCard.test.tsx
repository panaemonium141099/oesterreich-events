import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FestivalCard } from '@/components/Events/v4/V4FestivalCard';
import type { Festival } from '@/types/festivals';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, ...rest } = props as Record<string, unknown>;
    void fill; void sizes;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function fest(over: Partial<Festival & { href?: string | null }> = {}): Festival & { href?: string | null } {
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
  } as Festival & { href?: string | null };
}

describe('V4FestivalCard', () => {
  it('renders festival name and date range', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(screen.getByText('Nova Rock 2026')).toBeInTheDocument();
  });

  it('renders a clickable Link when href is provided', () => {
    render(<V4FestivalCard festival={fest({ href: '/events/7000-eisenstadt/2026-06-10/nova-rock' })}/>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/events/7000-eisenstadt/2026-06-10/nova-rock');
  });

  it('renders a non-clickable div when href is null (no parent_event)', () => {
    // Bug-Regression: ohne parent_event soll die Card NICHT auf
    // /events/{slug-aus-festival-table} linken — der Slug existiert
    // nicht in der events-Tabelle und liefert sonst einen 404.
    render(<V4FestivalCard festival={fest({ href: null })}/>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Nova Rock 2026')).toBeInTheDocument();
  });

  it('renders a non-clickable div when href is undefined', () => {
    // Legacy callers without the href prop fall through to non-clickable.
    render(<V4FestivalCard festival={fest()}/>);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows lineup badge when lineupMatch is true', () => {
    render(<V4FestivalCard festival={fest({ href: '/events/x/y/z' })} lineupMatch/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
  });

  it('no badge when lineupMatch is false', () => {
    render(<V4FestivalCard festival={fest({ href: '/events/x/y/z' })}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeNull();
  });
});

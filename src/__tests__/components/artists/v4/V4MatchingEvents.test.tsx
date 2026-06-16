import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V4MatchingEvents } from '@/components/Artists/v4/V4MatchingEvents';
import type { ArtistAppearance } from '@/lib/artists/appearances';

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

const base: ArtistAppearance = {
  artist_name: 'Bilderbuch',
  artist_image: 'https://x/a.jpg',
  kind: 'festival',
  context: 'Nova Rock',
  event_id: 'e1',
  event_slug: 'bilderbuch-at-nova-rock',
  start_date: '2026-09-15T20:00:00Z',
  location_name: 'Nickelsdorf',
  postal_code: null,
  bundesland: 'Burgenland',
};

describe('V4MatchingEvents (artist-grouped)', () => {
  it('shows one row per artist with count, collapsed by default', () => {
    render(<V4MatchingEvents appearances={[base]}/>);
    expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    expect(screen.getByText(/1 Auftritt\b/i)).toBeInTheDocument();
    // appearance detail hidden until the row is opened
    expect(screen.queryByText('Nova Rock')).not.toBeInTheDocument();
  });

  it('expands to the artist appearances on click', () => {
    render(<V4MatchingEvents appearances={[base]}/>);
    fireEvent.click(screen.getByText('Bilderbuch'));
    expect(screen.getByText(/spielt bei/i)).toBeInTheDocument();
    expect(screen.getByText('Nova Rock')).toBeInTheDocument();
  });

  it('groups multiple appearances of the same artist into one row', () => {
    const two: ArtistAppearance[] = [
      base,
      { ...base, event_id: 'e2', context: 'Frequency', start_date: '2026-08-01T20:00:00Z' },
    ];
    render(<V4MatchingEvents appearances={two}/>);
    expect(screen.getAllByText('Bilderbuch')).toHaveLength(1);
    expect(screen.getByText(/2 Auftritte/i)).toBeInTheDocument();
  });

  it('empty-state when no appearances', () => {
    render(<V4MatchingEvents appearances={[]}/>);
    expect(screen.getByText(/wir warten auf erste auftritte/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('V4MatchingEvents', () => {
  const appearances: ArtistAppearance[] = [
    {
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
    },
  ];

  it('renders artist-forward copy "<Artist> spielt bei <Festival>"', () => {
    render(<V4MatchingEvents appearances={appearances}/>);
    expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    expect(screen.getByText(/spielt bei/i)).toBeInTheDocument();
    expect(screen.getByText('Nova Rock')).toBeInTheDocument();
  });

  it('empty-state when no appearances', () => {
    render(<V4MatchingEvents appearances={[]}/>);
    expect(screen.getByText(/wir warten auf erste auftritte/i)).toBeInTheDocument();
  });
});

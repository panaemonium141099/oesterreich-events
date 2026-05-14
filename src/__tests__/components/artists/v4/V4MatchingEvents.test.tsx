import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MatchingEvents } from '@/components/Artists/v4/V4MatchingEvents';

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
  const matches = [
    {
      id: 'e1', slug: 'bilderbuch-arena', title: 'Arena Wien',
      start_date: '2026-09-15T20:00:00Z', location_name: 'Arena',
      image_url: 'https://x/a.jpg', ticket_url: 'https://eventim/x',
      bundesland: 'Wien', price_text: '€ 48,00',
      matched_artist: 'Bilderbuch', match_kind: 'match' as const,
    },
  ];

  it('renders matched event with personalized copy', () => {
    render(<V4MatchingEvents events={matches}/>);
    // Component renders "{matched_artist} spielt bei {title}"
    expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    expect(screen.getByText(/spielt bei/i)).toBeInTheDocument();
    expect(screen.getByText('Arena Wien')).toBeInTheDocument();
  });

  it('empty-state when no matches', () => {
    render(<V4MatchingEvents events={[]}/>);
    expect(screen.getByText(/wir warten auf erste auftritte/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FunnelCard } from '@/components/Events/v4/V4FunnelCard';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('V4FunnelCard', () => {
  it('renders title, sub, and CTA', () => {
    render(
      <V4FunnelCard
        ordinal="01" icon="music" accent="match"
        title="Lieblingskünstler folgen"
        sub="Such und folge deine Lieblingskünstler."
        cta="Künstler suchen" href="/artists"
      />
    );
    expect(screen.getByText('Lieblingskünstler folgen')).toBeInTheDocument();
    expect(screen.getByText('Such und folge deine Lieblingskünstler.')).toBeInTheDocument();
    expect(screen.getByText('Künstler suchen')).toBeInTheDocument();
  });

  it('href is correct', () => {
    render(
      <V4FunnelCard
        ordinal="01" icon="music" accent="match"
        title="x" sub="y" cta="z" href="/artists"
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/artists');
  });

  it('exposes data-track when trackId provided', () => {
    render(
      <V4FunnelCard
        ordinal="01" icon="music" accent="match"
        title="x" sub="y" cta="z" href="/artists" trackId="cta_artist"
      />
    );
    expect(screen.getByRole('link').getAttribute('data-track')).toBe('cta_artist');
  });

  it('renders ordinal in editorial italic style', () => {
    render(
      <V4FunnelCard
        ordinal="03" icon="ticket" accent="go"
        title="x" sub="y" cta="z" href="/plans"
      />
    );
    expect(screen.getByText('03')).toBeInTheDocument();
  });
});

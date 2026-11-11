import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EventDetailHero } from '@/components/Events/v4/V4EventDetailHero';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, priority, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} data-priority={priority ? 'true' : 'false'} {...rest as object}/>;
  },
}));

// V4BackButton (Phase 4.12) calls useRouter — mock next/navigation
// damit der Hero in Tests rendert.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe('V4EventDetailHero', () => {
  const baseProps = {
    title: 'Bilderbuch in der Stadthalle',
    startDate: '2026-09-15T20:00:00Z',
    locationName: 'Stadthalle Halle D',
    city: 'Wien',
    imageUrl: 'https://cdn.example/hero.jpg',
  };

  it('renders title as h1', () => {
    render(<V4EventDetailHero {...baseProps}/>);
    expect(screen.getByRole('heading', { level: 1, name: /bilderbuch in der stadthalle/i })).toBeInTheDocument();
  });

  it('shows location and city', () => {
    render(<V4EventDetailHero {...baseProps}/>);
    expect(screen.getByText(/stadthalle halle d/i)).toBeInTheDocument();
    expect(screen.getByText(/wien/i)).toBeInTheDocument();
  });

  it('uses next/image with priority for LCP', () => {
    const { container } = render(<V4EventDetailHero {...baseProps}/>);
    const img = container.querySelector('img');
    expect(img?.getAttribute('data-priority')).toBe('true');
    expect(img?.getAttribute('src')).toBe('https://cdn.example/hero.jpg');
  });

  it('falls back to text-only hero when no image', () => {
    render(<V4EventDetailHero {...baseProps} imageUrl={null}/>);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('Bildnachweis am Bild: Website und Quellpfad mit Link auf die Seite des Termins', () => {
    const sourceUrl = 'https://www.amt-sn.de/kalender/2026-amt/oktober/2026-10-29-amts-senioren-kaffee-in-steinhorst/';
    render(<V4EventDetailHero {...baseProps} imageCredit={{ credit: 'amt-sn.de', sourceUrl }}/>);
    const credit = screen.getByTestId('hero-image-credit');
    expect(credit.textContent).toContain('amt-sn.de');
    const link = credit.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(sourceUrl);
    expect(link.textContent).toBe('amt-sn.de/kalender/2026-amt/oktober/2026-10-29-amts-senioren-kaffee-in-steinhorst');
  });

  it('kein Bildnachweis ohne Bild', () => {
    render(<V4EventDetailHero {...baseProps} imageUrl={null} imageCredit={{ credit: 'amt-sn.de', sourceUrl: 'https://www.amt-sn.de/' }}/>);
    expect(screen.queryByTestId('hero-image-credit')).toBeNull();
  });
});

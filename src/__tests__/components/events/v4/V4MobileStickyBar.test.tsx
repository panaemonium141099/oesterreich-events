import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MobileStickyBar } from '@/components/Events/v4/V4MobileStickyBar';

describe('V4MobileStickyBar', () => {
  it('state=ticket renders "Zu {provider}" + price', () => {
    render(<V4MobileStickyBar state="ticket" provider="Eventim" priceFrom="€ 48" ticketUrl="x"/>);
    expect(screen.getByText('€ 48')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /zu eventim/i })).toBeInTheDocument();
  });

  it('state=free renders "Abend planen"', () => {
    render(<V4MobileStickyBar state="free"/>);
    expect(screen.getByRole('link', { name: /abend planen/i })).toBeInTheDocument();
  });

  it('state=inplan renders "Plan öffnen"', () => {
    render(<V4MobileStickyBar state="inplan"/>);
    expect(screen.getByRole('link', { name: /plan öffnen/i })).toBeInTheDocument();
  });

  it('state=unknown renders "Merken"', () => {
    render(<V4MobileStickyBar state="unknown"/>);
    expect(screen.getByRole('link', { name: /merken/i })).toBeInTheDocument();
  });

  it('is md:hidden (desktop suppresses it)', () => {
    const { container } = render(<V4MobileStickyBar state="free"/>);
    expect(container.firstElementChild?.className).toContain('md:hidden');
  });
});

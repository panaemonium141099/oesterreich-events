import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4TicketBox } from '@/components/Events/v4/V4TicketBox';

describe('V4TicketBox', () => {
  it('renders provider line + price + primary CTA', () => {
    render(<V4TicketBox eventId="test-id" provider="Eventim" priceFrom="€ 48,00" ticketUrl="https://eventim.de/x"/>);
    expect(screen.getByText('Offizieller Ticketshop: Eventim')).toBeInTheDocument();
    expect(screen.getByText('€ 48,00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /zu eventim/i })).toBeInTheDocument();
  });

  it('CTA href is the ticketUrl', () => {
    render(<V4TicketBox eventId="test-id" provider="oeticket" priceFrom="€ 25,00" ticketUrl="https://oeticket.com/abc"/>);
    expect(screen.getByRole('link', { name: /zu oeticket/i }).getAttribute('href')).toBe('https://oeticket.com/abc');
  });

  it('shows ticket badge by default', () => {
    render(<V4TicketBox eventId="test-id" provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="ticket"]')).toBeTruthy();
  });

  it('variant="match" swaps to gold match badge with personalized label', () => {
    render(<V4TicketBox eventId="test-id" provider="Eventim" priceFrom="€ 10" ticketUrl="x" variant="match" artistName="Bilderbuch"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="match"]')).toBeTruthy();
    expect(screen.getByText(/du folgst bilderbuch/i)).toBeInTheDocument();
  });

  it('variant="lineup" shows lineup badge with artist-in-lineup wording', () => {
    render(<V4TicketBox eventId="test-id" provider="Eventim" priceFrom="€ 10" ticketUrl="x" variant="lineup" artistName="Wanda"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
    expect(screen.getByText(/wanda im line-up/i)).toBeInTheDocument();
  });

  it('renders both trust-copy strings', () => {
    render(<V4TicketBox eventId="test-id" provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    expect(screen.getByText('Kauf und Zahlung erfolgen beim offiziellen Anbieter.')).toBeInTheDocument();
    expect(screen.getByText('Du wirst zum offiziellen Ticketshop weitergeleitet.')).toBeInTheDocument();
  });

  it('ticket-shop link opens in new tab + rel safe', () => {
    render(<V4TicketBox eventId="test-id" provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    const link = screen.getByRole('link', { name: /zu eventim/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });
});

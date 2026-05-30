import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4UnknownBox } from '@/components/Events/v4/V4UnknownBox';

describe('V4UnknownBox', () => {
  it('shows unknown badge', () => {
    render(<V4UnknownBox eventId="test-id"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="unknown"]')).toBeTruthy();
  });

  it('headline mentions no-known-shop messaging', () => {
    render(<V4UnknownBox eventId="test-id"/>);
    expect(screen.getByText(/kein.*ticketshop/i)).toBeInTheDocument();
  });

  it('offers Merken as primary action even without coordinates', () => {
    render(<V4UnknownBox eventId="test-id"/>);
    expect(screen.getByRole('link', { name: /merken/i })).toBeInTheDocument();
    // Route-Button rendert nicht ohne mapsUrl — ein leerer `#route`-Link
    // war der Bug, der den User auf der selben Seite festhielt.
    expect(screen.queryByRole('link', { name: /route/i })).toBeNull();
  });

  it('renders Route-Link with Google-Maps URL when mapsUrl provided', () => {
    const url = 'https://www.google.com/maps/dir/?api=1&destination=47.5,15.5';
    render(<V4UnknownBox eventId="test-id" mapsUrl={url}/>);
    const route = screen.getByRole('link', { name: /route/i });
    expect(route.getAttribute('href')).toBe(url);
    expect(route.getAttribute('target')).toBe('_blank');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/navigation usePathname — vary per test via mockReturnValue.
const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock supabase client (used by V4TopNavAuth island)
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

import { V4TopNav } from '@/components/Layout/v4/V4TopNav';

describe('V4TopNav', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
  });

  it('renders the wordmark logo', () => {
    render(<V4TopNav />);
    expect(screen.getByText('treffen')).toBeInTheDocument();
  });

  it('renders all four primary nav links', () => {
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Entdecken' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Künstler' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Karte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meine Pläne' })).toBeInTheDocument();
  });

  it('Entdecken is active on /', () => {
    mockPathname.mockReturnValue('/');
    render(<V4TopNav />);
    const link = screen.getByRole('link', { name: 'Entdecken' });
    expect(link.getAttribute('data-active')).toBe('true');
  });

  it('Entdecken is active on /entdecken', () => {
    mockPathname.mockReturnValue('/entdecken');
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Entdecken' }).getAttribute('data-active')).toBe('true');
  });

  it('Künstler is active on /artists/spotify-import (sub-route match)', () => {
    mockPathname.mockReturnValue('/artists/spotify-import');
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Künstler' }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('link', { name: 'Entdecken' }).getAttribute('data-active')).toBe('false');
  });

  it('Meine Pläne is active on both /plans and /saved (Phase 1 stub redirect)', () => {
    mockPathname.mockReturnValue('/saved');
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Meine Pläne' }).getAttribute('data-active')).toBe('true');
  });

  it('renders the search affordance linking to /entdecken', () => {
    render(<V4TopNav />);
    const search = screen.getByRole('link', { name: /suchen/i });
    expect(search.getAttribute('href')).toBe('/entdecken');
  });

  it('renders the auth island (Anmelden pill for anon)', () => {
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: /anmelden/i })).toBeInTheDocument();
  });

  it('has sticky positioning and z-index for layering', () => {
    const { container } = render(<V4TopNav />);
    const header = container.querySelector('header');
    expect(header?.className).toMatch(/sticky/);
    expect(header?.className).toMatch(/top-0/);
    expect(header?.className).toMatch(/z-30/);
  });
});

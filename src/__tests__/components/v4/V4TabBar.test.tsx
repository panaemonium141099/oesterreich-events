import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

import { V4TabBar } from '@/components/Layout/v4/V4TabBar';

describe('V4TabBar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  it('renders all 5 primary mobile tabs', () => {
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /entdecken/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /künstler/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /karte/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pläne/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profil/i })).toBeInTheDocument();
  });

  it('Profil-Tab links to /auth/login when anon', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /profil/i }).getAttribute('href')).toBe('/auth/login');
  });

  it('Profil-Tab links to /profile when authed', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'a@b.c', user_metadata: {} } } },
    });
    render(<V4TabBar />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /profil/i }).getAttribute('href')).toBe('/profile');
    });
  });

  it('renders the bottom-padding spacer so content does not get hidden', () => {
    const { container } = render(<V4TabBar />);
    const spacer = container.querySelector('[data-v4-tabbar-spacer]');
    expect(spacer).toBeTruthy();
    expect(spacer?.className).toContain('md:hidden');
  });

  it('nav itself is md:hidden (desktop hides this bar)', () => {
    const { container } = render(<V4TabBar />);
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('md:hidden');
  });

  it('marks the matching tab as active', () => {
    mockPathname.mockReturnValue('/map');
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /karte/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('link', { name: /entdecken/i }).getAttribute('data-active')).toBe('false');
  });

  it('Meine Pläne tab active on /saved (Phase 1 stub redirect)', () => {
    mockPathname.mockReturnValue('/saved');
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /pläne/i }).getAttribute('data-active')).toBe('true');
  });
});

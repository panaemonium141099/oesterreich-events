import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Hoisted mock so it's set up before module import.
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

import { V4TopNavAuth } from '@/components/Layout/v4/V4TopNavAuth';

describe('V4TopNavAuth', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockClear();
  });

  it('renders Anmelden link by default (SSR / anon)', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<V4TopNavAuth />);
    expect(screen.getByRole('link', { name: /anmelden/i })).toBeInTheDocument();
  });

  it('shows bell + avatar after hydration when session present', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            email: 'jona@example.com',
            user_metadata: { first_name: 'Jona' },
          },
        },
      },
    });
    render(<V4TopNavAuth />);
    await waitFor(() => {
      expect(screen.getByLabelText(/benachrichtigungen/i)).toBeInTheDocument();
    });
    // Initial of first_name "J"
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('subscribes and unsubscribes to auth state changes on unmount', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const unsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    const { unmount } = render(<V4TopNavAuth />);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('Bell linkt zu /notifications für authed user', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { email: 'jona@example.com', user_metadata: {} } },
      },
    });
    render(<V4TopNavAuth />);
    await waitFor(() => {
      const bell = screen.getByLabelText(/benachrichtigungen/i);
      expect(bell.closest('a')?.getAttribute('href')).toBe('/notifications');
    });
  });
});

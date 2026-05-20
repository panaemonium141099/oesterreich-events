import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { V4EntdeckenSmartMode } from '@/components/Discover/v4/V4EntdeckenSmartMode';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('V4EntdeckenSmartMode', () => {
  beforeEach(() => { fetchMock.mockReset(); });

  it('renders search input + samples', () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    expect(screen.getByPlaceholderText(/was hast du vor/i)).toBeInTheDocument();
    expect(screen.getByText(/probier mal/i)).toBeInTheDocument();
  });

  it('runs semantic search and shows result count', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        query: 'test',
        parsed: { embedded_text: 'test', after_date: null, before_date: null, max_price_tier: null, signals: [] },
        matches: [
          { id: 'm1', title: 'Event 1', start_date: '2026-06-15', _similarity: 0.95, slug: null, location_name: null, category: null, tags: null, image_url: null, price_text: null, price_tier: null, description: null, audience: null, vibe: null, occasion_tags: null, is_student_friendly: null, is_family_friendly: null }
        ],
        count: 1,
      }),
    });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    fireEvent.change(screen.getByPlaceholderText(/was hast du vor/i), { target: { value: 'test query' } });
    fireEvent.submit(screen.getByPlaceholderText(/was hast du vor/i).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/1 treffer/i)).toBeInTheDocument();
    });
  });

  it('shows empty-state on 0 results', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ query: 'x', parsed: { embedded_text: 'x', after_date: null, before_date: null, max_price_tier: null, signals: [] }, matches: [], count: 0 }),
    });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    fireEvent.change(screen.getByPlaceholderText(/was hast du vor/i), { target: { value: 'x' } });
    fireEvent.submit(screen.getByPlaceholderText(/was hast du vor/i).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/keine treffer/i)).toBeInTheDocument();
    });
  });

  it('runs initial search when initialQuery provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ query: 'preset', parsed: { embedded_text: 'preset', after_date: null, before_date: null, max_price_tier: null, signals: [] }, matches: [], count: 0 }),
    });
    render(<V4EntdeckenSmartMode initialQuery="preset"/>);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? '{}'));
    expect(body.query).toBe('preset');
  });

  it('reruns search when initialQuery changes (URL-driven re-search)', async () => {
    // Generic implementation so we don't have to count strict-mode-induced
    // duplicate calls — every fetch returns the same shape echoing the body.
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      return {
        ok: true,
        json: async () => ({
          query: body.query,
          parsed: { embedded_text: body.query, after_date: null, before_date: null, max_price_tier: null, signals: [] },
          matches: [],
          count: 0,
        }),
      };
    });

    const { rerender } = render(<V4EntdeckenSmartMode initialQuery="eisenstadt"/>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBeforeRerender = fetchMock.mock.calls.length;

    rerender(<V4EntdeckenSmartMode initialQuery="wiesmath"/>);
    await waitFor(() => {
      // Either the dep changed and a new fetch fired, or the test already
      // captured it before the assertion ran.
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRerender);
      const lastBody = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body ?? '{}'));
      expect(lastBody.query).toBe('wiesmath');
    });
  });
});

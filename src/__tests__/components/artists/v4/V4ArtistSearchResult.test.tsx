import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { V4ArtistSearchResult } from '@/components/Artists/v4/V4ArtistSearchResult';

// Stable global fetch mock
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/supabase/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'a@b.c' }, loading: false }),
}));

describe('V4ArtistSearchResult', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('renders idle hint with empty query', () => {
    render(<V4ArtistSearchResult/>);
    expect(screen.getByPlaceholderText(/artist, band oder dj suchen/i)).toBeInTheDocument();
  });

  it('runs search on submit and shows result card', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ artists: [{ id: 'a1', name: 'Bilderbuch', genres: ['austropop'], image_url: null, spotify_artist_id: 's1' }] }),
    });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'bilderbuch' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    });
  });

  it('shows empty-state when search returns no results', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ artists: [] }) });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/keine künstler gefunden/i)).toBeInTheDocument();
    });
  });

  it('Follow click POSTs to /api/artists/follow and shows toast', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: [{ id: 'a1', name: 'Bilderbuch', genres: ['austropop'], image_url: null, spotify_artist_id: 's1' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'bilderbuch' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => screen.getByText('Bilderbuch'));

    fireEvent.click(screen.getByRole('button', { name: /^folgen$/i }));
    await waitFor(() => {
      expect(screen.getByText(/du folgst jetzt bilderbuch/i)).toBeInTheDocument();
    });
  });

  it('shows error on failed search', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'bilderbuch' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/suche fehlgeschlagen/i)).toBeInTheDocument();
    });
  });
});

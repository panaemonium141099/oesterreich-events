/**
 * Plakatwand (/artists): Regale und Verzeichnis aus dem statischen
 * Verzeichnis, anonym Folgen als Login-Link und kein Request; mit
 * sb-Cookie /api/artists/following, Reihe „Deine Künstler“, Folgen und
 * Entfolgen optimistisch mit Rückrollen; Suche lokal, Blatt mit Terminen
 * und Ticketlink.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ArtistsWall } from '@/components/Artists/v4/ArtistsWall';
import type { DirectoryArtist } from '@/lib/artists/directory';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/artists',
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const COOKIE = 'sb-test-auth-token';
const setCookie = () => { document.cookie = `${COOKIE}=abc; path=/`; };
const clearCookie = () => { document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; };

const TODAY = '2026-11-02';
const artist = (id: string, name: string, dates: string[], extra: Partial<DirectoryArtist> = {}): DirectoryArtist => ({
  id,
  name,
  image: null,
  evoLink: `https://www.oeticket.com/noapp/artist/${id}/?affiliate=J70`,
  kind: 'konzert',
  genre: 'rock',
  events: dates.map((d, i) => ({
    id: `${id}-${i}`, slug: `${id}-${i}`, title: `${name} live`, start_date: d, postal_code: '1010', address: null, bundesland: 'wien',
    location_name: 'Gasometer', city: 'Wien', ticket_url: i === 0 ? `https://www.oeticket.com/noapp/event/${id}/?affiliate=J70` : null,
  })),
  ...extra,
});

const ARTISTS = [
  artist('a', 'Ernst Molden', ['2026-11-02T18:30:00Z', '2026-11-05T18:30:00Z', '2026-11-10T18:30:00Z'], { kind: 'klassik', genre: 'jazz' }),
  artist('b', 'Alex Kristan', ['2026-11-03T18:30:00Z'], { kind: 'kabarett', genre: 'kabarett' }),
  artist('c', 'Placebo', ['2026-11-10T19:00:00Z']),
  artist('d', 'Bob Dylan', ['2026-11-11T19:00:00Z']),
  artist('e', 'Korn', ['2026-11-19T19:00:00Z']),
  artist('f', 'Tokio Hotel', ['2026-11-15T19:00:00Z']),
  artist('g', 'Jungle', ['2026-11-13T19:00:00Z']),
  artist('h', 'Wiener Blond', ['2026-11-20T19:00:00Z'], { kind: 'klassik', genre: 'jazz' }),
];

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => Promise.resolve({ ok: false, status, json: async () => ({ error: 'x' }) });

function arm(following: unknown, follow: (init: RequestInit) => Promise<unknown> = () => ok({ followed_artist: { id: 'new' } })) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/artists/following')) return ok(following);
    if (url === '/api/artists/follow') return follow(init ?? {});
    throw new Error(`unexpected fetch ${url}`);
  });
}
const followCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/artists/follow') as Array<[string, RequestInit]>;

describe('ArtistsWall', () => {
  beforeEach(() => { fetchMock.mockReset(); clearCookie(); });
  afterEach(() => clearCookie());

  it('anonym: Regale und Verzeichnis aus dem HTML, Folgen ist ein Login-Link, kein Request', () => {
    render(<ArtistsWall artists={ARTISTS} today={TODAY} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Künstler' })).toBeInTheDocument();
    expect(screen.getByText('8 Künstler mit Terminen in Österreich in den nächsten drei Monaten')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Konzerte' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Diese Woche live' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Alle Künstler von A bis Z' })).toBeInTheDocument();
    expect(screen.queryByTestId('artists-mine')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const links = screen.getAllByRole('link', { name: /folgen$/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/auth/login?redirect=/artists');
      expect(link.className).toContain('min-w-[88px]');
    }
    expect(screen.queryByRole('button', { name: /folgen$/ })).toBeNull();
  });

  it('Buchstabenfilter: nur Künstler mit dem Anfangsbuchstaben, andere Buchstaben gesperrt', () => {
    render(<ArtistsWall artists={ARTISTS} today={TODAY} />);
    expect(screen.getByRole('button', { name: 'Q' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'K' }));
    const directory = screen.getByRole('heading', { name: 'Alle Künstler von A bis Z' }).closest('section')!;
    expect(within(directory).getAllByRole('button', { name: /öffnen$/ }).map(b => b.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Korn')]));
    expect(within(directory).queryByText('Placebo')).toBeNull();
  });

  it('mit Cookie: holt die gefolgten Künstler, zeigt „Deine Künstler“ mit Termin und markiert Knöpfe', async () => {
    setCookie();
    arm({ artists: [
      { id: 'f1', artist_name: 'placebo', spotify_image_url: null },
      { id: 'f2', artist_name: 'Bilderbuch', spotify_image_url: 'https://i.scdn.co/b.jpg' },
    ] });
    render(<ArtistsWall artists={ARTISTS} today={TODAY} />);

    const mine = await screen.findByTestId('artists-mine');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/artists/following?limit=200');
    const items = within(mine).getAllByRole('button', { name: /öffnen$/ });
    expect(items.map(b => b.textContent)).toEqual([expect.stringContaining('Placebo'), expect.stringContaining('Bilderbuch')]);
    expect(within(mine).getByText('noch kein Termin')).toBeInTheDocument();
    expect(within(mine).getByRole('link', { name: 'Benachrichtigungen' })).toHaveAttribute('href', '/settings/notifications');

    expect(screen.getAllByRole('button', { name: 'Placebo entfolgen' })[0]).toHaveTextContent('Folgst du');
    expect(screen.getAllByRole('button', { name: 'Korn folgen' })[0]).toHaveTextContent('Folgen');
    expect(screen.queryByRole('link', { name: /folgen$/ })).toBeNull();
  });

  it('Folgen: sofort „Folgst du“, POST mit Name und Bild; Entfolgen DELETE; bei Fehler zurück', async () => {
    setCookie();
    let answer: (init: RequestInit) => Promise<unknown> = () => ok({ followed_artist: { id: 'new' } });
    arm({ artists: [] }, init => answer(init));
    render(<ArtistsWall artists={ARTISTS} today={TODAY} />);
    await screen.findByTestId('artists-mine');
    expect(screen.getByText(/Noch keine Künstler/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Korn folgen' })[0]);
    expect(screen.getAllByRole('button', { name: 'Korn entfolgen' })[0]).toHaveTextContent('Folgst du');
    await waitFor(() => expect(followCalls()).toHaveLength(1));
    expect(followCalls()[0][1].method).toBe('POST');
    expect(JSON.parse(String(followCalls()[0][1].body))).toMatchObject({ artist_name: 'Korn', source: 'manual' });
    expect(within(screen.getByTestId('artists-mine')).getByRole('button', { name: 'Korn öffnen' })).toBeInTheDocument();

    answer = () => fail(500);
    fireEvent.click(screen.getAllByRole('button', { name: 'Korn entfolgen' })[0]);
    expect(screen.getAllByRole('button', { name: 'Korn folgen' })[0]).toBeInTheDocument();
    await waitFor(() => expect(followCalls()).toHaveLength(2));
    expect(followCalls()[1][1].method).toBe('DELETE');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Korn entfolgen' })[0]).toHaveTextContent('Folgst du'));
    expect(screen.getByRole('status')).toHaveTextContent('Das hat nicht geklappt');
  });

  it('Suche: lokale Treffer ab zwei Zeichen, ohne Treffer anonym der Login-Hinweis', () => {
    render(<ArtistsWall artists={ARTISTS} today={TODAY} />);
    const input = screen.getByRole('searchbox', { name: 'Künstler suchen' });
    fireEvent.change(input, { target: { value: 'dyl' } });
    const results = screen.getByTestId('artist-search-results');
    expect(within(results).getByRole('button', { name: 'Bob Dylan öffnen' })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'wanda' } });
    expect(screen.getByText('Niemand im Verzeichnis heißt so.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anmelden, um Künstlern ohne Termin zu folgen' })).toHaveAttribute('href', '/auth/login?redirect=/artists');
  });

  it('Blatt: Termine mit Event-Link und Ticketlink (Affiliate, ticket_click), Escape schließt', () => {
    render(<ArtistsWall artists={ARTISTS} today={TODAY} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ernst Molden öffnen' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Ernst Molden' })).toBeInTheDocument();
    expect(within(dialog).getByText('Jazz, 3 Termine in Österreich')).toBeInTheDocument();
    const tickets = within(dialog).getAllByRole('link', { name: /^Tickets für/ });
    expect(tickets).toHaveLength(3);
    expect(tickets[0]).toHaveAttribute('href', 'https://www.oeticket.com/noapp/event/a/?affiliate=J70');
    expect(tickets[1]).toHaveAttribute('href', 'https://www.oeticket.com/noapp/artist/a/?affiliate=J70');
    expect(tickets[0]).toHaveAttribute('data-track', 'ticket_click');
    expect(tickets[0]).toHaveAttribute('data-track-provider', 'eventim');
    expect(within(dialog).getAllByRole('link', { name: /Gasometer/ })[0]).toHaveAttribute('href', expect.stringMatching(/^\/events\/1010-wien\/2026-11-02\//));
    expect(within(dialog).getByRole('heading', { name: 'Auch bald live' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Wiener Blond öffnen' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

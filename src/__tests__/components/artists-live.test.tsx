/**
 * ArtistsLive: Rotation im statischen HTML, Personalisierung nur mit
 * sb-Cookie, Folgen/Entfolgen optimistisch mit Rückrollen bei Nicht-2xx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ArtistsLive, artistWhenLabel } from '@/components/Landing/v4/ArtistsLive';
import type { LandingArtistLive } from '@/lib/v4/landing-picks';
import type { Event } from '@/types/events';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const COOKIE = 'sb-test-auth-token';
const setCookie = () => { document.cookie = `${COOKIE}=abc; path=/`; };
const clearCookie = () => { document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`; };

const future = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(19, 0, 0, 0);
  return d.toISOString();
};

const event = (id: string, start: string, extra: Partial<Event> = {}): Event => ({
  id, slug: id, title: id, start_date: start, postal_code: '1010', address: null, bundesland: 'wien',
  location_name: 'Gasometer', country: 'AT', publish_status: 'published', ...extra,
} as Event);

const artist = (artistId: string, name: string, days: number, image: string | null = null): LandingArtistLive =>
  ({ artistId, name, image, evoLink: null, event: event(`e-${artistId}`, future(days)) });

const ROTATION = [artist('r1', 'Bilderbuch', 1, 'https://img.test/b.jpg'), artist('r2', 'Wanda', 2), artist('r3', 'Dardan', 3)];

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });
const fail = (status: number) => Promise.resolve({ ok: false, status, json: async () => ({ error: 'x' }) });

/** fetch-Mock: /api/me/landing liefert die Personalisierung, /api/artists/follow antwortet mit `follow`. */
function arm(me: unknown, follow: (init: RequestInit) => Promise<unknown> = () => ok({})) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === '/api/me/landing') return ok(me);
    if (url === '/api/artists/follow') return follow(init ?? {});
    throw new Error(`unexpected fetch ${url}`);
  });
}

const followCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/artists/follow') as Array<[string, RequestInit]>;

const SIGNED_IN = {
  signedIn: true,
  followedLive: [artist('f1', 'Conchita Wurst', 1)],
  followedNames: ['conchita wurst', 'bilderbuch'],
};

describe('ArtistsLive', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearCookie();
  });
  afterEach(() => clearCookie());

  it('anonym: Rotation aus dem HTML, kein Request, Knopf ist ein Login-Link', () => {
    render(<ArtistsLive artists={ROTATION}/>);
    expect(screen.getByRole('heading', { name: 'Diese Woche live' })).toBeInTheDocument();
    for (const a of ROTATION) expect(screen.getByText(a.name)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    const links = screen.getAllByRole('link', { name: /folgen$/ });
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/auth/login?redirect=/');
      expect(link).toHaveAttribute('data-track', 'landing_artist_follow');
      expect(link.className).toContain('min-w-[88px]');
      expect(link.className).toContain('whitespace-nowrap');
    }
    expect(screen.getByRole('link', { name: 'Bilderbuch folgen' })).toHaveAttribute('data-track-id', 'Bilderbuch');
    expect(screen.getByRole('link', { name: 'Alle Künstler ›' })).toHaveAttribute('href', '/artists');
    expect(screen.getByText('Wir sagen dir Bescheid, sobald ein neuer Termin auftaucht.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('mit Cookie: holt /api/me/landing, gefolgte zuerst, rotierte gefolgte als „Folgst du"', async () => {
    setCookie();
    arm(SIGNED_IN);
    render(<ArtistsLive artists={ROTATION}/>);

    await waitFor(() => expect(screen.getByText('Conchita Wurst')).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me/landing');

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('Conchita Wurst')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Conchita Wurst entfolgen' })).toHaveTextContent('Folgst du');
    expect(within(rows[1]).getByRole('button', { name: 'Bilderbuch entfolgen' })).toHaveTextContent('Folgst du');
    expect(within(rows[2]).getByRole('button', { name: 'Wanda folgen' })).toHaveTextContent('Folgen');
    expect(screen.queryByText('Dardan')).toBeNull();

    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('aria-pressed');
      expect(button).toHaveAttribute('data-track', 'landing_artist_follow');
      expect(button.className).toContain('min-w-[88px]');
      expect(button.className).toContain('whitespace-nowrap');
    }
    expect(screen.getByRole('button', { name: 'Wanda folgen' })).toHaveAttribute('data-track-id', 'Wanda');
    expect(screen.queryByRole('link', { name: /folgen$/ })).toBeNull();
  });

  it('Folgen: sofort „Folgst du", POST mit Name; bleibt bei 2xx', async () => {
    setCookie();
    arm(SIGNED_IN, () => ok({ followed_artist: {} }));
    render(<ArtistsLive artists={ROTATION}/>);
    const button = await screen.findByRole('button', { name: 'Wanda folgen' });

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Wanda entfolgen' })).toHaveTextContent('Folgst du');

    await waitFor(() => expect(followCalls()).toHaveLength(1));
    const [, init] = followCalls()[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ artist_name: 'Wanda', source: 'manual' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Wanda entfolgen' })).toBeInTheDocument());
  });

  it.each([401, 500])('Folgen rollt bei %i zurück und meldet den Fehler', async (status) => {
    setCookie();
    arm(SIGNED_IN, () => fail(status));
    render(<ArtistsLive artists={ROTATION}/>);
    const button = await screen.findByRole('button', { name: 'Wanda folgen' });

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Wanda entfolgen' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Wanda folgen' })).toHaveTextContent('Folgen'));
    expect(screen.getByRole('status')).toHaveTextContent('Das hat nicht geklappt, bitte noch einmal versuchen.');
  });

  it('„Folgst du" ruft DELETE mit dem Namen und wird zu „Folgen"', async () => {
    setCookie();
    arm(SIGNED_IN, () => ok({ success: true }));
    render(<ArtistsLive artists={ROTATION}/>);
    const button = await screen.findByRole('button', { name: 'Bilderbuch entfolgen' });

    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Bilderbuch folgen' })).toHaveTextContent('Folgen');

    await waitFor(() => expect(followCalls()).toHaveLength(1));
    const [, init] = followCalls()[0];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({ artist_name: 'Bilderbuch' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bilderbuch folgen' })).toBeInTheDocument());
  });

  it('Entfolgen rollt bei 500 zurück', async () => {
    setCookie();
    arm(SIGNED_IN, () => fail(500));
    render(<ArtistsLive artists={ROTATION}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Bilderbuch entfolgen' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bilderbuch entfolgen' })).toHaveTextContent('Folgst du'));
  });

  it('Cookie ohne gültige Session: Rotation und Login-Links bleiben', async () => {
    setCookie();
    arm({ signedIn: false });
    render(<ArtistsLive artists={ROTATION}/>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole('link', { name: /folgen$/ })).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ohne Pool rendert die Kachel nichts', () => {
    const { container } = render(<ArtistsLive artists={[]}/>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('artistWhenLabel', () => {
  const t = (key: string) => ({ today: 'Heute', tomorrow: 'Morgen' })[key] ?? key;
  // 19:00Z im November = 20:00 Wien.
  const ev = event('x', '2026-11-02T19:00:00Z');

  it('Heute, Morgen, sonst Wochentag; Uhrzeit in Wiener Zeit; Ort dahinter', () => {
    expect(artistWhenLabel(ev, 'de', t, new Date('2026-11-02T10:00:00Z'))).toBe('Heute 20:00 · Gasometer');
    expect(artistWhenLabel(ev, 'de', t, new Date('2026-11-01T10:00:00Z'))).toBe('Morgen 20:00 · Gasometer');
    expect(artistWhenLabel(ev, 'de', t, new Date('2026-10-30T10:00:00Z'))).toMatch(/^Mo\.? 20:00 · Gasometer$/);
    expect(artistWhenLabel(ev, 'en', t, new Date('2026-10-30T10:00:00Z'))).toMatch(/^Mon 20:00 · Gasometer$/);
  });

  it('ohne echte Uhrzeit nur der Tag, ohne Ort nur die Zeit', () => {
    const allDay = event('y', '2026-11-02T00:00:00Z', { is_all_day: true, location_name: null });
    expect(artistWhenLabel(allDay, 'de', t, new Date('2026-11-02T10:00:00Z'))).toBe('Heute');
  });
});

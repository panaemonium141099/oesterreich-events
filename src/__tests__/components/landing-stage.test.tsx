/**
 * Bühne der Tagesausgabe (fn-30.5): Masthead, TipOfDay, SeasonCard, MapTile.
 * Kennzeichnung „Anzeige" nur bei sponsored, Buchungs-Hinweis nur ohne
 * Buchung, LCP-Bild mit preload, sechs Saison-Picks mit Ellipsis,
 * Karten-Kachel mit Attribution und Fallback ohne Token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Event } from '@/types/events';
import type { LandingTip } from '@/lib/v4/landing-picks';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { MAPBOX_ATTRIBUTION_LINKS } from '@/lib/v4/map-static-url';

const imageCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('@/components/Events/EventImage', () => ({
  EventImage: (props: Record<string, unknown>) => {
    imageCalls.push(props);
    return <img alt={String(props.alt ?? '')} data-testid="event-image"/>;
  },
}));
vi.mock('@/lib/landing/weekend-weather', () => ({
  RAIN_MM: 3,
  loadWeekendWeather: () => Promise.resolve(null),
  loadTodayWeather: () => new Promise(() => {}),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { Masthead } from '@/components/Landing/v4/Masthead';
import { TipOfDay, tipCtaLabel } from '@/components/Landing/v4/TipOfDay';
import { SeasonCard } from '@/components/Landing/v4/SeasonCard';
import { MapTile } from '@/components/Landing/v4/MapTile';

const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id, slug: id, title: `Event ${id}`, start_date: '2026-10-30T18:30:00Z', postal_code: '1010', address: null,
  bundesland: 'wien', location_name: 'Gasometer', country: 'AT', publish_status: 'published',
  image_url: `https://img.test/${id}.jpg`, category: 'konzert', ...extra,
} as Event);

const tip = (kind: LandingTip['kind'], extra: Partial<Event> = {}, sponsorName: string | null = null): LandingTip =>
  ({ event: event('tip', extra), kind, sponsorName });

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${Object.values(values).join(',')}` : key;

describe('tipCtaLabel', () => {
  it('bildet den Knopftext aus dem Preis', () => {
    expect(tipCtaLabel(event('a', { price_min: 29, price_max: 59 }), t)).toBe('ticketsFrom:29');
    expect(tipCtaLabel(event('b', { price_min: 29 }), t)).toBe('tickets:29 €');
    expect(tipCtaLabel(event('c', { price_tier: 'gratis' }), t)).toBe('free');
    expect(tipCtaLabel(event('d', { price_text: 'EUR 79.00 pro Person inkl. Sekt' }), t)).toBe('toEvent');
  });
});

describe('TipOfDay', () => {
  beforeEach(() => { imageCalls.length = 0; });

  it('sponsored: „Anzeige" und Sponsorname, kein Buchungs-Hinweis, Bild mit preload', () => {
    const tp = tip('sponsored', { price_min: 29, price_max: 120 }, 'Wiener Stadthalle');
    render(<TipOfDay tip={tp}/>);

    expect(screen.getByText('Tipp des Tages')).toBeInTheDocument();
    expect(screen.getByText('Anzeige')).toBeInTheDocument();
    expect(screen.getAllByText(/Wiener Stadthalle/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Tipp des Tages buchen')).toBeNull();

    const link = screen.getByRole('link', { name: /Event tip/ });
    expect(link).toHaveAttribute('href', buildEventUrlV2(tp.event));
    expect(link).toHaveAttribute('data-track', 'landing_tip_click');
    expect(link).toHaveAttribute('data-track-id', 'tip');
    expect(link).toHaveAttribute('data-track-kind', 'sponsored');
    expect(screen.getByText('Tickets ab 29 €')).toBeInTheDocument();

    expect(imageCalls).toHaveLength(1);
    expect(imageCalls[0]).toMatchObject({ preload: true, loading: 'eager', fetchPriority: 'high' });
  });

  it('auto: kein Label, Ort statt Sponsor, Buchungs-Link auf /fuer-firmen', () => {
    render(<TipOfDay tip={tip('auto')}/>);

    expect(screen.queryByText('Anzeige')).toBeNull();
    expect(screen.getByText(/Gasometer/)).toBeInTheDocument();
    expect(screen.getByText('Zum Event')).toBeInTheDocument();

    const book = screen.getByRole('link', { name: /Tipp des Tages buchen/ });
    expect(book).toHaveAttribute('href', '/fuer-firmen');
    expect(book).toHaveAttribute('data-track', 'landing_tip_book');
    expect(screen.getByRole('link', { name: /Event tip/ })).toHaveAttribute('data-track-kind', 'auto');
  });
});

describe('SeasonCard', () => {
  it('zeigt sechs Picks mit Ellipsis, „Tipp" nur für editorial-Pins', () => {
    const picks = Array.from({ length: 6 }, (_, i) => ({ ...event(`s${i}`), featured: i === 0 }));
    render(<SeasonCard season={{ seasonId: 'herbst', picks }}/>);

    const card = screen.getByTestId('season-card');
    expect(within(card).getAllByTestId('season-pick-title')).toHaveLength(6);
    for (const title of within(card).getAllByTestId('season-pick-title')) {
      expect(title.className).toContain('truncate');
    }
    expect(within(card).getAllByTestId('season-featured')).toHaveLength(1);
    expect(within(card).getByRole('link', { name: /Event s0/ })).toHaveAttribute('data-track', 'landing_season_featured');
    expect(within(card).getByRole('link', { name: /Event s1/ })).toHaveAttribute('data-track', 'landing_season_pick');
    expect(within(card).getByRole('link', { name: /Mehr Herbstfeste/ })).toHaveAttribute('href', '/entdecken?saison=herbst');
  });
});

describe('MapTile', () => {
  const pins = [{ lng: 16.37, lat: 48.21 }, { lng: 13.04, lat: 47.81 }];

  it('mit Token: Static-Bild mit srcset, Attributionszeile mit Links, Knopf nach /map', () => {
    render(<MapTile pins={pins} token="pk.test"/>);

    const img = screen.getByTestId('map-tile-image');
    expect(img.getAttribute('src')).toContain('api.mapbox.com/styles/v1/mapbox/dark-v11/static/');
    expect(img.getAttribute('src')).toContain('pin-s+d4b896(13.04,47.81),pin-s+d4b896(16.37,48.21)');
    expect(img.getAttribute('src')).toContain('attribution=false');
    expect(img.getAttribute('srcset')).toMatch(/@2x\?[^ ]* 2x$/);

    const link = screen.getByRole('link', { name: /Karte öffnen/ });
    expect(link).toHaveAttribute('href', '/map');
    expect(link).toHaveAttribute('data-track', 'landing_map_open');

    const attribution = screen.getByTestId('map-attribution');
    expect(attribution).toHaveTextContent('© Mapbox © OpenStreetMap · Karte verbessern');
    expect(within(attribution).getByRole('link', { name: 'Mapbox' })).toHaveAttribute('href', MAPBOX_ATTRIBUTION_LINKS.mapbox);
    expect(within(attribution).getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute('href', MAPBOX_ATTRIBUTION_LINKS.osm);
    expect(within(attribution).getByRole('link', { name: 'Karte verbessern' })).toHaveAttribute('href', MAPBOX_ATTRIBUTION_LINKS.improve);
  });

  it('ohne Token: kein Bild, keine Attribution, derselbe Knopf', () => {
    render(<MapTile pins={pins} token={null}/>);
    expect(screen.queryByTestId('map-tile-image')).toBeNull();
    expect(screen.queryByTestId('map-attribution')).toBeNull();
    expect(screen.getByRole('link', { name: /Karte öffnen/ })).toHaveAttribute('href', '/map');
    expect(screen.getByText('Heute auf der Karte')).toBeInTheDocument();
  });
});

describe('Masthead', () => {
  it('rendert Datumszeile, H1 und die Suche', () => {
    render(<Masthead today="2026-10-30" countryTotal={88_431}/>);
    expect(screen.getByRole('heading', { level: 1, name: 'Bleib ned daham.' })).toBeInTheDocument();
    expect(screen.getByTestId('date-line-day')).toBeInTheDocument();
    expect(screen.getByTestId('date-line-count')).toHaveTextContent('über 88.000');
    expect(screen.getByRole('search')).toBeInTheDocument();
  });
});

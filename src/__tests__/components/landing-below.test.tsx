/**
 * Unterbau der Tagesausgabe (fn-30.6): Wochenend- und Region-Regal,
 * Festivals + Blog, Freizeit-Regal mit Bildnachweis und Regen-Titel,
 * Newsletter-Zeile mit Versand und Datenschutzhinweis, Zeile „Für
 * Veranstalter", Footer mit Hinweiszeile; de und en tragen dieselben
 * Landing-Schlüssel.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import type { Event } from '@/types/events';
import type { LandingActivity, LandingFestival } from '@/lib/v4/get-landing-data';
import type { LandingPost } from '@/lib/v4/landing-picks';
import de from '../../../messages/de.json';
import en from '../../../messages/en.json';

const { loadTodayWeather } = vi.hoisted(() => ({ loadTodayWeather: vi.fn() }));
vi.mock('@/lib/landing/weekend-weather', () => ({
  RAIN_MM: 3,
  loadTodayWeather: () => loadTodayWeather(),
  loadWeekendWeather: () => Promise.resolve(null),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill: _fill, sizes: _sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

import { RegionShelf, WeekendShelf, rangeHref } from '@/components/Landing/v4/LandingShelves';
import { FestivalsBlog } from '@/components/Landing/v4/FestivalsBlog';
import { ActivitiesShelf, ACTIVITIES_HREF } from '@/components/Landing/v4/ActivitiesShelf';
import { NewsletterRow } from '@/components/Landing/v4/NewsletterRow';
import { OrganizerRow } from '@/components/Landing/v4/OrganizerRow';
import { DevNotice } from '@/components/Landing/v4/DevNotice';
import { Footer } from '@/components/Legal/Footer';

const event = (id: string, extra: Partial<Event> = {}): Event => ({
  id, slug: id, title: `Event ${id}`, start_date: '2026-10-31T18:30:00Z', postal_code: '1010', address: null,
  bundesland: 'wien', location_name: 'Gasometer', country: 'AT', publish_status: 'published',
  image_url: `https://img.test/${id}.jpg`, category: 'konzert', ...extra,
} as Event);

const festival = (n: number, extra: Partial<LandingFestival> = {}): LandingFestival => ({
  id: `f${n}`, slug: `festival-${n}`, canonical_name: `Festival ${n}`, city: `Stadt ${n}`, state: 'wien',
  starts_at: `2027-06-0${n}`, ends_at: `2027-06-0${n + 2}`, image_url: `https://img.test/f${n}.jpg`,
  href: null, acts: n === 1 ? ['Act A', 'Act B', 'Act C'] : [], lineupMatch: false, ...extra,
} as LandingFestival);

const post = (n: number): LandingPost => ({
  slug: `post-${n}`, title: `Beitrag ${n}`, subtitle: '', image: `/images/blog/p${n}.jpg`,
  publishDate: '2026-10-2' + n, category: 'Märkte', readingTime: 5,
});

const activity = (n: number, credit = true): LandingActivity => ({
  id: `a${n}`, slug: `aktivitaet-${n}`, name: `Aktivität ${n}`, tags: ['museum'], town: 'Graz',
  bundesland: 'steiermark', setting: 'indoor', price_hint: null,
  images: [{ urls: [`https://img.test/a${n}.jpg`], copyright: credit ? 'Steiermark Tourismus' : null, author: null, license: null }],
});

describe('WeekendShelf / RegionShelf', () => {
  it('verlinkt das Wochenend-Fenster und benennt den Zeitraum', () => {
    render(<WeekendShelf events={[event('w1'), event('w2')]} range={{ from: '2026-10-30', to: '2026-11-01' }}/>);
    const shelf = screen.getByTestId('weekend-shelf');
    expect(within(shelf).getByRole('heading', { level: 2, name: 'Dieses Wochenende' })).toBeInTheDocument();
    expect(shelf).toHaveTextContent('Fr 30. Okt. bis So 1. Nov.');
    expect(within(shelf).getByRole('link', { name: 'Alle anzeigen' })).toHaveAttribute('href', '/entdecken?von=2026-10-30&bis=2026-11-01');
    expect(within(shelf).getByRole('link', { name: /Event w1/ })).toBeInTheDocument();
    expect(rangeHref({ from: '2026-11-01', to: '2026-11-01' })).toBe('/entdecken?von=2026-11-01&bis=2026-11-01');
  });

  it('entfällt ohne Wochenend-Events', () => {
    const { container } = render(<WeekendShelf events={[]} range={{ from: '2026-10-30', to: '2026-11-01' }}/>);
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt neun Bundesländer als Kacheln auf ihre Hubs', () => {
    render(<RegionShelf/>);
    const shelf = screen.getByTestId('region-shelf');
    const links = within(shelf).getAllByRole('link');
    expect(links).toHaveLength(9);
    expect(within(shelf).getByRole('link', { name: 'Wien' })).toHaveAttribute('href', '/wien');
    expect(within(shelf).getByRole('link', { name: 'Niederösterreich' })).toHaveAttribute('href', '/niederoesterreich');
    expect(within(shelf).getByRole('link', { name: 'Wien' }).querySelector('img')).toHaveAttribute('src', '/images/regions/wien.jpg');
  });
});

describe('FestivalsBlog', () => {
  it('zeigt je vier Einträge mit Bild, Zeitraum, Ort, Acts bzw. Kategorie und Datum', () => {
    const festivals = [1, 2, 3, 4].map(n => festival(n));
    const posts = [1, 2, 3, 4].map(post);
    render(<FestivalsBlog festivals={festivals} posts={posts}/>);

    const fest = screen.getByTestId('festivals-column');
    const festLinks = within(fest).getAllByRole('link').filter(l => l.getAttribute('data-track') === 'landing_festival_click');
    expect(festLinks).toHaveLength(4);
    expect(festLinks[0]).toHaveAttribute('href', '/festivals/festival-1');
    expect(festLinks[0]).toHaveTextContent('Festival 1');
    expect(festLinks[0]).toHaveTextContent('Di 1. Juni bis Do 3. Juni · Stadt 1');
    expect(festLinks[0]).toHaveTextContent('Act A, Act B, Act C');
    expect(festLinks[0].querySelector('img')).toHaveAttribute('src', 'https://img.test/f1.jpg');
    expect(screen.getByTestId('festivals-all')).toHaveAttribute('href', '/festivals');

    const blog = screen.getByTestId('blog-column');
    const postLinks = within(blog).getAllByRole('link').filter(l => l.getAttribute('data-track') === 'landing_post_click');
    expect(postLinks).toHaveLength(4);
    expect(postLinks[0]).toHaveAttribute('href', '/blog/post-1');
    expect(postLinks[0]).toHaveTextContent('Beitrag 1');
    expect(postLinks[0]).toHaveTextContent('Märkte · 21. Okt. 2026');
    expect(postLinks[0].querySelector('img')).toHaveAttribute('src', '/images/blog/p1.jpg');
    expect(screen.getByTestId('blog-all')).toHaveAttribute('href', '/blog');
  });

  it('eintägiges Festival ohne Ende: nur ein Tag; ohne Festivals bleibt die Blog-Spalte', () => {
    render(<FestivalsBlog festivals={[festival(5, { ends_at: null, acts: [] })]} posts={[post(1)]}/>);
    expect(screen.getByTestId('festivals-column')).toHaveTextContent('Sa 5. Juni · Stadt 5');
    expect(screen.getByTestId('blog-column')).toBeInTheDocument();
  });

  it('entfällt ohne Inhalte', () => {
    const { container } = render(<FestivalsBlog festivals={[]} posts={[]}/>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ActivitiesShelf', () => {
  beforeEach(() => { loadTodayWeather.mockReset(); });

  it('zeigt Fotos mit Bildnachweis, Kategorie-Badge und Ort; Titel ohne Regen „Ausflug unter Dach"', async () => {
    loadTodayWeather.mockResolvedValue({ day: '2026-10-30', tempMax: 12, precipMm: 1 });
    const acts = [1, 2, 3].map(n => activity(n));
    render(<ActivitiesShelf activities={acts}/>);

    const shelf = screen.getByTestId('activities-shelf');
    const cards = within(shelf).getAllByRole('link').filter(l => l.getAttribute('data-track') === 'landing_activity_click');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute('href', '/aktivitaet/aktivitaet-1');
    expect(cards[0]).toHaveTextContent('Bild: Steiermark Tourismus');
    expect(cards[0]).toHaveTextContent('Museum');
    expect(cards[0]).toHaveTextContent('Graz · Steiermark');
    expect(cards[0].querySelector('img')).toHaveAttribute('src', 'https://img.test/a1.jpg');
    expect(within(shelf).getByRole('link', { name: 'Alle Freizeitaktivitäten' })).toHaveAttribute('href', ACTIVITIES_HREF);

    await act(async () => { await Promise.resolve(); });
    expect(within(shelf).getByRole('heading', { level: 2 })).toHaveTextContent('Ausflug unter Dach');
  });

  it('wechselt den Titel ab 3 mm Regen auf „Bei Regen"', async () => {
    loadTodayWeather.mockResolvedValue({ day: '2026-10-30', tempMax: 9, precipMm: 4 });
    render(<ActivitiesShelf activities={[activity(1)]}/>);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Bei Regen');
    });
  });

  it('entfällt ohne Aktivitäten', () => {
    loadTodayWeather.mockResolvedValue(null);
    const { container } = render(<ActivitiesShelf activities={[]}/>);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('NewsletterRow', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('sendet E-Mail und Region an /api/newsletter/subscribe und zeigt den Datenschutzhinweis', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, message: 'Bitte bestätigen.' }) });
    render(<NewsletterRow/>);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Die besten Events deiner Region, einmal pro Woche');
    expect(screen.getByTestId('newsletter-privacy')).toHaveTextContent('Double-Opt-in');
    expect(within(screen.getByTestId('newsletter-privacy')).getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz');

    const button = screen.getByRole('button', { name: 'Anmelden' });
    expect(button).toHaveAttribute('data-track', 'newsletter_subscribe');
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('deine@email.at'), { target: { value: 'test@example.at' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Region wählen' }), { target: { value: 'steiermark' } });
    expect(button).toBeEnabled();
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Bitte bestätigen.'));
    expect(fetchMock).toHaveBeenCalledWith('/api/newsletter/subscribe', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.at', region: 'steiermark' }),
    }));
    expect(screen.queryByRole('button', { name: 'Anmelden' })).toBeNull();
    expect(screen.getByTestId('newsletter-privacy')).toBeInTheDocument();
  });

  it('meldet einen Fehler der API unter dem Formular', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Ungültige Adresse' }) });
    render(<NewsletterRow/>);
    fireEvent.change(screen.getByPlaceholderText('deine@email.at'), { target: { value: 'x@example.at' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
    await waitFor(() => expect(screen.getByText('Ungültige Adresse')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
  });
});

describe('OrganizerRow', () => {
  it('führt zu Inserat und Boost mit data-track-Markern', () => {
    render(<OrganizerRow/>);
    const row = screen.getByTestId('organizer-row');
    expect(within(row).getByRole('heading', { level: 2 })).toHaveTextContent('Du veranstaltest selbst?');
    const submit = within(row).getByRole('link', { name: 'Event kostenlos eintragen' });
    expect(submit).toHaveAttribute('href', '/event-inserieren');
    expect(submit).toHaveAttribute('data-track', 'landing_organizer_submit');
    const boost = within(row).getByRole('link', { name: 'Tipp des Tages buchen' });
    expect(boost).toHaveAttribute('href', '/fuer-firmen');
    expect(boost).toHaveAttribute('data-track', 'landing_organizer_boost');
    // Handy: Knöpfe untereinander, ab sm nebeneinander.
    expect(submit.parentElement?.className).toContain('flex-col');
    expect(submit.parentElement?.className).toContain('sm:flex-row');
  });
});

describe('Footer mit Hinweiszeile', () => {
  it('zeigt den Entwicklungs-Hinweis ohne Gedankenstrich mit Mail-Link', () => {
    render(<Footer notice={<DevNotice/>}/>);
    const notice = screen.getByTestId('footer-notice');
    expect(notice).toHaveTextContent('Die Seite ist in Entwicklung, technische Fehler sind möglich. Feedback bitte an dev@glatzdev.com.');
    expect(notice.textContent).not.toContain('—');
    expect(within(notice).getByRole('link', { name: 'dev@glatzdev.com' })).toHaveAttribute('href', 'mailto:dev@glatzdev.com');
    expect(screen.getByText('Event inserieren')).toBeInTheDocument();
    expect(screen.getByText('Für Firmen')).toBeInTheDocument();
  });

  it('ohne Prop keine Hinweiszeile', () => {
    render(<Footer/>);
    expect(screen.queryByTestId('footer-notice')).toBeNull();
  });
});

describe('i18n der Startseite', () => {
  const keys = (obj: unknown, prefix = ''): string[] => {
    if (obj == null || typeof obj !== 'object') return [prefix];
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  };

  it('de und en haben dieselben Landing-Schlüssel, die alten Namespaces sind weg', () => {
    expect(keys(de.Landing).sort()).toEqual(keys(en.Landing).sort());
    const groups = Object.keys(de.Landing);
    for (const dead of ['Hero', 'ArtistTeaser', 'Weekend', 'Concerts', 'Festivals', 'MapPreview', 'HowItWorks', 'RegionHubs', 'Matches', 'AnonTeaser', 'Weather']) {
      expect(groups).not.toContain(dead);
    }
    expect((de as Record<string, unknown>).Onboarding).toBeUndefined();
    expect((en as Record<string, unknown>).Onboarding).toBeUndefined();
  });

  it('neue Texte ohne Gedankenstrich', () => {
    const texts = (obj: unknown): string[] =>
      obj == null || typeof obj !== 'object' ? [String(obj)] : Object.values(obj as Record<string, unknown>).flatMap(texts);
    for (const ns of ['devNotice', 'Program', 'Shelves', 'FestivalsBlog', 'Activities', 'Newsletter', 'Organizer'] as const) {
      for (const text of [...texts(de.Landing[ns]), ...texts(en.Landing[ns])]) {
        expect(text).not.toMatch(/[—–]/);
      }
    }
  });
});

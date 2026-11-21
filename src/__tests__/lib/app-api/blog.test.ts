import { describe, expect, it } from 'vitest';
import { ALL_POSTS } from '@/content/blog';
import type { FestivalPost } from '@/content/blog/types';
import { APP_BLOG_TABS, toAppBlogList, toAppBlogPost, type AppBlogBlock, type AppBlogContext } from '@/lib/app-api/blog';

const ctx: AppBlogContext = { locale: 'de', origin: 'https://example.test' };
const TODAY = '2026-11-05';

function post(over: Partial<FestivalPost> = {}): FestivalPost {
  return {
    slug: 'nova-rock-2027',
    title: 'Nova Rock 2027',
    subtitle: 'Vier Tage Rock im Burgenland',
    heroImage: '/images/blog/nova.jpg',
    heroImageCredit: 'Foto: Eventim',
    heroLayout: 'poster',
    ticketUrl: 'https://www.oeticket.com/nova?affiliate=J70',
    publishDate: '2026-11-01',
    updatedDate: '2026-11-02',
    readingTime: 6,
    excerpt: 'Alles zum Festival.',
    category: 'Musik & Festival',
    categoryColor: '',
    keyFacts: {
      dates: '10. bis 13. Juni 2027',
      location: 'Nickelsdorf',
      address: 'Pannonia Fields, 2425 Nickelsdorf, Burgenland',
      genre: 'Rock',
      price: 'ab 249 €',
      website: 'https://novarock.example',
      since: '2005',
    },
    lineup: [
      { name: 'Hauptact', role: 'headliner', day: 'Freitag' },
      { name: 'Vorband', role: 'support' },
    ],
    lineupNote: 'Stand November',
    intro: 'Das **größte** Rockfestival des Landes.',
    historyTitle: 'Die Geschichte',
    history: 'Erster Absatz.\n## Zwischentitel\nZweiter **fetter** Absatz.',
    whatToExpectTitle: 'Was dich erwartet',
    whatToExpect: 'Viel Musik.',
    whatToExpectList: ['Vier Bühnen', 'Camping'],
    funFacts: ['2005 gegründet.'],
    practicalInfoTitle: 'Praktisches',
    practicalInfo: [{ icon: 'car', label: 'Anreise', text: 'Mit dem Shuttle ab Wien.' }],
    gallery: [{ src: '/images/blog/g1.jpg', alt: 'Bühne', caption: 'Die Hauptbühne' }],
    ctaText: 'Alle Festivals',
    ctaLink: '/festivals',
    seoTitle: '',
    seoDescription: '',
    keywords: ['nova rock'],
    jsonLdEvent: {
      name: 'Nova Rock',
      startDate: '2027-06-10',
      endDate: '2027-06-13',
      location: 'Pannonia Fields, 2425 Nickelsdorf',
      addressCountry: 'AT',
      url: '',
      description: '',
      image: '',
    },
    faqs: [{ question: 'Gibt es Tagestickets?', answer: 'Ja.' }],
    ...over,
  };
}

const build = (over: Partial<FestivalPost> = {}) =>
  toAppBlogPost({ post: post(over), ticketEvents: [], relatedEvents: [], today: TODAY }, ctx);

const kinds = (blocks: AppBlogBlock[]) => blocks.map(b => (b.type === 'heading' ? `h:${b.text}` : b.type));
const find = <T extends AppBlogBlock['type']>(blocks: AppBlogBlock[], type: T) =>
  blocks.find((b): b is Extract<AppBlogBlock, { type: T }> => b.type === type);

describe('toAppBlogList', () => {
  it('liefert jeden Beitrag als Karte mit Bild und Datum', () => {
    const list = toAppBlogList([post()], ctx);
    expect(list.posts[0]).toMatchObject({
      slug: 'nova-rock-2027',
      image: 'https://example.test/images/blog/nova.jpg',
      meta: 'Musik & Festival · 1. Nov. 2026',
      readingTime: 6,
    });
  });

  it('zeigt nur Reiter, zu denen es Beiträge gibt', () => {
    expect(toAppBlogList([post()], ctx).tabs.map(t => t.label)).toEqual(['Alle', 'Musik']);
  });

  it('kommt mit allen echten Beiträgen zurecht', () => {
    const list = toAppBlogList(ALL_POSTS, ctx);
    expect(list.posts).toHaveLength(ALL_POSTS.length);
    expect(list.posts.every(p => p.image.startsWith('http') && p.title.length > 0)).toBe(true);
    expect(list.tabs.length).toBeLessThanOrEqual(APP_BLOG_TABS.length);
  });
});

describe('toAppBlogPost', () => {
  it('setzt die Blöcke in der Reihenfolge der Detailseite', () => {
    expect(kinds(build().blocks)).toEqual([
      'paragraph',
      'facts',
      'h:Die Geschichte',
      'paragraph',
      'h:Zwischentitel',
      'paragraph',
      'h:Fun Facts',
      'list',
      'h:Lineup Nova Rock 2027',
      'lineup',
      'image',
      'h:Was dich erwartet',
      'paragraph',
      'list',
      'h:Praktisches',
      'info',
      'stay',
      'h:Häufige Fragen',
      'faq',
      'cta',
    ]);
  });

  it('trägt Kopf, Bildnachweis und Poster-Layout', () => {
    expect(build()).toMatchObject({
      url: 'https://example.test/blog/nova-rock-2027',
      readingLabel: '6 Min. Lesezeit',
      meta: '10. bis 13. Juni 2027 · Nickelsdorf',
      imageCredit: 'Foto: Eventim',
      poster: true,
    });
  });

  it('zerlegt Fettdruck in Läufe und markiert die Einleitung', () => {
    const [intro] = build().blocks;
    expect(intro).toEqual({
      type: 'paragraph',
      lead: true,
      runs: [
        { text: 'Das ', bold: false },
        { text: 'größte', bold: true },
        { text: ' Rockfestival des Landes.', bold: false },
      ],
    });
  });

  it('baut die Eckdaten mit Ticketlink und Website', () => {
    const facts = find(build().blocks, 'facts')!;
    expect(facts.rows.map(r => r.label)).toEqual(['Datum', 'Ort', 'Genre', 'Eintritt', 'Festival seit']);
    expect(facts.ticket).toMatchObject({ label: 'Tickets sichern', note: 'Anzeige · Ticketkauf über Eventim' });
    expect(facts.website?.url).toBe('https://novarock.example');
    expect(find(build({ ticketUrl: undefined }).blocks, 'facts')!.ticket).toBeNull();
  });

  it('gruppiert das Lineup und benennt es bei eigenem Titel um', () => {
    expect(find(build().blocks, 'lineup')!.groups).toEqual([
      { label: 'Headliner', acts: [{ name: 'Hauptact', day: 'Freitag' }] },
      { label: 'Weitere Acts', acts: [{ name: 'Vorband', day: null }] },
    ]);
    const custom = build({ lineupTitle: 'Programm-Highlights' });
    expect(kinds(custom.blocks)).toContain('h:Programm-Highlights');
    expect(find(custom.blocks, 'lineup')!.groups.map(g => g.label)).toEqual(['Highlights', 'Weiteres Programm']);
  });

  it('verlinkt die Hotelsuche mit Stadt und kommendem Termin', () => {
    const stay = find(build().blocks, 'stay')!;
    expect(stay.title).toBe('Übernachten in Nickelsdorf');
    expect(stay.hint).toBe('Stadt und Datum sind im Link schon vorausgefüllt.');
    expect(decodeURIComponent(stay.url)).toContain('checkin=2027-06-10');
    const past = find(build({ jsonLdEvent: { ...post().jsonLdEvent!, startDate: '2026-06-10' } }).blocks, 'stay')!;
    expect(decodeURIComponent(past.url)).not.toContain('checkin=');
  });

  it('zeigt kuratierte Unterkünfte statt der allgemeinen Hotelsuche', () => {
    const blocks = build({
      stays: [{ name: 'Therme & Lodge', place: 'Frauenkirchen', region: 'Burgenland', description: 'Am See.', kind: 'Therme' }],
    }).blocks;
    expect(find(blocks, 'stay')).toBeUndefined();
    const stays = find(blocks, 'stays')!;
    expect(stays.items[0]).toMatchObject({ name: 'Therme & Lodge', place: 'Frauenkirchen · Burgenland' });
    expect(stays.items[0].url).toContain('stay-article-nova-rock-2027');
  });

  it('nimmt Ticket-Termine und passende Events auf, wenn es welche gibt', () => {
    const body = toAppBlogPost(
      {
        post: post(),
        today: TODAY,
        ticketEvents: [
          {
            id: 'e1', slug: 'nova', title: 'Nova Rock Tagesticket', start_date: '2027-06-10T12:00:00+00:00',
            location_name: 'Pannonia Fields', postal_code: '2425', address: null, bundesland: 'burgenland',
            price_min: 99, price_text: null, ticket_url: 'https://www.oeticket.com/e1?affiliate=J70',
          },
        ],
        relatedEvents: [
          {
            id: 'e2', slug: 'x', title: 'Rock am See', start_date: '2027-06-20T18:00:00+00:00', location_name: 'Seebühne',
            postal_code: null, address: null, bundesland: 'burgenland', category: 'Musik', source_name: null,
            ticket_url: null, price_min: null, price_text: 'Eintritt frei', quality_score: 70,
          },
        ],
      },
      ctx,
    );
    const tickets = find(body.blocks, 'tickets')!;
    expect(tickets.badge).toBe('Anzeige');
    expect(tickets.items[0]).toMatchObject({ eventId: 'e1', title: 'Nova Rock Tagesticket', price: 'ab 99,00 €' });
    const events = find(body.blocks, 'events')!;
    expect(events.items[0]).toMatchObject({ id: 'e2', tickets: false, price: 'Eintritt frei' });
  });

  it('baut jeden echten Beitrag ohne Fehler und mit Abschluss-Block', () => {
    for (const real of ALL_POSTS) {
      const body = toAppBlogPost({ post: real, ticketEvents: [], relatedEvents: [], today: TODAY }, ctx);
      expect(body.blocks.at(-1)?.type).toBe('cta');
      expect(body.blocks.some(b => b.type === 'facts')).toBe(true);
    }
  });
});

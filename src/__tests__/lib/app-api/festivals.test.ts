import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import {
  toAppFestivalDetail,
  toAppFestivalList,
  toAppFestivalPlanDraft,
  type AppFestivalsContext,
} from '@/lib/app-api/festivals';
import type { AppTranslate } from '@/lib/app-api/landing';
import type { FestivalEnrichment } from '@/lib/festivals/enrich';
import type { FestivalDetailData, ParentEventRow, UpcomingFestival } from '@/lib/festivals/display';
import type { Festival, FestivalArtist } from '@/types/festivals';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppFestivalsContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
};

const NOW = new Date('2026-11-05T10:00:00Z');

function festival(over: Partial<Festival> = {}): Festival {
  return {
    id: 'f1',
    canonical_name: 'Nova Rock',
    slug: 'nova-rock',
    website_url: 'https://novarock.example',
    lineup_url: null,
    city: 'Nickelsdorf',
    state: 'Burgenland',
    starts_at: '2027-06-10',
    ends_at: '2027-06-13',
    genres: 'P, E',
    registry_source: null,
    spotify_priority: null,
    direct_lineup_candidate: false,
    lineup_fetch_mode: null,
    lineup_status: 'unknown',
    lineup_hash: null,
    lineup_last_checked_at: null,
    parent_event_id: null,
    ticket_url: 'https://www.oeticket.com/nova-rock?affiliate=J70',
    price_text: 'Festivalpass ab 249 €',
    description: 'Vier Tage Rock auf den Pannonia Fields.',
    image_url: 'https://img.example/nova.jpg',
    date_status: 'confirmed',
    seed_updated_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  } as Festival;
}

function act(name: string, billing: string | null, day: string | null = null): FestivalArtist {
  return { id: name, festival_id: 'f1', artist_name_raw: name, artist_name_normalized: name.toLowerCase(), billing, day_label: day } as FestivalArtist;
}

const noEnrichment: FestivalEnrichment = {
  imageUrl: null,
  description: null,
  artists: [],
  priceText: null,
  fetchedFromUrl: null,
  fetchedAt: '2026-11-05T00:00:00Z',
};

function data(over: Partial<FestivalDetailData> = {}): FestivalDetailData {
  return { festival: festival(), parentEvent: null, artists: [], enrichment: noEnrichment, ...over };
}

describe('toAppFestivalList', () => {
  const upcoming = (over: Partial<UpcomingFestival> = {}): UpcomingFestival => ({
    ...festival(),
    image_url: '/images/categories/musik-3.jpg',
    href: '/festivals/nova-rock',
    ...over,
  });

  it('beschriftet Karte und Kopf wie die Website', () => {
    const list = toAppFestivalList([upcoming()], ctx);
    expect(list).toMatchObject({ title: 'Festivals', sub: '1 kommende Festivals in Österreich.' });
    expect(list.festivals[0]).toMatchObject({
      slug: 'nova-rock',
      name: 'Nova Rock',
      image: 'https://example.test/images/categories/musik-3.jpg',
      meta: '10. bis 13. Jun · Nickelsdorf',
      price: 'Festivalpass ab 249 €',
    });
  });

  it('kennzeichnet erwartete Termine und nennt die leere Liste', () => {
    const [card] = toAppFestivalList([upcoming({ date_status: 'expected', city: null })], ctx).festivals;
    expect(card.meta).toBe('vorauss. 10. bis 13. Jun');
    expect(toAppFestivalList([], ctx).sub).toBe('Aktuell sind keine kommenden Festivals in unserer Datenbank.');
  });
});

describe('toAppFestivalDetail', () => {
  it('baut Info-Zeilen, Ticket und Adresse zum Teilen', () => {
    const detail = toAppFestivalDetail(data(), ctx);
    expect(detail).toMatchObject({
      name: 'Nova Rock',
      image: 'https://img.example/nova.jpg',
      url: 'https://example.test/festivals/nova-rock',
      dateLabel: '10. Juni bis 13. Juni 2027',
      place: 'Nickelsdorf · Burgenland',
      description: 'Vier Tage Rock auf den Pannonia Fields.',
      eventId: null,
    });
    expect(detail.info).toEqual([
      { label: 'Termin', value: '10. Juni bis 13. Juni 2027' },
      { label: 'Ort', value: 'Nickelsdorf · Burgenland' },
      { label: 'Genre', value: 'Pop/Rock · Elektronik' },
      { label: 'Preis', value: 'Festivalpass ab 249 €' },
    ]);
    expect(detail.ticket).toEqual({
      url: 'https://www.oeticket.com/nova-rock?affiliate=J70',
      label: 'Tickets · ab 249 €',
      provider: 'eventim',
    });
    expect(detail.mapsUrl).toContain(encodeURIComponent('Nickelsdorf, Burgenland'));
  });

  it('ordnet das Line-up nach Rolle, Headliner zuerst', () => {
    const detail = toAppFestivalDetail(
      data({ artists: [act('Vorband', 'opener'), act('Hauptact', 'headliner', 'Freitag'), act('Ohne Rolle', null)] }),
      ctx,
    );
    expect(detail.lineup.groups.map(g => g.label)).toEqual(['Headliner', 'Opener', 'Line-up']);
    expect(detail.lineup.groups[0].artists).toEqual([{ name: 'Hauptact', day: 'Freitag' }]);
    expect(detail.lineup.note).toBeNull();
    expect(detail.info.find(i => i.label === 'Acts')?.value).toBe('3');
  });

  it('zeigt ohne Line-up den Auszug der Festival-Seite mit Hinweis', () => {
    const detail = toAppFestivalDetail(
      data({ enrichment: { ...noEnrichment, artists: Array.from({ length: 90 }, (_, i) => `Act ${i}`) } }),
      ctx,
    );
    expect(detail.lineup.groups).toEqual([]);
    expect(detail.lineup.excerpt).toHaveLength(80);
    expect(detail.lineup.note).toMatch(/^Auszug von der Festival-Seite/);
    expect(detail.info.find(i => i.label === 'Acts')?.value).toBe('~90');
  });

  it('sagt es, wenn kein Line-up bekannt ist, und nimmt Bild und Event vom Haupt-Event', () => {
    const parentEvent: ParentEventRow = {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      slug: 'nova-rock-2027',
      start_date: '2027-06-10T12:00:00+00:00',
      postal_code: '2425',
      address: 'Pannonia Fields',
      bundesland: 'burgenland',
      location_name: 'Pannonia Fields',
      image_url: 'https://img.example/event.jpg',
    };
    const detail = toAppFestivalDetail(data({ parentEvent, festival: festival({ ticket_url: null, date_status: 'expected' }) }), ctx);
    expect(detail.lineup.note).toMatch(/^Das Line-up wurde noch nicht eingelesen/);
    expect(detail.image).toBe('https://img.example/event.jpg');
    expect(detail.eventId).toBe(parentEvent.id);
    expect(detail.ticket).toBeNull();
    expect(detail.dateLabel).toBe('voraussichtlich 10. Juni bis 13. Juni 2027');
  });

  it('enthält keine Gedankenstriche in den Hinweisen', () => {
    const texts = [
      toAppFestivalDetail(data(), ctx).dateLabel,
      toAppFestivalDetail(data(), ctx).lineup.note,
      toAppFestivalDetail(data({ enrichment: { ...noEnrichment, artists: ['A'] } }), ctx).lineup.note,
    ];
    expect(texts.join(' ')).not.toMatch(/[–—]/);
  });
});

describe('toAppFestivalPlanDraft', () => {
  it('belegt Name, Tag und Stadt vor, ohne Event', () => {
    const draft = toAppFestivalPlanDraft(data(), ctx, NOW);
    expect(draft.event).toBeNull();
    expect(draft.state).toMatchObject({
      name: 'Nova Rock in Nickelsdorf',
      plan_date: '2027-06-10',
      event_ids: [],
      accommodation_city: 'Nickelsdorf',
    });
    expect(draft.dateLabel).toBe('Donnerstag, 10. Juni 2027');
    expect(draft.destination).toBe('Nickelsdorf, Burgenland');
    expect(draft.ticket?.provider).toBe('eventim');
    expect(new URL(draft.oebbUrl!).searchParams.get('date')).toBe('10.06.2027');
  });

  it('nimmt ohne Termin den heutigen Wiener Tag', () => {
    const draft = toAppFestivalPlanDraft(data({ festival: festival({ starts_at: null, city: null, state: null }) }), ctx, NOW);
    expect(draft.state.plan_date).toBe('2026-11-05');
    expect(draft.state.name).toBe('Nova Rock');
    expect(draft.oebbUrl).toBeNull();
  });
});

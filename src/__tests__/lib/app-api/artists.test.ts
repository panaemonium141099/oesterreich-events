import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import { toAppArtist, toAppArtistDetail, toAppArtistsDirectory, type AppArtistsContext } from '@/lib/app-api/artists';
import type { AppTranslate } from '@/lib/app-api/landing';
import type { DirectoryArtist, DirectoryEvent } from '@/lib/artists/directory';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppArtistsContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
};

const TODAY = '2026-11-05';

function event(id: string, over: Partial<DirectoryEvent> = {}): DirectoryEvent {
  return {
    id,
    slug: `event-${id}`,
    title: 'Alex Kristan - Born to be Child',
    start_date: '2026-11-07T19:00:00+00:00', // Samstag, 20:00 Wien
    postal_code: '8020',
    address: null,
    bundesland: 'steiermark',
    location_name: 'Orpheum',
    city: 'Graz',
    ticket_url: `https://www.oeticket.com/event/${id}?affiliate=J70`,
    ...over,
  };
}

function artist(name: string, over: Partial<DirectoryArtist> = {}): DirectoryArtist {
  return {
    id: `id-${name}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    image: `https://img.example/${name}.jpg`,
    evoLink: 'https://www.oeticket.com/artist/x/?affiliate=J70',
    kind: 'kabarett',
    genre: 'kabarett',
    events: [event(`e-${name}`)],
    ...over,
  };
}

describe('toAppArtist', () => {
  it('trägt Schlüssel, Spielart, Buchstabe und den nächsten Termin', () => {
    const a = toAppArtist(artist('Alex Kristán'), ctx);
    expect(a).toMatchObject({
      name: 'Alex Kristán',
      key: 'alex kristan',
      genreLabel: 'Kabarett',
      letter: 'A',
      dates: 1,
      next: { day: '2026-11-07', dayShort: 'Sa 7. Nov.', place: 'Graz' },
    });
  });

  it('kommt ohne Termin aus', () => {
    expect(toAppArtist(artist('Niemand', { events: [] }), ctx)).toMatchObject({ dates: 0, next: null });
  });

  it('ordnet Ziffern und Artikel im Verzeichnis ein', () => {
    expect(toAppArtist(artist('5/8erl in Ehr’n'), ctx).letter).toBe('#');
    expect(toAppArtist(artist('Die Seer'), ctx).letter).toBe('S');
  });
});

describe('toAppArtistsDirectory', () => {
  const many = ['Anna', 'Bernd', 'Clara', 'David', 'Emil'].map((n, i) =>
    artist(n, { events: [event(`e-${n}`, { start_date: `2026-11-0${6 + (i % 3)}T19:00:00+00:00` })] }),
  );

  it('sortiert von A bis Z und nennt die Zahl im Untertitel', () => {
    const directory = toAppArtistsDirectory([...many].reverse(), TODAY, ctx);
    expect(directory.artists.map(a => a.name)).toEqual(['Anna', 'Bernd', 'Clara', 'David', 'Emil']);
    expect(directory.sub).toBe('5 Künstler mit Terminen in Österreich in den nächsten drei Monaten');
    expect(directory.today).toBe(TODAY);
  });

  it('baut Regale mit Titel, Untertitel und IDs aus der Liste', () => {
    const directory = toAppArtistsDirectory(many, TODAY, ctx);
    const week = directory.shelves.find(s => s.key === 'week');
    expect(week).toMatchObject({ title: 'Diese Woche live', sub: 'nach nächstem Termin' });
    const ids = new Set(directory.artists.map(a => a.id));
    for (const shelf of directory.shelves) {
      expect(shelf.ids.length).toBeGreaterThanOrEqual(4);
      for (const id of shelf.ids) expect(ids.has(id)).toBe(true);
    }
    expect(directory.shelves.find(s => s.key === 'kabarett')?.title).toBe('Kabarett');
  });

  it('zeigt ein leeres Verzeichnis ohne Regale', () => {
    expect(toAppArtistsDirectory([], TODAY, ctx)).toMatchObject({
      sub: 'Das Verzeichnis wird gerade aufgebaut.',
      shelves: [],
      artists: [],
    });
  });
});

describe('toAppArtistDetail', () => {
  const kristan = artist('Alex Kristan', {
    slug: 'alex-kristan',
    events: [
      event('e1'),
      event('e2', { start_date: '2026-11-20T18:30:00+00:00', title: 'Alex Kristan', location_name: 'Stadtsaal', city: 'Wien', ticket_url: null }),
    ],
  });
  const others = ['Bernd', 'Clara'].map(n => artist(n));

  it('liefert Termine mit Programmtitel, Uhrzeit, Saal und Ticketlink', () => {
    const detail = toAppArtistDetail([kristan, ...others], 'alex-kristan', ctx)!;
    expect(detail.summary).toBe('Kabarett, 2 Termine in Österreich');
    expect(detail.url).toBe('https://example.test/kuenstler/alex-kristan');
    expect(detail.events[0]).toMatchObject({
      id: 'e1',
      dayShort: 'Sa 7. Nov.',
      title: 'Born to be Child',
      sub: '20:00, Orpheum, Graz',
      ticketUrl: 'https://www.oeticket.com/event/e1?affiliate=J70',
    });
  });

  it('zeigt ohne Programmtitel Saal und Ort und fällt auf den Künstlerlink zurück', () => {
    const detail = toAppArtistDetail([kristan, ...others], 'alex-kristan', ctx)!;
    expect(detail.events[1]).toMatchObject({
      title: 'Stadtsaal, Wien',
      sub: '19:30, Wien',
      ticketUrl: 'https://www.oeticket.com/artist/x/?affiliate=J70',
    });
  });

  it('nennt verwandte Künstler derselben Spielart, nie den Künstler selbst', () => {
    const detail = toAppArtistDetail([kristan, ...others], 'alex-kristan', ctx)!;
    expect(detail.related.map(a => a.name)).toEqual(['Bernd', 'Clara']);
  });

  it('kennt unbekannte Slugs nicht', () => {
    expect(toAppArtistDetail([kristan], 'gibt-es-nicht', ctx)).toBeNull();
  });

  it('nennt einen einzelnen Termin in der Einzahl', () => {
    const one = toAppArtistDetail([artist('Solo', { slug: 'solo' })], 'solo', ctx)!;
    expect(one.summary).toBe('Kabarett, 1 Termin in Österreich');
  });
});

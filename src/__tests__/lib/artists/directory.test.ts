/**
 * Künstlerverzeichnis der Plakatwand (directory.ts): sichtbare Termine,
 * Primary-Nachlauf, Häuser und Reihen draußen, Spielart aus Tags, Regale,
 * Verzeichnis und Suche.
 */
import { describe, it, expect } from 'vitest';
import {
  alphabetical,
  buildDirectory,
  isHouseOrSeries,
  kindOf,
  letterOf,
  liveThisWeek,
  onTour,
  planArtistShelves,
  programTitle,
  relatedArtists,
  searchDirectory,
  unresolvedPrimaryIds,
  type DirectoryArtist,
  type DirectoryEventRow,
  type DirectoryRow,
} from '@/lib/artists/directory';

const ev = (id: string, start: string, extra: Partial<DirectoryEventRow> = {}): DirectoryEventRow => ({
  id,
  slug: id,
  title: id,
  start_date: start,
  postal_code: '1010',
  address: null,
  bundesland: 'wien',
  location_name: 'Gasometer',
  publish_status: 'published',
  duplicate_of: null,
  category: 'Musik',
  tags: ['rock'],
  ...extra,
});

const row = (artistId: string, name: string, event: DirectoryEventRow | null, image: string | null = 'https://img/a.jpg'): DirectoryRow => ({
  artist_id: artistId,
  artist_name: name,
  artist_image: image,
  evo_link: `https://www.oeticket.com/noapp/artist/${artistId}/?affiliate=J70`,
  event,
});

const TODAY = '2026-11-02';

describe('buildDirectory', () => {
  it('sammelt je Künstler die sichtbaren Termine, Datum sortiert, Künstler nach nächstem Termin', () => {
    const rows = [
      row('a', 'Placebo', ev('e2', '2026-11-10T19:00:00Z')),
      row('b', 'Alex Kristan', ev('e1', '2026-11-03T18:30:00Z', { tags: ['kabarett'], category: 'Kultur & Bühne', location_name: 'Stadtsaal' })),
      row('a', 'Placebo', ev('e3', '2026-11-20T19:00:00Z', { location_name: 'Arena', postal_code: '1030' })),
      row('a', 'Placebo', ev('e3', '2026-11-20T19:00:00Z', { location_name: 'Arena', postal_code: '1030' })),
    ];
    const out = buildDirectory(rows, new Map(), { cityOf: plz => (plz === '1010' || plz === '1030' ? 'Wien' : null) });
    expect(out.map(a => a.name)).toEqual(['Alex Kristan', 'Placebo']);
    const placebo = out[1];
    expect(placebo.events.map(e => e.id)).toEqual(['e2', 'e3']);
    expect(placebo.events[0].city).toBe('Wien');
    expect(placebo.kind).toBe('konzert');
    expect(placebo.genre).toBe('rock');
    expect(placebo.evoLink).toContain('affiliate=J70');
    expect(out[0].kind).toBe('kabarett');
  });

  it('unterdrückte Zeilen zeigen den sichtbaren Primary, ohne Primary fallen sie weg', () => {
    const rows = [
      row('a', 'Korn', ev('dup', '2026-11-19T19:00:00Z', { publish_status: 'suppressed', duplicate_of: 'prim' })),
      row('b', 'Jungle', ev('dup2', '2026-11-13T19:00:00Z', { publish_status: 'suppressed', duplicate_of: 'missing' })),
      row('c', 'Mine', ev('hidden', '2026-11-09T19:00:00Z', { publish_status: 'needs_review', duplicate_of: null })),
    ];
    expect(unresolvedPrimaryIds(rows)).toEqual(['prim', 'missing']);
    const primaries = new Map([['prim', ev('prim', '2026-11-19T19:00:00Z', { title: 'Korn live' })]]);
    const out = buildDirectory(rows, primaries);
    expect(out.map(a => a.name)).toEqual(['Korn']);
    expect(out[0].events[0].id).toBe('prim');
  });

  it('nimmt Bild und Link aus der ersten Zeile, die sie hat; Zeilen ohne Event oder Name fallen weg', () => {
    const rows = [
      row('a', 'OSKA', ev('e1', '2026-11-04T18:30:00Z'), null),
      row('a', 'OSKA', ev('e2', '2026-11-05T18:30:00Z'), 'https://img/oska.jpg'),
      row('x', '', ev('e3', '2026-11-05T18:30:00Z')),
      row('y', 'Niemand', null),
    ];
    const out = buildDirectory(rows, new Map());
    expect(out).toHaveLength(1);
    expect(out[0].image).toBe('https://img/oska.jpg');
  });
});

describe('isHouseOrSeries', () => {
  it('ein Name, der sein Veranstaltungsort ist, ist ein Haus', () => {
    expect(isHouseOrSeries('Burgtheater', [ev('e', '2026-11-02T18:00:00Z', { location_name: 'Burgtheater', tags: ['theater'] })])).toBe(true);
    expect(isHouseOrSeries('Graz Tourismus', [ev('e', '2026-11-02T18:00:00Z', { location_name: 'GrazTourismus', tags: [] })])).toBe(true);
    expect(isHouseOrSeries('Circus-Theater Roncalli', [ev('e', '2026-11-02T18:00:00Z', { location_name: 'Circus-Theater Roncalli Innsbruck', tags: ['zirkus'] })])).toBe(true);
    expect(isHouseOrSeries('Alex Kristan', [ev('e', '2026-11-02T18:00:00Z', { location_name: 'Stadtsaal', tags: ['kabarett'] })])).toBe(false);
  });

  it('kurze Namen zählen nur bei exakter Übereinstimmung, nicht als Anfang des Saals', () => {
    expect(isHouseOrSeries('Mine', [ev('e', '2026-11-02T18:00:00Z', { location_name: 'Minerva-Halle', tags: ['pop'] })])).toBe(false);
  });

  it('Hauswort im Namen und höchstens zwei Orte: Haus, Reihe oder Festival; auf Tour bleibt Künstler', () => {
    const at = (venue: string, i: number) => ev(`e${i}`, `2026-11-0${(i % 7) + 2}T18:00:00Z`, { location_name: venue, tags: ['klassik'] });
    expect(isHouseOrSeries('Musikverein Graz', [at('Kammermusiksaal - congress graz', 1), at('Stefaniensaal', 2)])).toBe(true);
    expect(isHouseOrSeries('Landestheater Bregenz', [at('Salon Bühne 68', 1), at('Großes Haus', 2)])).toBe(true);
    expect(isHouseOrSeries('Klassik in der Krypta', [at('Peterskirche Wien Krypta', 1)])).toBe(true);
    expect(isHouseOrSeries('Backwood Festival', [at('Gelände', 1)])).toBe(true);
    expect(isHouseOrSeries('Mozart Dinner Concert', [at('Stiftskeller', 1)])).toBe(true);
    expect(isHouseOrSeries('Theater Liberi', [at('Stadthalle Wels', 1), at('Congress Graz', 2), at('Posthof', 3), at('Orpheum', 4)])).toBe(false);
    expect(isHouseOrSeries('Bergfestival', [at('Saalbach', 1)])).toBe(true);
    expect(isHouseOrSeries('Brucknerhaus Linz', [at('Brucknerhaus / Großer Saal', 1), at('Brucknerhaus / Mittlerer Saal', 2), at('Brucknerhaus Linz', 3), at('Brucknerhaus Foyer', 4)])).toBe(true);
    expect(isHouseOrSeries('Dave Hause', [at('Chelsea', 1)])).toBe(false);
    expect(isHouseOrSeries('Sondaschule', [at('Arena Wien', 1)])).toBe(false);
  });

  it('zehn und mehr Termine am selben Ort sind eine Reihe', () => {
    const many = (n: number, venue: string) => Array.from({ length: n }, (_, i) => ev(`e${i}`, `2026-11-${String(2 + (i % 20)).padStart(2, '0')}T18:00:00Z`, { location_name: venue, tags: ['musical'] }));
    expect(isHouseOrSeries('Maria Theresia - Das Musical', many(9, 'Ronacher'))).toBe(false);
    expect(isHouseOrSeries('Dschungel Wien Programm', many(12, 'Dschungel'))).toBe(true);
  });

  it('wer nur Ausstellungen, Messen, Kino oder Sport hat, ist kein Künstler', () => {
    expect(isHouseOrSeries('House of Banksy', [ev('e', '2026-11-03T23:00:00Z', { location_name: 'METAStadt', tags: ['ausstellung'], category: 'Kultur & Bühne' })])).toBe(true);
    expect(isHouseOrSeries('Österreichischer Handballbund', [ev('e', '2026-11-04T17:00:00Z', { location_name: 'Sportpark', tags: [], category: 'Sport & Bewegung' })])).toBe(true);
    expect(isHouseOrSeries('Bob Dylan', [ev('e', '2026-11-11T19:00:00Z', { location_name: 'Stadthalle', tags: [], category: 'Musik' })])).toBe(false);
  });
});

describe('kindOf', () => {
  it('die häufigste Spielart gewinnt, das Genre ist der häufigste Tag darin', () => {
    const events = [
      ev('1', '2026-11-02T18:00:00Z', { tags: ['kabarett', 'comedy'] }),
      ev('2', '2026-11-03T18:00:00Z', { tags: ['kabarett'] }),
      ev('3', '2026-11-04T18:00:00Z', { tags: ['rock'] }),
    ];
    expect(kindOf(events)).toEqual({ kind: 'kabarett', genre: 'kabarett' });
  });

  it('ohne passenden Tag entscheidet die Kategorie', () => {
    expect(kindOf([ev('1', '2026-11-02T18:00:00Z', { tags: [], category: 'Musik' })])).toEqual({ kind: 'konzert', genre: null });
    expect(kindOf([ev('1', '2026-11-02T18:00:00Z', { tags: [], category: 'Kultur & Bühne' })])).toEqual({ kind: 'buehne', genre: null });
    expect(kindOf([ev('1', '2026-11-02T18:00:00Z', { tags: [], category: 'Community & Freizeit' })])).toEqual({ kind: 'sonstiges', genre: null });
  });
});

const artist = (id: string, name: string, dates: string[], extra: Partial<DirectoryArtist> = {}): DirectoryArtist => ({
  id,
  name,
  image: null,
  evoLink: null,
  kind: 'konzert',
  genre: 'rock',
  events: dates.map((d, i) => ({
    id: `${id}-${i}`, slug: null, title: name, start_date: d, postal_code: '1010', address: null, bundesland: 'wien', location_name: `Saal ${i}`, city: 'Wien',
  })),
  ...extra,
});

describe('Regale', () => {
  const pool = [
    artist('a', 'Ernst Molden', ['2026-11-02T18:30:00Z', '2026-11-05T18:30:00Z', '2026-11-10T18:30:00Z'], { kind: 'klassik', genre: 'jazz' }),
    artist('b', 'Alex Kristan', ['2026-11-03T18:30:00Z', '2026-11-04T18:30:00Z', '2026-11-12T18:30:00Z'], { kind: 'kabarett', genre: 'kabarett' }),
    artist('c', 'Placebo', ['2026-11-10T19:00:00Z']),
    artist('d', 'Bob Dylan', ['2026-11-11T19:00:00Z', '2026-11-12T19:00:00Z']),
    artist('e', 'Korn', ['2026-11-19T19:00:00Z']),
    artist('f', 'Tokio Hotel', ['2026-11-15T19:00:00Z']),
    artist('g', 'Jungle', ['2026-11-13T19:00:00Z']),
    artist('h', 'Soffie', ['2026-11-08T22:59:00Z']),
  ];

  it('Diese Woche live: nächster Termin bis einschließlich heute + 6 (Wiener Tage)', () => {
    expect(liveThisWeek(pool, TODAY).map(a => a.name)).toEqual(['Ernst Molden', 'Alex Kristan', 'Soffie']);
  });

  it('Auf Tour: mindestens drei Termine an zwei Orten, die meisten zuerst', () => {
    const sameHall = artist('s', 'Hausband', ['2026-11-02T18:00:00Z', '2026-11-03T18:00:00Z', '2026-11-04T18:00:00Z']);
    for (const e of sameHall.events) e.location_name = 'Gasometer';
    expect(onTour([...pool, sameHall]).map(a => a.name)).toEqual(['Ernst Molden', 'Alex Kristan']);
  });

  it('planArtistShelves: Woche, Tour und Spielarten mit mindestens vier Künstlern, nach nächstem Termin', () => {
    const shelves = planArtistShelves(pool, TODAY);
    expect(shelves.map(s => s.key)).toEqual(['konzert']);
    expect(shelves[0].artists.map(a => a.name)).toEqual(['Soffie', 'Placebo', 'Bob Dylan', 'Jungle', 'Tokio Hotel', 'Korn']);
    const more = [...pool, artist('i', 'Mine', ['2026-11-09T19:00:00Z']), artist('j', 'Afrob', ['2026-11-06T19:00:00Z'])];
    expect(planArtistShelves(more, TODAY).map(s => s.key)).toEqual(['week', 'konzert']);
  });
});

describe('Verzeichnis und Suche', () => {
  const pool = [
    artist('a', 'Ernst Molden', ['2026-11-02T18:30:00Z']),
    artist('b', 'Älex Kristan', ['2026-11-03T18:30:00Z']),
    artist('c', '5/8erl in Ehr’n', ['2026-11-14T18:30:00Z']),
    artist('d', 'The Umbilical Brothers', ['2026-11-03T18:30:00Z']),
    artist('e', 'Molden & Freunde', ['2026-11-03T18:30:00Z']),
  ];

  it('letterOf: Artikel überspringen, Ziffern unter #', () => {
    expect(letterOf('Älex Kristan')).toBe('A');
    expect(letterOf('5/8erl in Ehr’n')).toBe('#');
    expect(letterOf('The Umbilical Brothers')).toBe('U');
  });

  it('alphabetical sortiert deutsch ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    expect(alphabetical(pool).map(a => a.name)).toEqual(['5/8erl in Ehr’n', 'Älex Kristan', 'Ernst Molden', 'Molden & Freunde', 'The Umbilical Brothers']);
  });

  it('searchDirectory: ab zwei Zeichen, ohne Diakritika, Wortanfänge zuerst', () => {
    expect(searchDirectory(pool, 'a')).toEqual([]);
    expect(searchDirectory(pool, 'alex').map(a => a.name)).toEqual(['Älex Kristan']);
    expect(searchDirectory(pool, 'molden').map(a => a.name)).toEqual(['Molden & Freunde', 'Ernst Molden']);
  });

  it('relatedArtists: gleiche Spielart, gleiches Genre zuerst, nie der Künstler selbst', () => {
    const base = artist('x', 'Soffie', ['2026-11-04T19:00:00Z'], { genre: 'pop' });
    const others = [
      artist('y', 'Mine', ['2026-11-09T19:00:00Z'], { genre: 'pop' }),
      artist('z', 'Korn', ['2026-11-19T19:00:00Z'], { genre: 'metal' }),
      artist('k', 'Alex Kristan', ['2026-11-03T18:30:00Z'], { kind: 'kabarett', genre: 'kabarett' }),
    ];
    expect(relatedArtists([base, ...others], base).map(a => a.name)).toEqual(['Mine', 'Korn']);
  });

  it('programTitle: Künstlername am Anfang fällt weg, bleibt nichts, null', () => {
    const a = artist('a', 'Alex Kristan', ['2026-11-03T18:30:00Z']);
    const e = { ...a.events[0], title: 'Alex Kristan - Born to be Child' };
    expect(programTitle(a, e)).toBe('Born to be Child');
    expect(programTitle(a, { ...e, title: 'Alex Kristan' })).toBeNull();
    expect(programTitle(a, { ...e, title: 'Kabarettgipfel mit Alex Kristan' })).toBe('Kabarettgipfel mit Alex Kristan');
    expect(programTitle(a, { ...e, title: 'Alex Kristan & Gery Seidl - Doppelpass' })).toBe('Alex Kristan & Gery Seidl - Doppelpass');
  });
});

import { describe, it, expect } from 'vitest';
import type { Event } from '@/types/events';
import type { ArtistEventRow, LandingArtistLive } from '@/lib/v4/landing-picks';
import {
  artistNameFilter,
  chunkNames,
  mergeArtistsLive,
  normalizeFollowedNames,
  pickFollowedLive,
  quotePostgrestValue,
} from '@/lib/v4/followed-live';

const ev = (id: string, start: string, extra: Partial<Event & { duplicate_of?: string | null }> = {}) =>
  ({ id, title: id, start_date: start, publish_status: 'published', country: 'AT', ...extra }) as Event & { duplicate_of?: string | null };

const row = (event: ArtistEventRow['event'], ...artists: Array<[string, string, string?]>): ArtistEventRow => ({
  event,
  artists: artists.map(([artist_id, artist_name, artist_image]) => ({ artist_id, artist_name, artist_image: artist_image ?? null, evo_link: null })),
});

const live = (artistId: string, name: string, start: string): LandingArtistLive =>
  ({ artistId, name, image: null, evoLink: null, event: ev(`e-${artistId}`, start) });

describe('normalizeFollowedNames', () => {
  it('normalisiert, trimmt, entfernt Diakritika und Dubletten, lässt Leeres aus', () => {
    expect(normalizeFollowedNames([
      { artist_name: 'Beyoncé' }, { artist_name: ' Bilderbuch ' }, { artist_name: 'beyonce' }, { artist_name: '' }, { artist_name: null },
    ])).toEqual(['beyonce', 'bilderbuch']);
  });
});

describe('chunkNames', () => {
  it('teilt in Blöcke von höchstens 100 Namen', () => {
    const names = Array.from({ length: 250 }, (_, i) => `n${i}`);
    expect(chunkNames(names).map(c => c.length)).toEqual([100, 100, 50]);
    expect(chunkNames([])).toEqual([]);
  });
});

describe('artistNameFilter', () => {
  it('je Name ein ilike roh und, falls abweichend, normalisiert; Werte in Anführungszeichen', () => {
    expect(artistNameFilter(['Bilderbuch', 'Beyoncé'])).toBe(
      'artist_name.ilike."Bilderbuch",artist_name.ilike."Beyoncé",artist_name.ilike."beyonce"',
    );
  });

  it('schützt Komma, Klammer, Anführungszeichen und Backslash im Namen', () => {
    expect(quotePostgrestValue('Earth, Wind & Fire')).toBe('"Earth, Wind & Fire"');
    expect(quotePostgrestValue('Say "Hi" \\ now')).toBe('"Say \\"Hi\\" \\\\ now"');
    expect(artistNameFilter(['Earth, Wind & Fire (Tribute)'])).toBe('artist_name.ilike."Earth, Wind & Fire (Tribute)"');
  });

  it('leer ohne verwertbare Namen', () => {
    expect(artistNameFilter(['', '   '])).toBe('');
  });
});

describe('pickFollowedLive', () => {
  const followed = new Set(['bilderbuch', 'beyonce']);

  it('nimmt nur gefolgte Künstler, Abgleich ohne Groß-/Kleinschreibung und Diakritika', () => {
    const rows = [
      row(ev('e1', '2026-11-03T19:00:00Z'), ['a1', 'BILDERBUCH'], ['a2', 'Wanda']),
      row(ev('e2', '2026-11-02T19:00:00Z'), ['a3', 'Beyoncé', 'img']),
    ];
    const out = pickFollowedLive(rows, new Map(), followed);
    expect(out.map(a => a.name)).toEqual(['Beyoncé', 'BILDERBUCH']);
    expect(out[0].image).toBe('img');
    expect(out[0].event.id).toBe('e2');
  });

  it('je Künstler der nächste Termin, sortiert nach Datum', () => {
    const rows = [
      row(ev('later', '2026-11-05T19:00:00Z'), ['a1', 'Bilderbuch']),
      row(ev('soon', '2026-11-01T19:00:00Z'), ['a1', 'Bilderbuch']),
      row(ev('mid', '2026-11-03T19:00:00Z'), ['a3', 'Beyonce']),
    ];
    const out = pickFollowedLive(rows, new Map(), followed);
    expect(out.map(a => [a.name, a.event.id])).toEqual([['Bilderbuch', 'soon'], ['Beyonce', 'mid']]);
  });

  it('unterdrückte Zeilen zeigen den Primary, ohne Primary fallen sie weg', () => {
    const rows = [
      row(ev('d1', '2026-11-03T19:00:00Z', { publish_status: 'duplicate', duplicate_of: 'p1' }), ['a1', 'Bilderbuch']),
      row(ev('d2', '2026-11-03T19:00:00Z', { publish_status: 'duplicate', duplicate_of: 'missing' }), ['a3', 'Beyonce']),
    ];
    const primaries = new Map([['p1', ev('p1', '2026-11-03T19:00:00Z')]]);
    const out = pickFollowedLive(rows, primaries, followed);
    expect(out.map(a => [a.name, a.event.id])).toEqual([['Bilderbuch', 'p1']]);
  });

  it('leer ohne gefolgte Namen', () => {
    expect(pickFollowedLive([row(ev('e1', '2026-11-03T19:00:00Z'), ['a1', 'Bilderbuch'])], new Map(), new Set())).toEqual([]);
  });
});

describe('mergeArtistsLive', () => {
  it('gefolgte zuerst, Rotation füllt auf drei auf, Dubletten nach ID oder Name entfallen', () => {
    const followedLive = [live('f1', 'Conchita Wurst', '2026-11-02T19:00:00Z')];
    const rotation = [
      live('r1', 'Bilderbuch', '2026-11-03T19:00:00Z'),
      live('f1', 'Conchita Wurst', '2026-11-04T19:00:00Z'),
      live('r2', 'conchita wurst', '2026-11-04T19:00:00Z'),
      live('r3', 'Wanda', '2026-11-05T19:00:00Z'),
      live('r4', 'Dardan', '2026-11-06T19:00:00Z'),
    ];
    expect(mergeArtistsLive(followedLive, rotation).map(a => a.artistId)).toEqual(['f1', 'r1', 'r3']);
  });

  it('ohne gefolgte bleibt die Rotation', () => {
    const rotation = [live('r1', 'A', '2026-11-03T19:00:00Z'), live('r2', 'B', '2026-11-03T19:00:00Z')];
    expect(mergeArtistsLive([], rotation)).toEqual(rotation);
  });
});

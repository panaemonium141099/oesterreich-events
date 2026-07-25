import { describe, it, expect } from 'vitest';
import {
  MIN_INDEXABLE_DESCRIPTION_LENGTH,
  activityCanonicalUrl,
  hasOpeningTimes,
  hasRenderableImage,
  isActivityIndexable,
  renderableImageUrls,
} from '@/lib/activities/indexability';

const IMAGE = [{ urls: ['https://cdn.deskline.net/x.jpg'], copyright: '© TVB', license: null, author: null }];
const OPENING = [{ from: '2026-05-01', to: '2026-10-26', timeFrom: '09:00', timeTo: '17:00', weekdays: null }];

function longDescription(len = MIN_INDEXABLE_DESCRIPTION_LENGTH): string {
  return 'x'.repeat(len);
}

describe('isActivityIndexable (Noindex-Gate E7)', () => {
  it('indexiert bei Beschreibung >= 200 Zeichen (auch ohne Bild/Zeiten)', () => {
    expect(
      isActivityIndexable({ description: longDescription(), images: null, opening_times: null }),
    ).toBe(true);
  });

  it('199 Zeichen reichen NICHT (Grenzwert exakt)', () => {
    expect(
      isActivityIndexable({ description: longDescription(199), images: null, opening_times: null }),
    ).toBe(false);
  });

  it('Whitespace zaehlt nicht zur Laenge (trim)', () => {
    const padded = `  ${'x'.repeat(150)}  `;
    expect(isActivityIndexable({ description: padded, images: null, opening_times: null })).toBe(false);
  });

  it('indexiert bei Bild + Oeffnungszeiten ohne lange Beschreibung', () => {
    expect(
      isActivityIndexable({ description: 'kurz', images: IMAGE, opening_times: OPENING }),
    ).toBe(true);
  });

  it('Bild allein reicht nicht', () => {
    expect(isActivityIndexable({ description: null, images: IMAGE, opening_times: null })).toBe(false);
    expect(isActivityIndexable({ description: null, images: IMAGE, opening_times: [] })).toBe(false);
  });

  it('Oeffnungszeiten allein reichen nicht', () => {
    expect(isActivityIndexable({ description: null, images: null, opening_times: OPENING })).toBe(false);
  });

  it('Thin-POI (nichts vorhanden) ist noindex', () => {
    expect(isActivityIndexable({ description: null, images: null, opening_times: null })).toBe(false);
  });

  it('is_closed=true ist IMMER noindex — auch bei reichem Content', () => {
    expect(
      isActivityIndexable({
        description: longDescription(500),
        images: IMAGE,
        opening_times: OPENING,
        is_closed: true,
      }),
    ).toBe(false);
  });

  it('is_closed=false/undefined blockiert nicht', () => {
    expect(
      isActivityIndexable({
        description: longDescription(),
        images: null,
        opening_times: null,
        is_closed: false,
      }),
    ).toBe(true);
  });
});

describe('hasRenderableImage', () => {
  it('erkennt nur Eintraege mit nicht-leerer URL', () => {
    expect(hasRenderableImage(IMAGE)).toBe(true);
    expect(hasRenderableImage([{ urls: [], copyright: null }])).toBe(false);
    expect(hasRenderableImage([{ urls: ['  '], copyright: null }])).toBe(false);
    expect(hasRenderableImage([{ copyright: '© x' }])).toBe(false);
    expect(hasRenderableImage(null)).toBe(false);
    expect(hasRenderableImage('kaputt')).toBe(false);
    expect(hasRenderableImage([null, { urls: ['https://a/b.jpg'] }])).toBe(true);
  });
});

describe('renderableImageUrls (defensiv gegen malformtes jsonb)', () => {
  it('extrahiert nur nicht-leere String-URLs in Reihenfolge', () => {
    const images = [
      { urls: ['https://a/1.jpg', '', '  ', 'https://a/2.jpg'] },
      { urls: ['https://b/3.jpg'] },
    ];
    expect(renderableImageUrls(images)).toEqual([
      'https://a/1.jpg',
      'https://a/2.jpg',
      'https://b/3.jpg',
    ]);
  });

  it('crasht nicht bei null-Eintraegen, fehlenden/malformten urls oder Nicht-Arrays', () => {
    expect(renderableImageUrls([null, { urls: ['https://a/b.jpg'] }])).toEqual(['https://a/b.jpg']);
    expect(renderableImageUrls([{ copyright: '© x' }, 42, 'str', { urls: 'nope' }])).toEqual([]);
    expect(renderableImageUrls([{ urls: [null, 7, { u: 'x' }] }])).toEqual([]);
    expect(renderableImageUrls(null)).toEqual([]);
    expect(renderableImageUrls(undefined)).toEqual([]);
    expect(renderableImageUrls({})).toEqual([]);
  });
});

describe('hasOpeningTimes', () => {
  it('zaehlt nur nicht-leere Arrays (normalisiertes E8-Feld)', () => {
    expect(hasOpeningTimes(OPENING)).toBe(true);
    expect(hasOpeningTimes([])).toBe(false);
    expect(hasOpeningTimes(null)).toBe(false);
    expect(hasOpeningTimes({})).toBe(false);
  });
});

describe('activityCanonicalUrl (E13)', () => {
  it('liefert IMMER die DE-URL — Grundlage der /en-Canonical-Regel', () => {
    expect(activityCanonicalUrl('mountaincart-fulseck-abc123def456')).toBe(
      'https://lasstreffen.at/aktivitaet/mountaincart-fulseck-abc123def456',
    );
  });
});

import { describe, it, expect } from 'vitest';
import { ALL_POSTS } from '@/content/blog';
import { factSourceErrors, factSourceUrls, hasConcreteDate } from '@/lib/blog/fact-sources';
import type { FestivalPost } from '@/content/blog/types';

/**
 * Wächter: Jeder Blogpost mit Termin nennt die Quellen seiner Fakten und den
 * Tag, an dem sie dort geprüft wurden (`factSources`). Anlass: der
 * handgeschriebene April-Batch 2026 hatte geschätzte Termine, erfundene
 * Lineups und Events, die es nicht gibt (PR #338, Fakten-Audit 2026-10-27).
 *
 * Diese Posts haben noch keine Belege. Die Liste darf nur schrumpfen: wer
 * einen Post prüft, trägt factSources ein und streicht den Slug hier. Neue
 * Posts kommen nie hinein.
 */
const OHNE_BELEGE = new Set<string>([
  // April-Batch (Spec fn-3, 2026-04-01): die übrigen 38 Posts sind seit dem Fakten-Audit 2026-10-27 belegt
  'donauinselfest-2026', 'frequency-festival-2026', 'nova-rock-2026', 'kaiser-wiesn',
  'vienna-city-marathon', 'viennale', 'wiener-festwochen', 'wiener-genussfestival',
  'wiener-neujahrskonzert',
  // Handgeschrieben am 2026-04-13 (Commit 54f3845e), nie gegen Quellen geprüft
  'electric-love-festival-2026', 'fest-der-freude-2026', 'glatt-und-verkehrt-2026', 'impulstanz-2026',
  'jazzfest-wien-2026', 'musikfestival-steyr-2026', 'narzissenfest-2026', 'poolbar-festival-2026',
  'schlossspiele-kobersdorf-2026', 'sommernachtskonzert-schoenbrunn-2026', 'spitzer-marillenkirtag-2026',
  'tiroler-festspiele-erl-2026',
  // Saison-Guide aus DB-Events vor factSources; die nächste Generierung schreibt Belege
  'herbstfeste-erntedank-oesterreich',
]);

// Einen Tag Spielraum: geprüft nach Wiener Datum, gemessen in UTC.
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

describe('Blogposts belegen ihre Fakten (factSources)', () => {
  it('jeder Post mit Termin trägt Quellen und Prüfdatum', () => {
    const failures = ALL_POSTS
      .filter((p) => hasConcreteDate(p) && !OHNE_BELEGE.has(p.slug))
      .flatMap((p) => factSourceErrors(p, TOMORROW).map((e) => `${p.slug}: ${e}`));
    expect(failures).toEqual([]);
  });

  it('die Liste ohne Belege schrumpft nur', () => {
    const bySlug = new Map(ALL_POSTS.map((p) => [p.slug, p]));
    const stale = [...OHNE_BELEGE].filter((slug) => {
      const p = bySlug.get(slug);
      return !p || !hasConcreteDate(p) || p.factSources !== undefined;
    });
    // Belegt, gelöscht oder ohne Termin: Slug aus OHNE_BELEGE streichen.
    expect(stale).toEqual([]);
  });

  it('eingetragene Belege sind auch bei Posts ohne Termin gültig', () => {
    const failures = ALL_POSTS
      .filter((p) => p.factSources)
      .flatMap((p) => factSourceErrors(p, TOMORROW).map((e) => `${p.slug}: ${e}`));
    expect(failures).toEqual([]);
  });
});

describe('factSourceUrls', () => {
  it('nimmt nur http(s)-URLs, dedupliziert, behält die Reihenfolge', () => {
    expect(factSourceUrls(
      ['https://a.at/x', 'unbekannt'], null, 'https://b.at', undefined, 'https://a.at/x', 'ftp://c.at',
    )).toEqual(['https://a.at/x', 'https://b.at']);
  });
});

describe('hasConcreteDate', () => {
  const base = { keyFacts: { dates: 'Ganzjährig' } } as Pick<FestivalPost, 'jsonLdEvent' | 'keyFacts'>;
  it('Unterkunfts-Artikel ohne Termin brauchen keine Belege', () => {
    expect(hasConcreteDate(base)).toBe(false);
  });
  it('eine Ziffer in keyFacts.dates oder ein Event-Schema verlangt Belege', () => {
    expect(hasConcreteDate({ ...base, keyFacts: { ...base.keyFacts, dates: '13. November 2026' } } as typeof base)).toBe(true);
    expect(hasConcreteDate({ ...base, jsonLdEvent: {} as FestivalPost['jsonLdEvent'] })).toBe(true);
  });
});

describe('factSourceErrors', () => {
  const post = (factSources?: FestivalPost['factSources']) => ({ factSources }) as FestivalPost;
  it('meldet fehlende Belege, kaputtes Datum, Zukunft und Nicht-URLs', () => {
    expect(factSourceErrors(post(), '2026-10-28')).toEqual(['factSources fehlt']);
    expect(factSourceErrors(post({ checkedAt: '27.10.2026', urls: ['https://a.at'] }), '2026-10-28')[0]).toMatch(/kein ISO-Tag/);
    expect(factSourceErrors(post({ checkedAt: '2026-11-01', urls: ['https://a.at'] }), '2026-10-28')[0]).toMatch(/Zukunft/);
    expect(factSourceErrors(post({ checkedAt: '2026-10-27', urls: [] }), '2026-10-28')).toEqual(['keine Quell-URL']);
    expect(factSourceErrors(post({ checkedAt: '2026-10-27', urls: ['wien.info'] }), '2026-10-28')[0]).toMatch(/keine URL/);
  });
  it('lässt einen sauber belegten Post durch', () => {
    expect(factSourceErrors(post({ checkedAt: '2026-10-27', urls: ['https://www.wien.info/de/weihnachtsmarkt'] }), '2026-10-28')).toEqual([]);
  });
});

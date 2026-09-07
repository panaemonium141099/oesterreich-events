/**
 * `events.district` haengt an einem Fremdschluessel auf
 * `district_canonical(name)`. PostgREST upsertet batchweise — EIN
 * ungueltiger Bezirk reisst alle 100 Zeilen des Batches mit.
 *
 * Lauf 2026-09-07: 4.801 Zeilen so verloren, allein meinbezirk 3.700 von
 * 3.701. Der Adapter schreibt den URL-Slug ("wr-neustadt", "zell-am-see")
 * als Bezirk; `normalizeDistrict` liess unbekannte Schreibweisen
 * unveraendert durch.
 */
import { describe, it, expect } from 'vitest';
import { normalizeDistrict, isCanonicalDistrict } from '@/lib/district-normalizer';

/** Die Regel, die der Schreibpfad in supabase-sync.ts anwendet. */
function writableDistrict(raw: string | null | undefined, bl: string | null): string | null {
  const n = normalizeDistrict(raw, bl, undefined);
  return n && isCanonicalDistrict(n) ? n : null;
}

describe('MeinBezirk-Slugs sind kanonisch aufloesbar', () => {
  const cases: Array<[string, string, string]> = [
    ['wr-neustadt', 'niederoesterreich', 'wiener neustadt (stadt)'],
    ['waidhofen-an-der-thaya', 'niederoesterreich', 'waidhofen an der thaya'],
    ['waidhofen-an-der-ybbs', 'niederoesterreich', 'waidhofen an der ybbs'],
    ['steyr', 'oberoesterreich', 'steyr (stadt)'],
    ['wels', 'oberoesterreich', 'wels (stadt)'],
    ['zell-am-see', 'salzburg', 'zell am see'],
    ['st-johann-im-pongau', 'salzburg', 'sankt johann im pongau'],
    ['hartberg', 'steiermark', 'hartberg-fürstenfeld'],
  ];
  for (const [slug, bl, expected] of cases) {
    it(`${slug} -> ${expected}`, () => {
      expect(normalizeDistrict(slug, bl, undefined)).toBe(expected);
      expect(isCanonicalDistrict(expected)).toBe(true);
    });
  }
});

describe('Schreibpfad laesst nur kanonische Bezirke durch', () => {
  it('verwirft einen unbekannten Bezirk, statt ihn zu schreiben', () => {
    // Vorher wanderte so ein Wert in die FK-Spalte und riss den Batch mit.
    expect(writableDistrict('voellig-erfundener-bezirk', 'steiermark')).toBeNull();
  });

  it('verwirft "wien" — Wien hat 23 Bezirke, keinen namens "wien"', () => {
    expect(writableDistrict('wien', 'wien')).toBeNull();
  });

  it('laesst einen kanonischen Bezirk unveraendert durch', () => {
    expect(writableDistrict('zell am see', 'salzburg')).toBe('zell am see');
  });

  it('null/leer bleibt null', () => {
    expect(writableDistrict(null, 'steiermark')).toBeNull();
    expect(writableDistrict('   ', 'steiermark')).toBeNull();
  });
});

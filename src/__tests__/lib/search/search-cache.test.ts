import { describe, it, expect } from 'vitest';
import { TtlCache } from '@/lib/search/search-cache';

describe('TtlCache', () => {
  it('liefert gesetzte Werte innerhalb der TTL', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'wert', 0);
    expect(cache.get('a', 500)).toBe('wert');
  });

  it('lässt Einträge nach Ablauf der TTL verfallen', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'wert', 0);
    expect(cache.get('a', 1000)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('liefert null für unbekannte Keys', () => {
    const cache = new TtlCache<string>(1000);
    expect(cache.get('fehlt')).toBeNull();
  });

  it('evictet den ältesten Eintrag jenseits von maxEntries', () => {
    const cache = new TtlCache<number>(10_000, 3);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.set('c', 3, 0);
    cache.set('d', 4, 0);
    expect(cache.size).toBe(3);
    expect(cache.get('a', 1)).toBeNull();
    expect(cache.get('d', 1)).toBe(4);
  });

  it('behandelt Re-Set als frischen Eintrag (Eviction-Reihenfolge)', () => {
    const cache = new TtlCache<number>(10_000, 3);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.set('c', 3, 0);
    cache.set('a', 11, 0); // 'a' rückt ans Ende
    cache.set('d', 4, 0);  // evictet jetzt 'b', nicht 'a'
    expect(cache.get('a', 1)).toBe(11);
    expect(cache.get('b', 1)).toBeNull();
  });
});

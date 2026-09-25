import { describe, it, expect } from 'vitest';
import { SEASONS, currentSeason, titleMatchesSeason, seasonById, seasonEndDate } from '@/lib/landing/seasons';
import { TAG_SET } from '@/lib/category-classifier/enrichment-taxonomy';

describe('Saison-Kalender der Landing', () => {
  it('nutzt nur Tags aus der Taxonomie', () => {
    for (const s of SEASONS) {
      for (const tag of s.tags) expect(TAG_SET.has(tag), `${s.id}: ${tag}`).toBe(true);
    }
  });

  it('deckt jeden Tag eines Schaltjahres mit einem Fenster ab', () => {
    const ids = new Set<string>();
    for (let d = 0; d < 366; d++) {
      // 12:00 UTC ist in Wien derselbe Kalendertag
      const date = new Date(Date.UTC(2028, 0, 1 + d, 12));
      ids.add(currentSeason(date).id);
    }
    expect(ids).toEqual(new Set(SEASONS.map(s => s.id)));
  });

  it('wählt die engere Saison bei Überlappung und rechnet in Wiener Zeit', () => {
    expect(currentSeason(new Date('2026-12-31T12:00:00Z')).id).toBe('silvester');
    expect(currentSeason(new Date('2026-12-01T12:00:00Z')).id).toBe('advent');
    expect(currentSeason(new Date('2026-09-24T12:00:00Z')).id).toBe('herbst');
    expect(currentSeason(new Date('2026-10-30T12:00:00Z')).id).toBe('halloween');
    // 23:30 UTC am 13.11. ist in Wien schon der 14.11.
    expect(currentSeason(new Date('2026-11-13T23:30:00Z')).id).toBe('advent');
  });
});

describe('seasonEndDate / seasonById', () => {
  const herbst = seasonById('herbst')!;
  const silvester = seasonById('silvester')!;
  it('liefert das Ende des laufenden Fensters in Wiener Zeit', () => {
    expect(seasonEndDate(herbst, new Date('2026-09-25T12:00:00Z'))).toBe('2026-11-13');
  });
  it('rollt ins nächste Jahr, wenn das Ende schon vorbei ist', () => {
    expect(seasonEndDate(herbst, new Date('2026-12-01T12:00:00Z'))).toBe('2027-11-13');
  });
  it('behandelt Fenster über Neujahr', () => {
    expect(seasonEndDate(silvester, new Date('2026-12-28T12:00:00Z'))).toBe('2027-01-01');
    expect(seasonEndDate(silvester, new Date('2027-01-01T12:00:00Z'))).toBe('2027-01-01');
  });
  it('kennt nur echte Saison-ids', () => {
    expect(seasonById('herbst')?.id).toBe('herbst');
    expect(seasonById('gibtsnicht')).toBeUndefined();
    expect(seasonById(null)).toBeUndefined();
  });
});

describe('titleMatchesSeason', () => {
  const herbst = SEASONS.find(s => s.id === 'herbst')!;
  it('erkennt Saison-Wörter im Titel', () => {
    expect(titleMatchesSeason('Sturmheuriger des ÖKB Schiltern', herbst)).toBe(true);
    expect(titleMatchesSeason('Kunst.Hand.Werk in der Postgarage', herbst)).toBe(false);
    expect(titleMatchesSeason(null, herbst)).toBe(false);
  });
});

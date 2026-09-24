import { describe, expect, it } from 'vitest';
import { GEM2GO_GEMEINDEN } from '@/lib/scrapers/gemeinden/gem2goGemeinden';
import { GEMEINDEN } from '@/lib/scrapers/gemeinden/gemeindeList';
import { expectedPlzIfWrong } from '@/lib/scrapers/gemeinden/config-plz-check';

// Prod-Befund 2026-09-24: 40 Websites waren mehreren Gemeinden zugeordnet
// (sankt-martin.at sechs St. Martins in fünf Bundesländern), und ein
// Vorarlberger Block trug jeweils die PLZ der Vorzeile. Jedes Event dieser
// Seiten landete mit falscher PLZ, falschem Bezirk und falscher URL in der DB.

const ALL = [
  ...GEM2GO_GEMEINDEN.map(g => ({ ...g, file: 'gem2goGemeinden.ts' })),
  ...GEMEINDEN.map(g => ({ ...g, file: 'gemeindeList.ts' })),
];

// Ganze URL statt Domain: Talportale führen je Gemeinde eine eigene
// Unterseite (defereggental.eu/page.cfm?vpath=st-jakob).
const siteKey = (w: string) => w.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();

describe('Gemeinde-Scraper-Config', () => {
  it('keine Website gehört zwei verschiedenen Gemeinden', () => {
    const byDomain = new Map<string, Set<string>>();
    for (const g of ALL) {
      if (g.website === 'https://none') continue;
      const d = siteKey(g.website);
      byDomain.set(d, (byDomain.get(d) ?? new Set()).add(`${g.name} ${g.plz}`));
    }
    const shared = [...byDomain].filter(([, s]) => new Set([...s].map(x => x.split(' ').pop())).size > 1)
      .map(([d, s]) => `${d}: ${[...s].join(' | ')}`);
    expect(shared).toEqual([]);
  });

  it('PLZ passt zum Postamt gleichen Namens im selben Bezirk', () => {
    const wrong = ALL.flatMap(g => {
      const exp = expectedPlzIfWrong(g.name, g.plz, g.bezirk);
      return exp ? [`${g.file}: ${g.name} ${g.plz} (Post: ${exp})`] : [];
    });
    expect(wrong).toEqual([]);
  });
});

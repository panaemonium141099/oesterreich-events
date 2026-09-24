import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GEM2GO_GEMEINDEN_LISTE } from '@/lib/scrapers/gemeinden/gem2goGemeinden';
import { GEMEINDEN } from '@/lib/scrapers/gemeinden/gemeindeList';
import { findGemeinde, loadGemeindenMaster } from '@/lib/gemeinden/data';
import { districtFromGemeinde } from '@/lib/plz-district';

// Befund 2026-09-24: vier Gemeindelisten führten eigene PLZ-/Bezirks-/
// Koordinaten-Kopien; ein verrutschter Block und 40 geteilte Websites
// schrieben Events in fremde Orte. Seitdem tragen die Listen nur die
// Identität, Ortsdaten kommen aus data/gemeinden-at.json. Diese Tests
// halten beides fest.

const ROOT = process.cwd();
const registry = readdirSync(join(ROOT, 'data', 'gemeinden-registry')).flatMap(f =>
  (JSON.parse(readFileSync(join(ROOT, 'data', 'gemeinden-registry', f), 'utf8')) as Array<{ name: string; website: string; eventUrl: string | null; status: string; region?: boolean }>)
    .filter(e => e.status === 'active' || e.status === 'empty')
    .map(e => ({ ...e, bundesland: f.replace('.json', ''), quelle: `registry/${f}` })),
);
const eventPages = (JSON.parse(readFileSync(join(ROOT, 'data', 'gemeinden-event-pages.json'), 'utf8')) as Array<{ gemeinde: { name: string; website: string; bundesland: string }; eventPageUrl: string }>)
  .map(p => ({ ...p.gemeinde, website: p.eventPageUrl, quelle: 'gemeinden-event-pages.json' }));

const ALL = [
  ...GEM2GO_GEMEINDEN_LISTE.map(g => ({ ...g, bundesland: '', quelle: 'gem2goGemeinden.ts' })),
  ...GEMEINDEN.map(g => ({ ...g, quelle: 'gemeindeList.ts' })),
  ...registry.map(g => ({ ...g, website: g.eventUrl ?? g.website })),
  ...eventPages,
];

// Ganze URL statt Domain: Talportale führen je Gemeinde eine eigene
// Unterseite (defereggental.eu/page.cfm?vpath=st-jakob).
const siteKey = (w: string) => w.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();

describe('Gemeinde-Stammdaten', () => {
  it('keine Kalender-URL zeigt auf ein Asset (CSS/JS)', () => {
    expect(ALL.filter(g => /\.(css|js)(\?|$)/.test(g.website ?? '')).map(g => `${g.quelle}: ${g.name}`)).toEqual([]);
  });

  const master = loadGemeindenMaster();

  it('jede Gemeinde hat Mittelpunkt in Österreich, Bezirk und PLZ', () => {
    const bad = master.filter(g =>
      !(g.lat > 46.3 && g.lat < 49.1 && g.lng > 9.5 && g.lng < 17.2) || !g.bezirk || !g.plzAll.every(p => /^\d{4}$/.test(p)));
    expect(bad.map(g => `${g.gkz} ${g.name}`)).toEqual([]);
  });

  it('jede Gemeinde ergibt einen kanonischen Bezirk', () => {
    // Wien ist bewusst Bundesland-only.
    const ohne = master
      .filter(g => g.bundesland !== 'wien')
      .filter(g => !districtFromGemeinde(g.bezirk, g.bundesland, g.plz))
      .map(g => `${g.gkz} ${g.name} (${g.bezirk})`);
    expect(ohne).toEqual([]);
  });

  it('jeder Listeneintrag gehört genau einer amtlichen Gemeinde', () => {
    const missing = ALL.filter(g => !findGemeinde(g)).map(g => `${g.quelle}: ${g.name}`);
    expect(missing).toEqual([]);
  });

  it('keine Kalender-Website gehört zwei verschiedenen Gemeinden', () => {
    const owners = new Map<string, Set<string>>();
    for (const g of ALL) {
      if (!g.website || g.website === 'https://none' || ('region' in g && g.region)) continue;
      const gem = findGemeinde(g);
      if (!gem) continue;
      const k = siteKey(g.website);
      owners.set(k, (owners.get(k) ?? new Set()).add(`${gem.gkz} ${gem.name}`));
    }
    const shared = [...owners].filter(([, s]) => s.size > 1).map(([k, s]) => `${k}: ${[...s].join(' | ')}`);
    expect(shared).toEqual([]);
  });
});

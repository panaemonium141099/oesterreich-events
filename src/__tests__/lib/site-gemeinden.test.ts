/**
 * Gemeinden der Seite (fn-31.11): lasstreffen.at unverändert die
 * österreichischen, lasstreffen.de die deutschen im selben Format.
 */
import { describe, it, expect } from 'vitest';
import { buildGemeindenDe, siteGemeindeBySlug, siteGemeinden, siteNeighbourGemeinden } from '@/lib/site/gemeinden';
import { ALL_GEMEINDEN, haversineKm } from '@/lib/gemeinden/data';
import { loadGemeindenDe } from '@/lib/gemeinden/de';
import { DE_LAENDER } from '@/lib/gemeinden/laender-de';
import { slugifyBundesland } from '@/lib/hubs/gemeinde-hub-content';
import { getSite } from '@/lib/site';
import { SITES } from '@/lib/site/sites';

describe('deutsche Gemeinden für die Gemeinde-Seiten', () => {
  const de = buildGemeindenDe();

  it('jede Gemeinde mit Mittelpunkt kommt genau einmal vor, jeder Slug ist eindeutig', () => {
    const mitPunkt = loadGemeindenDe().filter(g => g.lat !== 0 || g.lng !== 0).length;
    expect(de).toHaveLength(mitPunkt);
    expect(de.length).toBeGreaterThan(10000);
    expect(new Set(de.map(g => g.slug)).size).toBe(de.length);
  });

  it('Slug ist Amts-PLZ und Name, bei Gleichheit mit Gemeindeschlüssel', () => {
    const berlin = de.find(g => g.name === 'Berlin')!;
    expect(berlin.slug).toMatch(/^\d{5}-berlin$/);
    expect(berlin.bundesland).toBe('Berlin');
    const garding = de.filter(g => g.name === 'Garding');
    expect(garding).toHaveLength(2);
    expect(garding.map(g => g.slug).sort()[0]).toBe('25836-garding');
    expect(garding.some(g => /^25836-garding-\d{8}$/.test(g.slug))).toBe(true);
  });

  it('Land als Name, Kreis als Bezirk, Punkt in Deutschland', () => {
    const namen = new Set(DE_LAENDER.map(l => l.name));
    for (const g of de) {
      if (!namen.has(g.bundesland)) throw new Error(`Land unbekannt: ${g.slug} ${g.bundesland}`);
      if (g.lat < 47.2 || g.lat > 55.1 || g.lng < 5.8 || g.lng > 15.1) throw new Error(`Punkt außerhalb: ${g.slug}`);
    }
    expect(de.find(g => g.name === 'Aachen')!.bezirk).toBe('Städteregion Aachen');
  });

  it('der Name des Landes führt zur Regionsseite', () => {
    if (getSite().country !== 'DE') return;
    expect(slugifyBundesland('Baden-Württemberg')).toBe('baden-wuerttemberg');
    expect(slugifyBundesland('Bayern')).toBe('bayern');
  });
});

describe('Städte-Chips von lasstreffen.de', () => {
  it('sind die acht einwohnerstärksten Gemeinden der Stammdatei, jeder Link führt zu einer Gemeinde-Seite', () => {
    const top = [...loadGemeindenDe()].sort((a, b) => b.einwohner - a.einwohner).slice(0, 8).map(g => g.name);
    const chips = SITES.DE.cityChips!;
    expect(chips.map(c => c.name)).toEqual(top);
    const slugs = new Set(buildGemeindenDe().map(g => g.slug));
    for (const c of chips) expect([c.href, slugs.has(c.href.replace('/gemeinde/', ''))]).toEqual([c.href, true]);
  });
});

describe('Gemeinden dieser Seite', () => {
  it('lasstreffen.at liest die österreichische Liste unverändert', () => {
    if (getSite().country !== 'AT') return;
    expect(siteGemeinden()).toBe(ALL_GEMEINDEN);
    expect(siteGemeindeBySlug('1010-wien')?.name).toBe('Wien');
    expect(siteGemeindeBySlug('25836-garding')).toBe(null);
    expect(slugifyBundesland('Niederösterreich')).toBe('niederoesterreich');
  });

  it('lasstreffen.de findet deutsche Gemeinden und ihre Nachbarn, keine österreichischen', () => {
    if (getSite().country !== 'DE') return;
    const g = siteGemeindeBySlug('25836-garding')!;
    expect(g.name).toBe('Garding');
    expect(siteGemeindeBySlug('1010-wien')).toBe(null);
    const n = siteNeighbourGemeinden(g, 8);
    expect(n).toHaveLength(8);
    for (const o of n) expect(haversineKm(g.lat, g.lng, o.lat, o.lng)).toBeLessThan(40);
    expect(n.some(o => o.slug === g.slug)).toBe(false);
  });
});

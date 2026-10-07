import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Gem2GoScraper } from '@/lib/scrapers/Gem2GoScraper';
import { GEM2GO_GEMEINDEN_LISTE } from '@/lib/scrapers/gemeinden/gem2goGemeinden';
import { withStammdaten } from '@/lib/scrapers/gemeinden/stammdaten';
import type { ScrapedEvent } from '@/types/events';

// Ausschnitte echter GEM2GO-Listen im Card-Layout (abgerufen 2026-10-07).
// Kopf jeder Karte: <span class="bemHeader">Titel</span><small>Kategorie</small>.
// Befund 2026-10-07: 1.928 künftige gem2go-Events hießen "TanzabendMusik, Konzerte".
const FIX = path.join(__dirname, 'fixtures', 'gem2go');
const read = (f: string) => fs.readFileSync(path.join(FIX, f), 'utf8');

const gemeinden = withStammdaten(GEM2GO_GEMEINDEN_LISTE);
type Gemeinde = (typeof gemeinden)[number];
const gemeinde = (name: string) => gemeinden.find((g) => g.name === name)!;

function parse(file: string, name: string): ScrapedEvent[] {
  const g = gemeinde(name);
  const url = `${g.website}/system/web/veranstaltung.aspx?sprache=1`;
  const scraper = new Gem2GoScraper() as unknown as {
    parseGem2GoPage(html: string, gemeinde: Gemeinde, pageUrl: string): ScrapedEvent[];
  };
  return scraper.parseGem2GoPage(read(file), g, url);
}

describe('Gem2GoScraper Card-Layout: Titel und Kategorie getrennt', () => {
  const pram = parse('pram-liste.html', 'Pram');
  const waldegg = parse('waldegg-liste.html', 'Waldegg');
  const strasswalchen = parse('strasswalchen-liste.html', 'Straßwalchen');

  it('liest den Titel ohne die Kategorie', () => {
    expect(pram.length).toBeGreaterThan(10);
    expect(pram.find((e) => e.title === 'Buchausstellung')).toMatchObject({ tags: ['Ausstellung'] });
    expect(pram.find((e) => e.title.startsWith('In der Furthmühle'))).toMatchObject({
      title: 'In der Furthmühle werden fünf interaktive Energie-Stationen gebaut',
      tags: ['Sonstige'],
    });
    expect(waldegg.find((e) => e.title.startsWith('Zirkeltraining'))).toMatchObject({
      title: 'Zirkeltraining - ASKÖ Waldegg',
      tags: ['Sport, Freizeit'],
    });
  });

  it('kein Titel endet mit der Kategorie seiner Karte', () => {
    for (const e of [...pram, ...waldegg, ...strasswalchen]) {
      expect(e.tags?.length).toBe(1);
      expect(e.title.endsWith(e.tags![0])).toBe(false);
    }
  });

  it('erkennt die Kategorie auch ohne Klasse text-muted', () => {
    // Straßwalchen rendert <small class="d-block"> statt <small class="d-block text-muted">.
    expect(strasswalchen.length).toBeGreaterThan(3);
    expect(strasswalchen.find((e) => e.title.startsWith('"Fit von Kopf bis Fuß"'))).toMatchObject({
      title: '"Fit von Kopf bis Fuß" - Ganzkörpertraining für jedes Alter',
      tags: ['Sport, Freizeit'],
    });
  });

  it('nimmt die Kürzung ", ..." der Liste nicht in die Kategorie', () => {
    const cut = waldegg.filter((e) => e.tags?.[0].startsWith('Musik, Konzerte'));
    expect(cut.length).toBeGreaterThan(0);
    for (const e of cut) expect(e.tags).toEqual(['Musik, Konzerte, Theater, Kabarett, Show']);
  });

  it('behält die source_id bestehender Events', () => {
    // Die IDs in Prod sind aus dem zusammengeklebten Kopf gebildet. Eine neue
    // ID gäbe neue Zeilen; die alten blieben mit Klebetitel sichtbar, weil der
    // Rückzug Events mit geteilter Listen-URL nicht prüfen kann.
    expect(pram.find((e) => e.title === 'Buchausstellung')?.source_id).toBe('gem2go-4742-buchausstellungausstellung');
    expect(waldegg.find((e) => e.title.startsWith('Zirkeltraining'))?.source_id).toBe(
      'gem2go-2754-zirkeltraining-ask-waldeggsport-freizeit',
    );
  });
});

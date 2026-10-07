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

  it('meldet die bisherige ID, damit der Schreibpfad die alte Zeile übernimmt', () => {
    // Die IDs in Prod sind aus dem zusammengeklebten Kopf gebildet, ohne Datum.
    for (const e of pram.filter((x) => x.title === 'Buchausstellung')) {
      expect(e.previous_source_id).toBe('gem2go-4742-buchausstellungausstellung');
    }
    expect(waldegg.find((e) => e.title.startsWith('Zirkeltraining'))?.previous_source_id).toBe(
      'gem2go-2754-zirkeltraining-ask-waldeggsport-freizeit',
    );
  });
});

describe('Gem2GoScraper Card-Layout: eine Zeile je Termin', () => {
  const pram = parse('pram-liste.html', 'Pram');
  const waldegg = parse('waldegg-liste.html', 'Waldegg');
  const strasswalchen = parse('strasswalchen-liste.html', 'Straßwalchen');
  const ruestorf = parse('ruestorf-liste.html', 'Rüstorf');

  it('verliert keinen Termin: jede Karte bekommt eine eigene source_id', () => {
    // Bisher teilten sich gleichnamige Termine eine ID, der Sync behielt den ersten.
    for (const [events, cards] of [[pram, 18], [waldegg, 10], [strasswalchen, 6], [ruestorf, 4]] as const) {
      expect(events).toHaveLength(cards);
      expect(new Set(events.map((e) => e.source_id)).size).toBe(cards);
    }
    expect(pram.filter((e) => e.title === 'Buchausstellung').map((e) => e.source_id)).toEqual([
      'gem2go-4742-228563044-2026-10-10',
      'gem2go-4742-228563050-2026-10-11',
      'gem2go-4742-228563063-2026-10-11',
    ]);
    // Dieselbe detailonr an zwei Tagen.
    expect(pram.filter((e) => e.title === 'Leopoldimarkt').map((e) => e.source_id)).toEqual([
      'gem2go-4742-228527789-2026-11-14',
      'gem2go-4742-228527789-2026-11-15',
    ]);
  });

  it('verlinkt die Detailseite statt der Liste', () => {
    expect(pram[0].source_url).toBe(
      'https://www.pram.at/system/web/veranstaltung.aspx?detailonr=228563044&sprache=1&menuonr=223812352',
    );
    // SEO-URL ohne detailonr: der Pfad ist der Schlüssel.
    expect(strasswalchen[0]).toMatchObject({
      source_url: 'http://www.strasswalchen.at/Fit_von_Kopf_bis_Fuss_-_Ganzkoerpertraining_fuer_jedes_Alter_2',
      source_id: 'gem2go-5204-fit-von-kopf-bis-fuss-ganzkoerpertraining-fuer-jedes-alter-2-2026-10-08',
    });
    for (const e of [...pram, ...waldegg, ...strasswalchen, ...ruestorf]) {
      expect(e.source_url).not.toMatch(/veranstaltung\.aspx\?sprache=1$/);
    }
  });

  it('nimmt keine fremde Website als Detailseite', () => {
    // Hirschbach verlinkt den Vereinsausflug direkt auf die Website des Musikvereins.
    const g = gemeinde('Hirschbach im Mühlkreis');
    const listUrl = `${g.website}/system/web/veranstaltung.aspx?sprache=1`;
    const events = parse('hirschbach-liste.html', 'Hirschbach im Mühlkreis');
    const ausflug = events.filter((e) => e.title === '2-Tagesausflug des Musikvereines');
    expect(ausflug).toHaveLength(2);
    for (const e of ausflug) expect(e.source_url).toBe(listUrl);
    // Ohne eigene Detailseite: Titel und Tag bilden die ID.
    expect(new Set(ausflug.map((e) => e.source_id)).size).toBe(2);
    expect(ausflug[0].source_id).toMatch(/^gem2go-4242-2-tagesausflug-des-musikvereines-2026-\d\d-\d\d$/);
    expect(events.find((e) => e.title !== '2-Tagesausflug des Musikvereines')?.source_url).toContain('detailonr=228563122');
  });

  it('liest Datum und Uhrzeit aus dem Terminblock', () => {
    expect(pram[0].start_date).toBe('2026-10-10T14:00');
    expect(pram.find((e) => e.title.startsWith('Perchtenlauf'))?.start_date).toBe('2026-11-29T17:30');
    // "Ganztägig": nur der Tag.
    expect(pram.find((e) => e.title.startsWith('In der Furthmühle'))?.start_date).toBe('2026-10-11');
    // Straßwalchen: erstes Datumsfeld ist die Bild-Plakette "08Okt" ohne Jahr.
    expect(strasswalchen[0].start_date).toBe('2026-10-08T08:30');
    // Kurztext "Anmeldung telefonisch bis 09. Oktober 2026" ist nicht der Termin.
    expect(ruestorf.find((e) => e.title === 'Rüstorfer Kinderflohmarkt')?.start_date).toBe('2026-10-10T09:00');
  });
});

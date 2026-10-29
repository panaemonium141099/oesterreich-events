/**
 * Bilder der DE-Adapter (Entscheidung 2026-10-29): Bild der Quelle mit
 * Website als Bildnachweis und Link auf die Detailseite; Logo, Wappen und
 * Platzhalter fallen weg. Golden-Tests auf echten Feeds (Amt
 * Sandesneben-Nusse, Bergenhusen, Langenselbold, Artlenburg).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageCredit, imageUrl, placeholderImages, withoutPlaceholderImages } from '@/lib/scrapers/de/bild';
import { ionasDetailUrl, parseIonasIcs } from '@/lib/scrapers/de/ionas';
import { IonasDeScraper } from '@/lib/scrapers/de/IonasDeScraper';
import { parseEmIcs } from '@/lib/scrapers/de/em';
import { EventsManagerDeScraper } from '@/lib/scrapers/de/EventsManagerDeScraper';
import { parseTribePage } from '@/lib/scrapers/de/tribe';
import { TribeDeScraper } from '@/lib/scrapers/de/TribeDeScraper';
import type { FeedGroup } from '@/lib/registry-de/load';

const fx = (dir: string, f: string) => readFileSync(join(__dirname, 'fixtures', dir, f), 'utf8');

const group = (feedUrl: string, pageUrl: string): FeedGroup => ({
  feedUrl, pageUrl, own: [{ ags: '01053114', land: 'schleswig-holstein' }], viaVerband: [],
} as unknown as FeedGroup);

describe('imageUrl: Logo, Wappen und Vektorgrafik sind kein Eventbild', () => {
  it.each([
    'https://www.amt-sn.de/bilder/gemeindewappen/sandesneben.svg?cid=17kj.a98a',
    'https://www.amt-sn.de/bilder/zv-wasser/zv-wasser-logo.jpg',
    'https://www.amt-sn.de/bilder/gemeindewappen/klinkrade-wappen.png',
    'https://bergenhusen.de/wp-content/uploads/2020/03/feuerwehr_wappen-35a2acf9-84ef8e6f@160w.jpg',
    'https://bergenhusen.de/wp-content/uploads/2020/03/cropped-500px-Bergenhusen_Wappen.svg_.png',
    'https://bergenhusen.de/wp-content/uploads/2020/03/DRK-Logo_aLzM-6ba447a8-84ef8e6f@160w.jpg',
    'https://langenselbold.de/wp-content/uploads/logo-krippenhaus-langenselbold.webp',
    'https://artlenburg.de/wp-content/uploads/LF-LOGO-Veranstaltungen.png',
    'https://example.de/x/stock-ai-generated-123.jpg',
    'data:image/png;base64,AAAA',
  ])('%s', url => {
    expect(imageUrl(url)).toBeUndefined();
  });

  it('Fotos bleiben, auch wenn „logo" nur Teil eines Wortes ist', () => {
    const u = 'https://www.amt-sn.de/kalender/2026-amt/oktober/2026-10-29-amts-senioren-kaffee-in-steinhorst/seniorentreffen-1.png?cid=19wd.acrm';
    expect(imageUrl(u)).toBe(u);
    expect(imageUrl('https://example.de/bilder/ökologie-tag.jpg')).toBe('https://example.de/bilder/%C3%B6kologie-tag.jpg');
  });
});

describe('Platzhalter: dasselbe Bild an drei verschiedenen Terminen', () => {
  it('Bergenhusen: Gemeindewappen an Sitzung, Essen und Weihnachtsmarkt fällt weg, Reihe mit gleichem Titel bleibt', () => {
    const evs = parseEmIcs(fx('em', 'bergenhusen.ics'));
    const bad = placeholderImages(evs);
    expect([...bad].some(u => u.includes('Bergenhusen_Wappen'))).toBe(true);
    const langen = parseEmIcs(fx('em', 'langenselbold.ics'));
    // „Langenselbolder Wochenmarkt" fünfmal mit demselben Foto: eine Reihe.
    expect([...placeholderImages(langen)].some(u => u.includes('FB_IMG_1706979067839'))).toBe(false);
    const kept = withoutPlaceholderImages(evs).find(e => e.title === 'Weihnachtsmarkt mit Adventsausstellung')!;
    expect(kept.image).toBeUndefined();
  });
});

describe('ionas: Bild aus ATTACH, Detailseite aus dem Bildordner', () => {
  const feed = 'https://www.amt-sn.de/kalender/events.json?weekends=false&tagMode=ALL';
  const g = group(feed, 'https://www.amt-sn.de/verwaltung/kalender/');

  it('Bild im Ordner des Termins: Detailseite, Bildnachweis die Website', () => {
    const ev = parseIonasIcs(fx('ionas', 'amt-sn.ics')).find(e => e.title === 'Amts-Senioren-Kaffee in Steinhorst')!;
    const row = new IonasDeScraper().toScraped(ev, g);
    expect(row.source_url).toBe('https://www.amt-sn.de/kalender/2026-amt/oktober/2026-10-29-amts-senioren-kaffee-in-steinhorst/');
    expect(row.image_url).toMatch(/seniorentreffen-1\.png/);
    expect(row.image_credit).toBe('amt-sn.de');
  });

  it('Wappen an der Sitzung: kein Bild, Quelle bleibt die Kalenderseite', () => {
    const ev = parseIonasIcs(fx('ionas', 'amt-sn.ics')).find(e => e.title.startsWith('Sitzung des Finanz- und Planungsausschusses'))!;
    const row = new IonasDeScraper().toScraped(ev, g);
    expect(row.image_url).toBeUndefined();
    expect(row.image_credit).toBeUndefined();
    expect(row.source_url).toBe('https://www.amt-sn.de/verwaltung/kalender/');
  });

  it('Bild außerhalb des Kalenders oder auf fremdem Host ist keine Detailseite', () => {
    expect(ionasDetailUrl(feed, 'https://www.amt-sn.de/bilder/allgemein/flisanu-klein.jpg')).toBeUndefined();
    expect(ionasDetailUrl(feed, 'https://cdn.example/kalender/2026-10-29-x/a.jpg')).toBeUndefined();
    expect(ionasDetailUrl(feed, undefined)).toBeUndefined();
  });
});

describe('Tribe: Beitragsbild mit Maßen, Titel ohne HTML', () => {
  const g = group('https://artlenburg.de/wp-json/tribe/events/v1/events', 'https://artlenburg.de/termine/');
  const { events } = parseTribePage(fx('tribe', 'artlenburg.json'));

  it('Foto mit Maßen und Bildnachweis', () => {
    const ev = events.find(e => e.title === 'Gottesdienst am Volkstrauertag')!;
    const row = new TribeDeScraper().toScraped(ev, g);
    expect(row).toMatchObject({
      image_url: 'https://artlenburg.de/wp-content/uploads/Artlenburg-Kirche.jpeg',
      image_width: 1280,
      image_credit: 'artlenburg.de',
    });
    expect(row.source_url).toMatch(/^https:\/\/artlenburg\.de\/termine\//);
  });

  it('Logo der LandFrauen: kein Bild', () => {
    const ev = events.find(e => e.title.startsWith('LandFrauen: gemeinsamer'))!;
    expect(new TribeDeScraper().toScraped(ev, g).image_url).toBeUndefined();
  });

  it('durchgestrichener Titel („Pausiert: <s>Spiele-Abend</s>") findet nicht statt, kein Titel trägt HTML', () => {
    expect(events.some(e => /Spiele-Abend/.test(e.title))).toBe(false);
    for (const e of events) expect(e.title).not.toMatch(/[<>]/);
  });
});

describe('Events Manager: Bild aus ATTACH ohne Typangabe', () => {
  it('Langenselbold: Foto übernommen, Bildnachweis die Website der Detailseite', () => {
    const ev = parseEmIcs(fx('em', 'langenselbold.ics')).find(e => e.title === 'Hot Stuff feat. BABA Explosion')!;
    const g = group('https://langenselbold.de/events.ics', 'https://langenselbold.de/veranstaltungen/');
    const row = new EventsManagerDeScraper().toScraped(ev, g);
    expect(row.image_url).toMatch(/07\.11-web\.webp$/);
    expect(row.image_credit).toBe(imageCredit(row.source_url!));
  });
});

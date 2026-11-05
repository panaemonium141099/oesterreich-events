/**
 * Zähler je Kalender (kalender-stand.ts) und Aufteilung der Gemeinden ohne
 * Termin nach Ursache (coverage-causes.ts).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildUrsachen } from '@/lib/pipeline/coverage-causes';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { FeedGroup } from '@/lib/registry-de/load';
import { DE_SCRAPERS } from '@/lib/scrapers/de';
import { DeFeedScraper } from '@/lib/scrapers/de/feed-scraper';
import { resetHostGate } from '@/lib/scrapers/de/host-gate';
import { fehlerGrund, KalenderZaehler, mergeKalenderStand, zaehleTermine, type KalenderZeile } from '@/lib/scrapers/de/kalender-stand';
import type { ScrapedEvent } from '@/types/events';

const entry = (ags: string): RegistryEntryDe => ({ ags, name: ags, land: 'bayern', host: 'a.de', stufe: 'A', integration: 'ionas', url: 'https://a.de/k', checked_at: '2026-10-28' });
const group = (url: string, ...ags: string[]): FeedGroup => ({ feedUrl: url, pageUrl: url, own: ags.map(entry), viaVerband: [] });

class TestScraper extends DeFeedScraper {
  readonly name = 'de-test';
  readonly integrations = ['test'];
  protected delayMs = 0;
  override resumesSourceList = false;
  constructor(private readonly groups: FeedGroup[], private readonly lesen = true) {
    super();
  }
  async scrape(): Promise<ScrapedEvent[]> {
    this.planCalendars(this.groups);
    if (!this.lesen) return [];
    for (const g of this.groups) await this.inCalendar(g, async () => {
      const body = await this.fetchFeed(g.feedUrl);
      if (body == null) return;
      this.noteTermine(JSON.parse(body));
    });
    return [];
  }
}

const zeile = (z: Partial<KalenderZeile>): KalenderZeile => ({
  adapter: 'de-a', url: 'https://a.de/k', gemeinden: ['1'], ergebnis: 'gelesen', abrufe: 1, fehlgeschlagen: 0, termine: 0, kommend: 0, at: '2026-11-04T01:00:00.000Z', ...z,
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetHostGate();
});

describe('Zähler im Abruf', () => {
  const fetchMit = (antworten: Record<string, Response | Error>) => vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
    const a = antworten[url];
    if (a instanceof Error) throw a;
    return a.clone();
  });

  it('zählt Termine und kommende je Kalender, HTTP-Fehler und Netzfehler mit Grund', async () => {
    vi.stubGlobal('fetch', fetchMit({
      'https://a.de/k': new Response(JSON.stringify([{ start: '2020-01-01T10:00:00+01:00' }, { start: '2099-01-01T10:00:00+01:00' }])),
      'https://b.de/k': new Response('[]'),
      'https://c.de/k': new Response('', { status: 404, statusText: 'Not Found' }),
      'https://d.de/k': new Error('fetch failed'),
    }));
    const s = new TestScraper([group('https://a.de/k', '1'), group('https://b.de/k', '2'), group('https://c.de/k', '3'), group('https://d.de/k', '4')]);
    (s as unknown as { maxRetries: number }).maxRetries = 1;
    await s.scrape();
    const r = Object.fromEntries(s.kalenderBericht().map(z => [z.url, z]));
    expect(r['https://a.de/k']).toMatchObject({ ergebnis: 'gelesen', termine: 2, kommend: 1, gemeinden: ['1'] });
    expect(r['https://b.de/k']).toMatchObject({ ergebnis: 'gelesen', termine: 0, kommend: 0 });
    expect(r['https://c.de/k']).toMatchObject({ ergebnis: 'fehler', grund: 'HTTP 404' });
    expect(r['https://d.de/k']).toMatchObject({ ergebnis: 'fehler', grund: 'Netzfehler' });
  });

  it('robots.txt-Sperre ist kein Fehler und zählt nicht als gelesen', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('User-agent: *\nDisallow: /', { status: 200 })));
    const s = new TestScraper([group('https://a.de/k', '1')]);
    await s.scrape();
    expect(s.kalenderBericht()[0]).toMatchObject({ ergebnis: 'robots', abrufe: 0 });
  });

  it('nicht betretene Kalender: Cursor-Adapter „nicht dran“, sonst „nicht erreicht“', async () => {
    const ohne = new TestScraper([group('https://a.de/k', '1')], false);
    await ohne.scrape();
    expect(ohne.kalenderBericht()[0].ergebnis).toBe('nicht_erreicht');
    const mit = new TestScraper([group('https://a.de/k', '1')], false);
    mit.resumesSourceList = true;
    await mit.scrape();
    expect(mit.kalenderBericht()[0].ergebnis).toBe('nicht_dran');
  });

  it('außerhalb eines Kalenders zählt nichts (Tests, Einzelaufrufe)', () => {
    expect(() => zaehleTermine([{ start: '2099-01-01T10:00:00Z' }])).not.toThrow();
  });

  it('zwei Einträge auf einem Kalender: die Termine gelten für beide', async () => {
    const z = new KalenderZaehler();
    const a = group('https://a.de/start', '1');
    const b = group('https://a.de/veranstaltungen', '2');
    await z.run(a, async () => zaehleTermine([{ start: '2099-01-01T10:00:00Z' }]));
    await z.run(b, async () => z.gleichWie(b, a));
    const r = z.bericht('de-x', { cursor: false, budgetVerbraucht: false, at: new Date() });
    expect(r.find(x => x.url.endsWith('veranstaltungen'))).toMatchObject({ ergebnis: 'gelesen', termine: 1, kommend: 1 });
  });

  it('Budget mitten im Kalender ohne Termin gilt als Budget, mit Terminen als gelesen', async () => {
    const z = new KalenderZaehler();
    const a = group('https://a.de/1', '1');
    await z.run(a, async () => { const { aktuellerKalender } = await import('@/lib/scrapers/de/kalender-stand'); const k = aktuellerKalender()!; k.abrufe = 1; k.budget = true; });
    expect(z.bericht('x', { cursor: false, budgetVerbraucht: true, at: new Date() })[0].ergebnis).toBe('budget');
  });

  it('Fehlermeldungen werden zu zählbaren Gründen', () => {
    expect(fehlerGrund('HTTP 403: Forbidden')).toBe('HTTP 403');
    expect(fehlerGrund('Timeout nach 15000ms für https://a.de')).toBe('Timeout');
    expect(fehlerGrund('timeout')).toBe('Timeout');
    expect(fehlerGrund('kein HTML (application/pdf)')).toBe('kein HTML');
    expect(fehlerGrund('fetch failed')).toBe('Netzfehler');
  });
});

describe('Jeder DE-Adapter geht denselben Weg', () => {
  it('jeder Adapter liest in inCalendar und meldet Termine', () => {
    const dir = join(process.cwd(), 'src/lib/scrapers/de');
    const files = readdirSync(dir).filter(f => f.endsWith('DeScraper.ts') && f !== 'AmtVgDeScraper.ts');
    expect(files.length).toBeGreaterThanOrEqual(DE_SCRAPERS.length - 2);
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).toContain('this.inCalendar(');
      expect(src, f).toContain('this.noteTermine(');
    }
  });

  it('der Workflow reicht den Stand vom Shard in die Nachbearbeitung und in die nächste Nacht', () => {
    const wf = readFileSync(join(process.cwd(), '.github/workflows/scrape-events-de.yml'), 'utf8');
    expect(wf).toContain('name: de-kalender-shard-${{ matrix.shard }}');
    expect(wf).toContain('pattern: de-kalender-shard-*');
    expect(wf).toContain('name: de-kalender-stand');
    expect(wf).toContain('-n de-kalender-stand -D reports/kalender-vorher');
    expect(existsSync(join(process.cwd(), 'src/scripts/coverage-report.ts'))).toBe(true);
  });
});

describe('mergeKalenderStand', () => {
  const now = new Date('2026-11-05T01:00:00Z');

  it('„nicht dran“ behält das letzte echte Ergebnis', () => {
    const vorher = [zeile({ ergebnis: 'gelesen', termine: 4, kommend: 2 })];
    const heute = [zeile({ ergebnis: 'nicht_dran', at: now.toISOString() })];
    expect(mergeKalenderStand(vorher, heute, now)[0]).toMatchObject({ ergebnis: 'gelesen', kommend: 2, at: vorher[0].at });
  });

  it('nach 45 Tagen gilt das alte Ergebnis nicht mehr', () => {
    const vorher = [zeile({ ergebnis: 'gelesen', at: '2026-09-01T01:00:00.000Z' })];
    const heute = [zeile({ ergebnis: 'nicht_dran', at: now.toISOString() })];
    expect(mergeKalenderStand(vorher, heute, now)[0].ergebnis).toBe('nicht_dran');
  });

  it('ein echtes Ergebnis von heute ersetzt das alte', () => {
    const r = mergeKalenderStand([zeile({ termine: 9, kommend: 9 })], [zeile({ ergebnis: 'fehler', grund: 'HTTP 500', at: now.toISOString() })], now);
    expect(r[0]).toMatchObject({ ergebnis: 'fehler', grund: 'HTTP 500' });
  });

  it('Adapter ohne Bericht behält seinen Stand, weggefallene Kalender eines Adapters mit Bericht fallen weg', () => {
    const vorher = [zeile({ adapter: 'de-a', url: 'https://a.de/alt' }), zeile({ adapter: 'de-b', url: 'https://b.de/k' })];
    const heute = [zeile({ adapter: 'de-a', url: 'https://a.de/neu' })];
    expect(mergeKalenderStand(vorher, heute, now).map(z => z.url).sort()).toEqual(['https://a.de/neu', 'https://b.de/k']);
  });
});

describe('buildUrsachen', () => {
  const basis = {
    sichtbar: new Set<string>(),
    zurueckgehalten: new Set<string>(),
    adapterVon: new Map<string, string[]>(),
  };
  const g = (id: string, integration = 'ionas') => ({ id, region: 'bayern', integration });

  it('jede Ursache einmal, Gemeinden mit Termin zählen nicht', () => {
    const b = buildUrsachen({
      ...basis,
      gemeinden: ['0', '1', '2', '3', '4', '5', '6', '7', '8'].map(id => g(id)),
      sichtbar: new Set(['0']),
      zurueckgehalten: new Set(['1']),
      adapterVon: new Map([['8', ['de-a']]]),
      stand: [
        zeile({ gemeinden: ['1'], kommend: 1, termine: 1 }),
        zeile({ gemeinden: ['2'], kommend: 3, termine: 3 }),
        zeile({ gemeinden: ['3'], termine: 5 }),
        zeile({ gemeinden: ['4'] }),
        zeile({ gemeinden: ['5'], ergebnis: 'nicht_dran', abrufe: 0 }),
        zeile({ gemeinden: ['6'], ergebnis: 'fehler', grund: 'HTTP 403', abrufe: 0 }),
      ],
    });
    expect(b.ohneTermin).toBe(8);
    const of = (id: string) => b.gemeinden.find(x => x.id === id);
    expect(of('0')).toBeUndefined();
    expect(of('1')?.ursache).toBe('zurueckgehalten');
    expect(of('2')?.ursache).toBe('kommend_anderswo');
    expect(of('3')?.ursache).toBe('nur_vergangene');
    expect(of('4')?.ursache).toBe('leer');
    expect(of('5')?.ursache).toBe('noch_nicht_dran');
    expect(of('6')).toMatchObject({ ursache: 'nicht_gelesen', grund: 'HTTP 403' });
    expect(of('7')).toMatchObject({ ursache: 'nicht_im_nachtlauf', grund: 'ionas' });
    expect(of('8')).toMatchObject({ ursache: 'nicht_gelesen', adapter: 'de-a', grund: 'kein Kalender des Adapters' });
    expect(b.nichtGelesen).toEqual({ 'HTTP 403': 1, 'kein Kalender des Adapters': 1 });
    // Die Summe stimmt mit den Gemeinden ohne Termin überein.
    expect(Object.values(b.gesamt).reduce((a, n) => a + (n ?? 0), 0)).toBe(b.ohneTermin);
  });

  it('mehrere Kalender: die Ursache, die einem Termin am nächsten ist', () => {
    const b = buildUrsachen({
      ...basis,
      gemeinden: [g('1')],
      stand: [
        zeile({ gemeinden: ['1'], ergebnis: 'fehler', grund: 'Timeout', abrufe: 0 }),
        zeile({ gemeinden: ['1'], adapter: 'de-b', termine: 2 }),
      ],
    });
    expect(b.gemeinden[0]).toMatchObject({ ursache: 'nur_vergangene', adapter: 'de-b' });
  });

  it('zurückgehaltene Zeilen ohne Ort zählen nur beim Kalender genau einer Gemeinde', () => {
    const b = buildUrsachen({
      ...basis,
      gemeinden: [g('1'), g('2')],
      zurueckgehaltenWebsites: new Set(['de-a|a.de']),
      stand: [zeile({ gemeinden: ['1'], kommend: 2, termine: 2 }), zeile({ url: 'https://www.a.de/amt', gemeinden: ['2', '3'], kommend: 2, termine: 2 })],
    });
    expect(b.gemeinden.find(x => x.id === '1')?.ursache).toBe('zurueckgehalten');
    expect(b.gemeinden.find(x => x.id === '2')?.ursache).toBe('kommend_anderswo');
  });

  it('Adapter ohne jeden Bericht wird genannt, nicht als fehlender Feed gezählt', () => {
    const b = buildUrsachen({ ...basis, gemeinden: [g('1')], adapterVon: new Map([['1', ['de-x']]]), stand: [zeile({ gemeinden: ['2'] })] });
    expect(b.gemeinden[0]).toMatchObject({ ursache: 'nicht_gelesen', grund: 'kein Bericht des Adapters' });
  });
});

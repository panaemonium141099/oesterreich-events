/**
 * veranstaltungskalender.net: jede Liste bis zur letzten Seite.
 *
 * Befund 2026-10-14: 1.593 Listenseiten (Wien 330, OÖ 447), je Seite nur
 * 1 bis 4 Einträge. Der Scraper brach je Bundesland bei 200 Seiten ab; die
 * Wiener Gutscheine mit Datum 31.12.2037 (Seite ~290 bis 325) kamen seit
 * Juli nicht mehr an und blieben veröffentlicht, obwohl die Quarantäne
 * start_too_far_ahead sie beim Upsert zurückhält. Ein voller Lauf dauert
 * ~26 min, länger als der Standard-Timeout von 25 min.
 *
 * Fixtures: Wien Seite 1 und 290, abgerufen 2026-10-17.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  VeranstaltungskalenderNetScraper,
  lastListPage,
} from '@/lib/scrapers/VeranstaltungskalenderNetScraper';
import { timeoutMsFor } from '@/lib/scrapers';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'latin1');
const BASE = 'https://www.veranstaltungskalender.net';

interface Entry { id: number; title: string; date: string }

/** Listenseite im Markup der Quelle; `last` setzt den Pager-Link. */
function listPage(region: string, entries: Entry[], last?: number): string {
  const items = entries.map(e => `
    <div class="global_listeneintrag seiten_div_bottom" itemscope itemtype="http://schema.org/Event">
      <a href="${BASE}/${region}/ort/${e.title.toLowerCase().replace(/\W+/g, '-')}-${e.id}.html">
        <div class="text_block">
          <h2 class="eintrag_titel" itemprop="name">${e.title}</h2>
          <div class="ver_zeit">${e.date}, 19:30 Uhr</div>
        </div>
      </a>
    </div>`).join('');
  const ad = '<div class="global_listeneintrag"><div class="werbung_liste"></div></div>';
  const pager = last ? `<a href="${BASE}/${region}/?seite=${last}" class="icon-last"> </a>` : '';
  return `<html><body>${items}${ad}${pager}</body></html>`;
}

type Site = Record<string, (page: number) => string>;

/** Scraper gegen eine nachgebaute Quelle, ohne Netz und ohne Pausen. */
class FakeSite extends VeranstaltungskalenderNetScraper {
  readonly requested: string[] = [];
  constructor(private readonly site: Site, private readonly onFetch?: () => void) { super(); }
  protected async fetchPage(url: string): Promise<string> {
    this.requested.push(url);
    this.onFetch?.();
    const m = url.match(/^https:\/\/www\.veranstaltungskalender\.net\/([^/]+)\/(?:\?seite=(\d+))?$/);
    if (!m) throw new Error(`unerwartete URL ${url}`);
    const render = this.site[m[1]];
    return render ? render(Number(m[2] ?? 1)) : listPage(m[1], []);
  }
  protected async sleep(): Promise<void> {}
  protected log(): void {}
}

const pageOf = (url: string) => Number(url.match(/seite=(\d+)/)?.[1] ?? 1);
const regionOf = (url: string) => url.split('/')[3];

describe('lastListPage', () => {
  it('liest die letzte Seite aus dem Pager der echten Wiener Liste', () => {
    expect(lastListPage(fixture('vknet-wien-seite-1.html'))).toBe(319);
  });

  it('null ohne Pager-Link (nur eine Seite oder anderes Markup)', () => {
    expect(lastListPage(listPage('wien', [{ id: 1, title: 'Konzert', date: 'Sa 17.10.2026' }]))).toBeNull();
  });
});

describe('VeranstaltungskalenderNetScraper Seitenfolge', () => {
  afterEach(() => vi.restoreAllMocks());

  it('liest Wien bis Seite 330 und liefert die 2037er Gutscheine mit unveränderter source_id', async () => {
    const voucherPage = fixture('vknet-wien-seite-290.html');
    const s = new FakeSite({
      wien: page => page === 290
        ? voucherPage
        : listPage('wien', [{ id: 800000 + page, title: `Termin ${page}`, date: 'Sa 17.10.2026' }], 330),
    });
    const events = await s.scrape();

    const wien = s.requested.filter(u => regionOf(u) === 'wien').map(pageOf);
    expect(Math.max(...wien)).toBe(330);
    expect(new Set(wien).size).toBe(330);

    const vouchers = events.filter(e => e.start_date.startsWith('2037-12-31'));
    expect(vouchers.map(e => e.source_id).sort()).toEqual(['vknet-262248', 'vknet-262488', 'vknet-262617']);
    expect(vouchers.every(e => e.source_name === 'veranstaltungskalender.net' && e.bundesland === 'wien')).toBe(true);
  }, 30_000); // 330 Seiten parsen: allein ~2 s, unter voller Suite länger

  it('fragt keine Seite jenseits des Pagers ab', async () => {
    const s = new FakeSite({
      tirol: page => listPage('tirol', [{ id: 900 + page, title: `Tirol ${page}`, date: 'Fr 23.10.2026' }], 3),
    });
    await s.scrape();
    expect(s.requested.filter(u => regionOf(u) === 'tirol').map(pageOf)).toEqual([1, 2, 3]);
  });

  it('eine Seite, deren Einträge der Parser verwirft, beendet die Liste nicht', async () => {
    // Wien 2026-10-17, Seite 228 bis 231: nur ein Titel über 200 Zeichen.
    const longTitle = `Beratungstage ${'x'.repeat(220)}`;
    const s = new FakeSite({
      wien: page => listPage('wien', [
        page >= 3 && page <= 6
          ? { id: 700, title: longTitle, date: 'Mi 30.12.2026' }
          : { id: 600 + page, title: `Wien ${page}`, date: 'Mi 30.12.2026' },
      ], 8),
    });
    const events = await s.scrape();
    expect(events.map(e => e.source_id)).toEqual(expect.arrayContaining(['vknet-607', 'vknet-608']));
    expect(events.some(e => e.source_id === 'vknet-700')).toBe(false);
  });

  it('ohne Pager endet die Liste an zwei Seiten ohne Eintrag', async () => {
    const s = new FakeSite({
      salzburg: page => listPage('salzburg', page <= 3 ? [{ id: 500 + page, title: `Sbg ${page}`, date: 'Do 22.10.2026' }] : []),
    });
    const events = await s.scrape();
    expect(s.requested.filter(u => regionOf(u) === 'salzburg').map(pageOf)).toEqual([1, 2, 3, 4, 5]);
    expect(events.filter(e => e.bundesland === 'salzburg')).toHaveLength(3);
  });

  it('liest die Bundesländer im Wechsel und liefert bei Budget-Ende ein Teilergebnis', async () => {
    // Jeder Abruf kostet eine Minute: das Budget reicht für BUDGET_MIN Seiten.
    const start = Date.parse('2026-10-17T03:20:00Z');
    let fetches = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => start + fetches * 60_000);
    const regions = ['oberoesterreich', 'steiermark', 'niederoesterreich', 'salzburg', 'kaernten', 'tirol', 'vorarlberg', 'wien'];
    const site: Site = Object.fromEntries(regions.map((r, i) => [
      r,
      (page: number) => listPage(r, [{ id: i * 10_000 + page, title: `${r} ${page}`, date: 'Sa 24.10.2026' }], 400),
    ]));
    const s = new FakeSite(site, () => { fetches++; });
    const events = await s.scrape();

    const budget = VeranstaltungskalenderNetScraper.BUDGET_MIN;
    expect(s.requested).toHaveLength(budget);
    expect(s.requested.slice(0, regions.length).map(regionOf)).toEqual(regions);
    const deepest = regions.map(r => Math.max(...s.requested.filter(u => regionOf(u) === r).map(pageOf)));
    expect(Math.max(...deepest) - Math.min(...deepest)).toBeLessThanOrEqual(1);
    expect(events).toHaveLength(budget);
  });
});

describe('Zeitbudget unter dem harten Timeout', () => {
  it('lässt dem Sync mindestens fünf Minuten', () => {
    const budgetMs = VeranstaltungskalenderNetScraper.BUDGET_MIN * 60_000;
    expect(timeoutMsFor('veranstaltungskalender.net') - budgetMs).toBeGreaterThanOrEqual(5 * 60_000);
  });
});

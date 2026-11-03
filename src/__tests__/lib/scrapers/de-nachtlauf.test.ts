/**
 * Nachtlauf der DE-Gemeinde-Adapter (fn-29.18): Schalter, Shard-Aufteilung,
 * Sperre je Website, Zeitbudget und Fortsetzungs-Cursor.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import { DE_SCRAPERS } from '@/lib/scrapers/de';
import { DeFeedScraper } from '@/lib/scrapers/de/feed-scraper';
import { hostKey, resetHostGate, throughHostGate } from '@/lib/scrapers/de/host-gate';
import {
  adapterHosts,
  DE_NACHTLAUF,
  DE_SHARD_COUNT,
  DE_SOFT_BUDGET_MIN,
  DE_TIMEOUT_MIN,
  deNachtlaufScrapers,
  deShardPlan,
  getDeScrapersForShard,
} from '@/lib/scrapers/de/nachtlauf';
import { timeoutMsFor } from '@/lib/scrapers';
import type { ScrapedEvent } from '@/types/events';

const workflow = readFileSync(join(process.cwd(), '.github/workflows/scrape-events-de.yml'), 'utf8');
const atWorkflow = readFileSync(join(process.cwd(), '.github/workflows/scrape-events.yml'), 'utf8');

describe('Schalter DE_NACHTLAUF', () => {
  it('jeder Adapter steht in DE_SCRAPERS und hat seinen Prüfstand-Bericht auf master', () => {
    for (const [name, bericht] of Object.entries(DE_NACHTLAUF)) {
      expect(DE_SCRAPERS.some(s => s.name === name), name).toBe(true);
      expect(existsSync(join(process.cwd(), 'docs/research/de-gemeinden', bericht)), bericht).toBe(true);
    }
  });

  it('nolis (Lizenzquelle) läuft nicht nachts', () => {
    expect(Object.keys(DE_NACHTLAUF)).not.toContain('de-nolis');
  });

  it('jeder Adapter nennt seine Integrationen', () => {
    for (const s of deNachtlaufScrapers()) expect(s.integrations.length, s.name).toBeGreaterThan(0);
  });

  it('harte Grenze über dem Zeitbudget, Job-Grenze darüber, Budget im Workflow gesetzt', () => {
    expect(timeoutMsFor('de-ikiss')).toBe(DE_TIMEOUT_MIN * 60_000);
    expect(DE_TIMEOUT_MIN).toBeGreaterThan(DE_SOFT_BUDGET_MIN);
    const job = workflow.slice(workflow.indexOf('  scrape-de:'), workflow.indexOf('  post:'));
    expect(job).toContain(`SCRAPER_SOFT_BUDGET_MIN: ${DE_SOFT_BUDGET_MIN}`);
    expect(Number(/timeout-minutes: (\d+)/.exec(job)![1])).toBeGreaterThan(DE_TIMEOUT_MIN);
    expect(job).toContain(`shard: [${Array.from({ length: DE_SHARD_COUNT }, (_, i) => i).join(', ')}]`);
    expect(workflow).toContain(`DE_SHARD_COUNT: ${DE_SHARD_COUNT}`);
    expect(workflow).toMatch(/needs: \[scrape-de\]/);
  });

  it('DE und AT sind getrennte Systeme: eigener Workflow, eigene Nachbearbeitung je Land', () => {
    // DE: eigener Zeitplan, eigene concurrency-Gruppe, Nachbearbeitung nur DE.
    expect(workflow).toMatch(/cron: '17 22 \* \* \*'/);
    expect(workflow).toMatch(/group: scrape-events-de/);
    expect(workflow).toContain('scrape-pipeline.ts --trigger "$TRIGGER" --skip-scrapers --country DE');
    // AT: kein DE-Shard, keine Abhängigkeit von DE, Nachbearbeitung nur AT.
    expect(atWorkflow).not.toMatch(/--de-shard|scrape-de/);
    expect(atWorkflow).toMatch(/needs: \[scrape, venues\]/);
    expect(atWorkflow).toContain('--skip-venues --country AT');
    expect(atWorkflow).toMatch(/group: scrape-post-processing/);
  });
});

const entry = (ags: string, integration: string, url: string, fallback?: RegistryEntryDe['fallback']): RegistryEntryDe => ({
  ags, name: ags, land: 'bayern', host: new URL(url).host, stufe: 'A', integration, url, checked_at: '2026-10-28', ...(fallback ? { fallback } : {}),
});

describe('Shard-Aufteilung', () => {
  it('Adapter mit gemeinsamer Website (auch über Amt/VG) landen im selben Shard', () => {
    const entries = [
      entry('1', 'ionas', 'https://www.amt-sn.de/kalender'),
      entry('2', 'tribe', 'https://amt-sn.de/events/'),
      entry('3', 'ikiss', 'https://x.de/'),
      entry('4', 'leer', 'https://y.de/', { kind: 'verband', host: 'vg.de', integration: 'komm1', url: 'https://vg.de/termine' }),
      entry('5', 'mec', 'https://vg.de/events/'),
    ];
    const adapters = [
      { name: 'de-ionas', integrations: ['ionas'] },
      { name: 'de-tribe', integrations: ['tribe'] },
      { name: 'de-ikiss', integrations: ['ikiss'] },
      { name: 'de-kommone', integrations: ['komm1'] },
      { name: 'de-mec', integrations: ['mec'] },
    ];
    const shards = deShardPlan(adapters, 3, entries, () => 10);
    const shardOf = (n: string) => shards.findIndex(s => s.includes(n));
    expect(shardOf('de-ionas')).toBe(shardOf('de-tribe'));
    expect(shardOf('de-kommone')).toBe(shardOf('de-mec'));
    expect(new Set(shards.flat()).size).toBe(5);
  });

  it('echte Registry: jeder Adapter in genau einem Shard, keine Website in zwei Shards', () => {
    const scrapers = deNachtlaufScrapers();
    const shards = Array.from({ length: DE_SHARD_COUNT }, (_, i) => getDeScrapersForShard(i, DE_SHARD_COUNT));
    expect(shards.flat().map(s => s.name).sort()).toEqual(scrapers.map(s => s.name).sort());
    const owner = new Map<string, number>();
    shards.forEach((list, i) => {
      for (const s of list) {
        for (const h of adapterHosts(s.integrations)) {
          if (owner.has(h)) expect(owner.get(h), `${h} (${s.name})`).toBe(i);
          owner.set(h, i);
        }
      }
    });
    // Höchstens so viele Adapter je Shard, wie runAllScrapers gleichzeitig startet.
    for (const list of shards) expect(list.length).toBeLessThanOrEqual(10);
  });
});

describe('Sperre je Website', () => {
  afterEach(() => resetHostGate());

  it('www und ohne www teilen eine Sperre', () => {
    expect(hostKey('https://www.Amt-SN.de/x')).toBe(hostKey('http://amt-sn.de/y'));
  });

  it('zwei Abrufe derselben Website laufen nacheinander mit Pause, andere Websites parallel', async () => {
    const log: string[] = [];
    const job = (tag: string, ms: number) => async () => {
      log.push(`${tag}+`);
      await new Promise(r => setTimeout(r, ms));
      log.push(`${tag}-`);
    };
    const t0 = Date.now();
    await Promise.all([
      throughHostGate('https://a.de/1', 60, job('a1', 20)),
      throughHostGate('https://www.a.de/2', 60, job('a2', 20)),
      throughHostGate('https://b.de/1', 60, job('b1', 20)),
    ]);
    expect(log.indexOf('a1-')).toBeLessThan(log.indexOf('a2+'));
    expect(log.indexOf('b1+')).toBeLessThan(log.indexOf('a1-'));
    // a2 beginnt frühestens 60 ms nach dem Ende von a1.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(95);
  });

  it('ein Fehler gibt die Website frei', async () => {
    await expect(throughHostGate('https://c.de/1', 0, async () => { throw new Error('x'); })).rejects.toThrow('x');
    await expect(throughHostGate('https://c.de/2', 0, async () => 'ok')).resolves.toBe('ok');
  });
});

class TestAdapter extends DeFeedScraper {
  readonly name = 'de-test';
  readonly integrations = ['test'];
  readonly resumesSourceList = true;
  protected delayMs = 0;
  budgetMin = 240;
  protected softDeadline(): number {
    return Date.now() + this.budgetMin * 60_000;
  }
  async scrape(): Promise<ScrapedEvent[]> { return []; }
  resume(keys: string[]) { return this.resumeGroups(keys, k => k); }
  done(key: string) { this.groupDone(key); }
  feed(url: string) { return this.fetchFeed(url); }
}

describe('Fortsetzungs-Cursor und Zeitbudget', () => {
  afterEach(() => {
    resetHostGate();
    vi.unstubAllGlobals();
  });

  it('Cursor rückt nur bis zum letzten lückenlos fertigen Kalender vor', () => {
    const a = new TestAdapter();
    a.rotationCursor = 'b';
    expect(a.resume(['a', 'b', 'c', 'd'])).toEqual(['c', 'd', 'a', 'b']);
    a.done('d');
    expect(a.reachedCursor).toBeNull();
    a.done('c');
    expect(a.reachedCursor).toBe('d');
    a.done('b');
    expect(a.reachedCursor).toBe('d');
    a.done('a');
    expect(a.reachedCursor).toBe('b');
  });

  it('nach dem Zeitbudget kein Abruf mehr, das Gelesene bleibt', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(url.endsWith('robots.txt') ? '' : 'BEGIN:VCALENDAR', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const a = new TestAdapter();
    expect(await a.feed('https://d.de/feed.ics')).toBe('BEGIN:VCALENDAR');
    // Budget beginnt beim ersten Abruf; ein Adapter mit abgelaufenem Budget:
    const late = new TestAdapter();
    late.budgetMin = -1;
    const sleep = vi.spyOn(late as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep');
    expect(await late.feed('https://d.de/feed2.ics')).toBeNull();
    // Keine Pause mehr nach dem Budget (vorher 4 s je übrige URL, 14 min am 02.11.).
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(c => String(c[0]))).toEqual(['https://d.de/robots.txt', 'https://d.de/feed.ics']);
  });

  it('robots.txt liest der Prozess je Website einmal, auch über Adapter hinweg', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('User-agent: *\nDisallow: /intern/', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const a = new TestAdapter();
    const b = new TestAdapter();
    await a.feed('https://e.de/feed.ics');
    await b.feed('https://e.de/feed2.ics');
    expect(await b.feed('https://e.de/intern/x.ics')).toBeNull();
    expect(fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/robots.txt'))).toHaveLength(1);
  });
});

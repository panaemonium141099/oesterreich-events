/**
 * Prüfstand-Cache für `globalThis.fetch`: Seiten einmal laden (record) und
 * danach offline wiederholen (replay), damit Vorher/Nachher denselben
 * Quellstand sieht (Methode aus PR #301). Greift für jeden Scraper, weil
 * `fetchPage` und `fetch-html.ts` beide über `fetch` gehen.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type CacheMode = 'record' | 'replay' | 'auto';

interface Entry {
  url: string;
  status: number;
  contentType: string | null;
  body: string; // base64
}

export interface CacheStats {
  hits: number;
  recorded: number;
  misses: string[];
}

export function cacheKey(url: string, init?: RequestInit): string {
  const method = (init?.method ?? 'GET').toUpperCase();
  const body = typeof init?.body === 'string' ? init.body : '';
  return createHash('sha1').update(`${method} ${url} ${body}`).digest('hex');
}

/** Installiert den Cache und gibt eine Funktion zum Entfernen plus Statistik zurück. */
export function installCachedFetch(dir: string, mode: CacheMode): { restore: () => void; stats: CacheStats } {
  mkdirSync(dir, { recursive: true });
  const original = globalThis.fetch;
  const stats: CacheStats = { hits: 0, recorded: 0, misses: [] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const file = join(dir, `${cacheKey(url, init)}.json`);
    if (mode !== 'record' && existsSync(file)) {
      const e = JSON.parse(readFileSync(file, 'utf8')) as Entry;
      stats.hits++;
      return new Response(e.status === 204 || e.status === 304 ? null : Buffer.from(e.body, 'base64'), {
        status: e.status,
        headers: e.contentType ? { 'content-type': e.contentType } : {},
      });
    }
    if (mode === 'replay') {
      stats.misses.push(url);
      throw new Error(`Prüfstand offline: nicht im Cache: ${url}`);
    }
    const res = await original(input, init);
    const buf = Buffer.from(await res.arrayBuffer());
    const entry: Entry = { url, status: res.status, contentType: res.headers.get('content-type'), body: buf.toString('base64') };
    writeFileSync(file, JSON.stringify(entry));
    stats.recorded++;
    return new Response(res.status === 204 || res.status === 304 ? null : buf, {
      status: res.status,
      headers: entry.contentType ? { 'content-type': entry.contentType } : {},
    });
  }) as typeof fetch;
  return { restore: () => { globalThis.fetch = original; }, stats };
}

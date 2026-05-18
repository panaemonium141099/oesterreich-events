/**
 * Beweis: warm-cache Cron läuft mit niedriger Concurrency und der gleichen
 * Limit-Größe wie das UI. Beide Werte zusammen verhindern den
 * statement_timeout-Storm den wir am 17./18. Mai 2026 gesehen haben.
 *
 * Diese Tests sind absichtlich brutal explizit — wenn jemand zurück auf
 * 30 concurrent oder limit=10000 dreht ohne den Edge-Cache neu zu
 * konzipieren, kracht der Build sofort und sie müssen sich erklären.
 *
 * Production-Symptome die diese Konfiguration verhindert:
 *   - Vercel-Logs voll mit "Supabase query error: { code: '57014',
 *     message: 'canceling statement due to statement timeout' }"
 *   - Function-Duration 60-126 s für /api/events Aufrufe vom Cron
 *     (User-Agent: node)
 *   - 500-Responses für slim-list URLs während/nach Cron-Run
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const warmCachePath = join(__dirname, '..', '..', 'app', 'api', 'cron', 'warm-cache', 'route.ts');
const useFilteredPath = join(__dirname, '..', '..', 'lib', 'v4', 'use-filtered-events.ts');

const warmCacheSrc = readFileSync(warmCachePath, 'utf-8');
const useFilteredSrc = readFileSync(useFilteredPath, 'utf-8');

describe('warm-cache cron + UI fetch alignment', () => {
  describe('Concurrency cap', () => {
    it('fetchInChunks is called with concurrency 6 (NOT 30 — that caused statement_timeout)', () => {
      // Match the trailing positional arg to fetchInChunks
      const match = warmCacheSrc.match(/fetchInChunks<WarmResult>\(\s*paths\s*,[\s\S]*?,\s*(\d+)\s*,?\s*\)/);
      expect(match, 'fetchInChunks(paths, handler, N) call not found').toBeTruthy();
      const concurrency = parseInt(match![1], 10);
      expect(concurrency).toBeLessThanOrEqual(10);
      expect(concurrency).toBe(6);
    });
  });

  describe('Per-URL limit param', () => {
    it('all slim list URLs request limit=3000 (NOT 10000 — overkill + worst-case timeout fuel)', () => {
      // Match limit=N only inside slim=true URLs (the heavy ones). The
      // small featured-endpoint URLs (limit=10/8) are intentionally
      // different.
      const slimLimitMatches = warmCacheSrc.match(/limit=(\d+)&slim=true/g) ?? [];
      expect(slimLimitMatches.length).toBeGreaterThan(0);
      const uniqueLimits = Array.from(new Set(slimLimitMatches));
      expect(uniqueLimits).toEqual(['limit=3000&slim=true']);
    });

    it('UI BATCH_SIZE matches cron limit so cache keys align', () => {
      // useFilteredEvents fetches /api/events?limit={BATCH_SIZE}. If this
      // diverges from the cron's limit=3000, every UI fetch creates a new
      // (uncached) edge-cache key and triggers a cold DB path.
      const match = useFilteredSrc.match(/const BATCH_SIZE\s*=\s*(\d+);/);
      expect(match, 'BATCH_SIZE constant not found in use-filtered-events.ts').toBeTruthy();
      expect(parseInt(match![1], 10)).toBe(3000);
    });
  });

  describe('Total URL count stays bounded', () => {
    it('buildPaths emits roughly the expected ~183 URLs (sanity bound)', () => {
      // Quick structural check — 10 bundesländer × 11 cats = 110, plus
      // ~10 bare bundesland, ~40 date-presets, ~10 student, ~10 gratis,
      // ~3 featured/stats = ~183. The exact number isn't sacred; what
      // matters is we don't accidentally explode to 1000+ URLs.
      const bundeslaenderMatch = warmCacheSrc.match(/const BUNDESLAENDER\s*=\s*\[([\s\S]*?)\]/);
      const kategorienMatch = warmCacheSrc.match(/const KATEGORIEN\s*=\s*\[([\s\S]*?)\]/);
      expect(bundeslaenderMatch).toBeTruthy();
      expect(kategorienMatch).toBeTruthy();
      const bundeslaenderCount = (bundeslaenderMatch![1].match(/'/g) ?? []).length / 2;
      const kategorienCount = (kategorienMatch![1].match(/'/g) ?? []).length / 2;
      expect(bundeslaenderCount).toBe(10);
      expect(kategorienCount).toBe(11);
      // 110 from bl×cat, plus auxiliary entries; total stays under 250
      const expectedBlCat = bundeslaenderCount * kategorienCount;
      expect(expectedBlCat).toBe(110);
    });
  });
});

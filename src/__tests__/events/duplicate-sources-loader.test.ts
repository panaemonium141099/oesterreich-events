/**
 * getDuplicateSources: liest die Quellen der Dubletten eines Events und
 * hängt in BEIDEN Detail-Routen (Vollseite + abfangende Modal-Route).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const db = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost';
  return {
    rows: [] as Array<Record<string, unknown>>,
    error: null as { message: string } | null,
    calls: [] as Array<{ select: string; eq: Array<[string, unknown]> }>,
  };
});

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

vi.mock('@supabase/supabase-js', () => {
  function query() {
    const call = { select: '', eq: [] as Array<[string, unknown]> };
    db.calls.push(call);
    const q = {
      select: (cols: string) => ((call.select = cols), q),
      eq: (c: string, v: unknown) => (call.eq.push([c, v]), q),
      limit: () => q,
      then: (resolve: (v: unknown) => unknown) => {
        if (db.error) return resolve({ data: null, error: db.error });
        const data = db.rows.filter(r => call.eq.every(([c, v]) => r[c] === v));
        return resolve({ data, error: null });
      },
    };
    return q;
  }
  return { createClient: () => ({ from: () => query() }) };
});

import { getDuplicateSources } from '@/lib/events/event-detail-loaders';

const PRIMARY = '9d7ac9f7-fc27-4133-bfd7-de04c4208a3b';

describe('getDuplicateSources', () => {
  beforeEach(() => {
    db.rows.length = 0;
    db.calls.length = 0;
    db.error = null;
  });

  it('liest nur Dubletten dieses Events, mit den Spalten für die Attribution', async () => {
    db.rows.push(
      { duplicate_of: PRIMARY, publish_status: 'duplicate', source_name: 'partytimer', source_url: 'https://www.partytimer.at/events/1741099' },
      { duplicate_of: PRIMARY, publish_status: 'published', source_name: 'aufgehoben', source_url: null },
      { duplicate_of: 'anderes-event', publish_status: 'duplicate', source_name: 'fremd', source_url: null },
    );
    const rows = await getDuplicateSources(PRIMARY);
    expect(rows.map(r => r.source_name)).toEqual(['partytimer']);
    expect(db.calls[0].eq).toEqual([
      ['duplicate_of', PRIMARY],
      ['publish_status', 'duplicate'],
    ]);
    for (const col of ['source_name', 'source_url', 'postal_code', 'location_name', 'address']) {
      expect(db.calls[0].select).toContain(col);
    }
  });

  it('DB-Fehler: leere Liste statt kaputter Seite', async () => {
    db.error = { message: 'canceling statement due to statement timeout' };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getDuplicateSources(PRIMARY)).resolves.toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Detail-Routen reichen die Dubletten-Quellen durch', () => {
  // Die Detailseite existiert zweimal; In-App-Klicks landen im Modal.
  const routes = [
    'src/app/[locale]/events/[...slug]/page.tsx',
    'src/app/[locale]/@modal/(.)events/[...slug]/page.tsx',
  ];
  it.each(routes)('%s', route => {
    const src = readFileSync(join(process.cwd(), route), 'utf8');
    expect(src).toContain('getDuplicateSources(event.id)');
    expect(src).toContain('duplicateSources={duplicateSources}');
  });
});

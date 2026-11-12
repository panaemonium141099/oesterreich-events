import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPoolTimeout, retryOnPoolTimeout, POOL_RETRY_DELAYS_MS } from '@/lib/db/pool-retry';

// Prod 2026-11-11: die Antwort von PostgREST, an der die Bildprüfung abbrach.
const POOL = { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool.' };
const quiet = { sleep: async () => {}, log: () => {} };

describe('isPoolTimeout', () => {
  it('erkennt den vollen Pool an Code oder Meldung', () => {
    expect(isPoolTimeout(POOL)).toBe(true);
    expect(isPoolTimeout({ message: POOL.message })).toBe(true);
    expect(isPoolTimeout({ code: 'PGRST003' })).toBe(true);
  });

  it('hält andere Fehler nicht für einen vollen Pool', () => {
    expect(isPoolTimeout(null)).toBe(false);
    expect(isPoolTimeout({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
    expect(isPoolTimeout({ code: '23503', message: 'violates foreign key constraint' })).toBe(false);
  });
});

describe('retryOnPoolTimeout', () => {
  it('wiederholt, bis die Anfrage gelingt', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce({ error: POOL })
      .mockResolvedValueOnce({ error: POOL })
      .mockResolvedValueOnce({ error: null, data: 1 });
    const sleep = vi.fn(async (_ms: number) => {});
    const result = await retryOnPoolTimeout(run, { sleep, log: () => {} });
    expect(result).toEqual({ error: null, data: 1 });
    expect(run).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([5_000, 15_000]);
  });

  it('ruft bei Erfolg genau einmal auf', async () => {
    const run = vi.fn().mockResolvedValue({ error: null });
    await retryOnPoolTimeout(run, quiet);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('gibt andere Fehler sofort zurück', async () => {
    const other = { code: '57014', message: 'canceling statement due to statement timeout' };
    const run = vi.fn().mockResolvedValue({ error: other });
    const result = await retryOnPoolTimeout(run, quiet);
    expect(result.error).toBe(other);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('gibt nach dem letzten Versuch den Pool-Fehler zurück', async () => {
    const run = vi.fn().mockResolvedValue({ error: POOL });
    const result = await retryOnPoolTimeout(run, quiet);
    expect(result.error).toBe(POOL);
    expect(run).toHaveBeenCalledTimes(POOL_RETRY_DELAYS_MS.length + 1);
  });

  it('die Pausen überdauern eine Welle von 25 Sekunden', () => {
    expect(POOL_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0)).toBeGreaterThan(25_000);
  });
});

describe('Bildprüfung', () => {
  it('jede Datenbank-Anfrage des Skripts läuft über die Wiederholung', () => {
    const src = readFileSync(join(process.cwd(), 'src/scripts/probe-image-widths.ts'), 'utf8');
    const awaits = src.match(/await (supabase|q)\b/g) ?? [];
    expect(awaits).toEqual([]);
    expect((src.match(/retryOnPoolTimeout\(/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});

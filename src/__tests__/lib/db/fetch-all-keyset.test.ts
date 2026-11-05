import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  POSTGREST_MAX_ROWS,
  READ_RETRY_DELAYS_MS,
  forEachPageById,
  isTransientReadError,
  readWithRetry,
} from '@/lib/db/fetch-all';

// Der Bericht des AT-Nachtlaufs las den ganzen Bestand mit Offset-Seiten und
// lief am 05.11.2026 bei Zeile 186.000 in den Statement-Timeout, während ein
// Deploy auf dem Datenbank-Server baute (Run 42003360765). Im selben Lauf
// meldete der Kategorieschritt nach einem Statement-Timeout „Nothing to do“
// und blieb grün. Ganze Tabellen blättern deshalb nach id, Lesefehler durch
// Überlast werden wiederholt, alle anderen werfen.

interface Row { id: string; n: number }

const TIMEOUT = { message: 'canceling statement due to statement timeout' };
const UNREACHABLE = { message: 'TypeError: fetch failed' };

/** Tabelle mit sortierbaren ids; der Server kürzt jede Antwort auf `cap` Zeilen. */
function table(size: number): Row[] {
  return Array.from({ length: size }, (_, n) => ({ id: `id-${String(n).padStart(6, '0')}`, n }));
}
function server(rows: Row[], cap = POSTGREST_MAX_ROWS) {
  const calls: (string | null)[] = [];
  const query = (afterId: string | null) => {
    calls.push(afterId);
    const start = afterId ? rows.findIndex((r) => r.id > afterId) : 0;
    const data = start < 0 ? [] : rows.slice(start, start + cap);
    return Promise.resolve({ data, error: null });
  };
  return { query, calls };
}

const noSleep = () => Promise.resolve();

afterEach(() => vi.restoreAllMocks());

describe('forEachPageById', () => {
  it('liest alle Zeilen genau einmal und fragt jede Seite nach der letzten id der vorigen', async () => {
    const rows = table(2345);
    const { query, calls } = server(rows);
    const seen: Row[] = [];
    const total = await forEachPageById<Row>(query, (page) => { seen.push(...page); });

    expect(total).toBe(2345);
    expect(seen).toEqual(rows);
    // Zwei volle Seiten, eine kurze, dann die leere Seite als Ende.
    expect(calls).toEqual([null, 'id-000999', 'id-001999', 'id-002344']);
  });

  it('hört erst bei leerer Seite auf, nicht bei einer gekürzten', async () => {
    const rows = table(1200);
    const { query } = server(rows, 500);
    let pages = 0;
    const total = await forEachPageById<Row>(query, () => { pages++; });
    expect(total).toBe(1200);
    expect(pages).toBe(3);
  });

  it('wiederholt eine Seite nach Statement-Timeout und liest ab derselben Stelle weiter', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rows = table(2500);
    const inner = server(rows);
    let failures = 2;
    const attempts: (string | null)[] = [];
    const query = (afterId: string | null) => {
      attempts.push(afterId);
      if (afterId === 'id-000999' && failures-- > 0) return Promise.resolve({ data: null, error: TIMEOUT });
      return inner.query(afterId);
    };
    const waits: number[] = [];
    const seen: Row[] = [];
    const total = await forEachPageById<Row>(query, (page) => { seen.push(...page); }, {
      label: 'report',
      sleep: (ms) => { waits.push(ms); return Promise.resolve(); },
    });

    expect(total).toBe(2500);
    expect(seen).toEqual(rows);
    expect(attempts.filter((a) => a === 'id-000999')).toHaveLength(3);
    expect(waits).toEqual([READ_RETRY_DELAYS_MS[0], READ_RETRY_DELAYS_MS[1]]);
  });

  it('wirft, wenn die Datenbank auch nach allen Wiederholungen nicht antwortet', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let attempts = 0;
    const query = () => { attempts++; return Promise.resolve({ data: null, error: UNREACHABLE }); };
    await expect(
      forEachPageById<Row>(query, () => {}, { label: 'report', sleep: noSleep }),
    ).rejects.toThrow('report: TypeError: fetch failed');
    expect(attempts).toBe(READ_RETRY_DELAYS_MS.length + 1);
  });
});

describe('readWithRetry', () => {
  it('wiederholt nur vorübergehende Fehler', () => {
    expect(isTransientReadError(TIMEOUT.message)).toBe(true);
    expect(isTransientReadError(UNREACHABLE.message)).toBe(true);
    expect(isTransientReadError('column events.foo does not exist')).toBe(false);
    expect(isTransientReadError('permission denied for table events')).toBe(false);
  });

  it('wirft einen bleibenden Fehler sofort, ohne zu warten', async () => {
    let attempts = 0;
    const waits: number[] = [];
    const run = () => { attempts++; return Promise.resolve({ data: null, error: { message: 'column events.foo does not exist' } }); };
    await expect(
      readWithRetry<Row>(run, { label: 'x', sleep: (ms) => { waits.push(ms); return Promise.resolve(); } }),
    ).rejects.toThrow('x: column events.foo does not exist');
    expect(attempts).toBe(1);
    expect(waits).toEqual([]);
  });

  it('baut die Abfrage bei jedem Versuch neu und liefert das Ergebnis des gelungenen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = [
      { data: null, error: UNREACHABLE },
      { data: null, error: TIMEOUT },
      { data: [{ id: 'a', n: 1 }], error: null },
    ];
    let built = 0;
    const rows = await readWithRetry<Row>(() => Promise.resolve(results[built++]), { sleep: noSleep });
    expect(rows).toEqual([{ id: 'a', n: 1 }]);
    expect(built).toBe(3);
  });

  it('liefert für eine leere Antwort eine leere Liste', async () => {
    expect(await readWithRetry<Row>(() => Promise.resolve({ data: null, error: null }))).toEqual([]);
  });

  it('wartet insgesamt länger als der längste belegte Ausfall der API abzüglich der Versuche', () => {
    // 03.11.2026: api.lasstreffen.at sechs Minuten nicht erreichbar; jeder
    // der sieben Versuche läuft selbst bis zu 10 s in den Connect-Timeout.
    const waited = READ_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(waited + (READ_RETRY_DELAYS_MS.length + 1) * 10_000).toBeGreaterThanOrEqual(6 * 60_000);
  });
});

describe('Nachtlauf-Skripte', () => {
  const source = (name: string) => readFileSync(join(process.cwd(), 'src', 'scripts', name), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

  it('der Bericht liest den Bestand nach id, nicht mit Offset', () => {
    const report = source('generate-scrape-report.ts');
    expect(report).toContain('forEachPageById');
    expect(report).not.toMatch(/\.range\(/);
  });

  it('der Kategorieschritt liest über readWithRetry und bricht bei einem Lesefehler nicht still ab', () => {
    const categorize = source('categorize-events.ts');
    expect(categorize).toContain('readWithRetry');
    expect(categorize).not.toMatch(/if\s*\(error\)\s*\{[^}]*\bbreak\b/);
  });
});

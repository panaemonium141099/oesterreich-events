import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { installCachedFetch } from '@/lib/pruefstand/cache-fetch';
import { diffRuns, measureRows, poolMetrics, sampleRows, type PruefRow } from '@/lib/pruefstand/metrics';
import { buildReport, localStart } from '@/lib/pruefstand/report';
import { evaluate, type AtReferenz } from '@/lib/pruefstand/schwellen';

const row = (o: Partial<PruefRow> & { source_id: string }): PruefRow => ({
  title: 'Feuerwehrfest Plaidt',
  start_date: '2027-07-11T12:00:00.000Z',
  location_name: 'Feuerwehr Plaidt',
  latitude: 50.39,
  longitude: 7.39,
  location_precision: 'site',
  publish_status: 'published',
  source_url: 'https://plaidt.de/x',
  ...o,
});

const ref = (rates: Partial<AtReferenz['pooled']['rates']> = {}): AtReferenz => {
  const pooled = measureRows([row({ source_id: 'a' })]);
  pooled.rates = { ...pooled.rates, garbageTitle: 0.01, noTimeOfDay: 0.6, noCoords: 0.01, visibleNoCoords: 0.01, duplicatesInRun: 0.02, ...rates };
  return { measured_at: '2026-10-28', sources: ['x'], pooled, bySource: {} };
};

describe('Prüfstand: Kennzahlen', () => {
  it('zählt Uhrzeit, Koordinaten, Gemeinde-Dienste, Dubletten und Quarantäne', () => {
    const m = measureRows([
      row({ source_id: '1' }),
      row({ source_id: '2' }), // gleicher Name, Tag, Ort: Dublette
      row({ source_id: '3', title: 'Restmüllabfuhr', start_date: '2027-01-05T23:00:00.000Z' }), // Gemeinde-Dienst, Wien-Mitternacht
      row({ source_id: '4', latitude: null, longitude: null, publish_status: 'needs_review', location_resolution: { admission: { decision: 'quarantine', reasons: ['no_location_evidence'] } } }),
    ]);
    expect(m.n).toBe(4);
    expect(m.published).toBe(3);
    expect(m.quarantined).toBe(1);
    expect(m.quarantineReasons).toEqual({ no_location_evidence: 1 });
    expect(m.rates.noCoords).toBe(0.25);
    expect(m.rates.visibleNoCoords).toBe(0); // in Quarantäne, nicht sichtbar
    expect(m.rates.noTimeOfDay).toBe(0.25);
    expect(m.rates.duplicatesInRun).toBe(0.5); // 2 und 4 tragen Name/Tag/Ort von 1
    expect(m.rates.visibleMunicipalService).toBe(0.25);
  });

  it('sichtbar ohne Koordinaten: Online-Termine zählen nicht', () => {
    const m = measureRows([
      row({ source_id: '1', latitude: null, longitude: null, location_resolution: { status: 'online' } }),
      row({ source_id: '2', title: 'Kerwe', latitude: null, longitude: null, location_resolution: { status: 'region_only' } }),
    ]);
    expect(m.rates.noCoords).toBe(1);
    expect(m.rates.visibleNoCoords).toBe(0.5);
  });

  it('poolt nach n gewichtet, Dubletten bleiben je Quelle', () => {
    const a = measureRows([row({ source_id: '1' }), row({ source_id: '2' })]);
    const b = measureRows([row({ source_id: '1', title: 'Kirmes' }), row({ source_id: '2', title: 'Kerwe' })]);
    const p = poolMetrics([a, b]);
    expect(p.n).toBe(4);
    expect(p.rates.duplicatesInRun).toBe(0.25);
  });

  it('Stichprobe ist deterministisch', () => {
    const rows = Array.from({ length: 100 }, (_, i) => i);
    expect(sampleRows(rows, 10)).toEqual(sampleRows(rows, 10));
    expect(new Set(sampleRows(rows, 30)).size).toBe(30);
  });

  it('Diff nach source_id erkennt Übernahme per previous_source_id', () => {
    const before = [row({ source_id: 'alt' }), row({ source_id: 'bleibt' }), row({ source_id: 'weg' })];
    const after = [
      { ...row({ source_id: 'neu' }), previous_source_id: 'alt' },
      row({ source_id: 'bleibt' }),
      row({ source_id: 'frisch', title: 'Schützenfest' }),
    ];
    expect(diffRuns(before, after)).toEqual({ unchanged: 1, changed: [], carried: ['neu'], gone: ['weg'], added: ['frisch'] });
  });
});

describe('Prüfstand: Schwellen und Bericht', () => {
  it('ein sichtbarer Gemeinde-Dienst reißt die Schwelle', () => {
    const m = measureRows([row({ source_id: '1', title: 'Gelber Sack Abholung' }), row({ source_id: '2', title: 'Kerwe' })]);
    const v = evaluate(m, ref());
    expect(v.find(x => x.check === 'sichtbare Gemeinde-Dienste')?.ok).toBe(false);
  });

  it('schlechter als AT reißt, gleich gut besteht', () => {
    const m = measureRows([row({ source_id: '1', latitude: null, longitude: null }), row({ source_id: '2', title: 'Kerwe' })]);
    expect(evaluate(m, ref()).find(x => x.check === 'visibleNoCoords')?.ok).toBe(false);
    expect(evaluate(m, ref({ visibleNoCoords: 0.5 })).find(x => x.check === 'visibleNoCoords')?.ok).toBe(true);
  });

  it('ohne Zeilen besteht nichts', () => {
    expect(evaluate(measureRows([]), ref()).every(v => !v.ok)).toBe(true);
  });

  it('Bericht zeigt Termine ohne Uhrzeit als Tag, nicht als 01:00', () => {
    expect(localStart('2026-11-14T00:00:00.000Z')).toBe('14.11.2026 (ohne Uhrzeit)');
    expect(localStart('2026-11-13T23:00:00.000Z')).toBe('14.11.2026 (ohne Uhrzeit)');
    expect(localStart('2026-12-11T18:00:00.000Z')).toBe('11.12.26, 19:00');
    const { markdown, passed } = buildReport({
      adapter: 'test', generatedAt: 'jetzt', scraped: 2, rejected: 0, rejectionReasons: {},
      metrics: measureRows([row({ source_id: '1' })]), rows: [row({ source_id: '1' })], ref: ref(),
    });
    expect(passed).toBe(true);
    expect(markdown).toContain('| [ ] | Feuerwehrfest Plaidt |');
  });
});

describe('Prüfstand: Cache', () => {
  const original = globalThis.fetch;
  let dir = '';
  afterEach(() => {
    globalThis.fetch = original;
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('nimmt auf und spielt offline wieder ab', async () => {
    dir = mkdtempSync(join(tmpdir(), 'pruefstand-'));
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response('<h1>Kerwe</h1>', { status: 200, headers: { 'content-type': 'text/html' } }); }) as typeof fetch;
    const rec = installCachedFetch(dir, 'auto');
    expect(await (await fetch('https://example.org/a')).text()).toBe('<h1>Kerwe</h1>');
    rec.restore();
    const rep = installCachedFetch(dir, 'replay');
    const res = await fetch('https://example.org/a');
    expect(await res.text()).toBe('<h1>Kerwe</h1>');
    expect(res.headers.get('content-type')).toBe('text/html');
    await expect(fetch('https://example.org/fehlt')).rejects.toThrow(/nicht im Cache/);
    rep.restore();
    expect(calls).toBe(1);
    expect(rep.stats).toEqual({ hits: 1, recorded: 0, misses: ['https://example.org/fehlt'] });
  });
});

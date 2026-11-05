/**
 * Wächter der Testuhr (src/test/clock.ts): kein Test liest die echte Uhr.
 * Fällt einer dieser Fälle, hängen Tests wieder am Datum und werden rot,
 * sobald der Termin ihrer Fixture vorbei ist (Deploy-Stopps 03.11. und
 * 05.11.2026).
 */
import { describe, expect, it, vi } from 'vitest';
import { TEST_NOW, useRealClock } from '@/test/clock';

const T = TEST_NOW.getTime();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Schon beim Sammeln der Datei, nicht erst im Test.
const beimSammeln = Date.now();

describe('Testuhr', () => {
  it('steht beim Sammeln und im Test auf dem Testtag', async () => {
    expect(beimSammeln).toBe(T);
    expect(new Date().toISOString()).toBe(TEST_NOW.toISOString());
    await sleep(5); // echte Timer laufen, die Uhr steht
    expect(Date.now()).toBe(T);
  });

  it('eigene Uhr einer Datei gilt, danach wieder der Testtag', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-14T08:00:00Z') });
    expect(new Date().toISOString()).toBe('2026-10-14T08:00:00.000Z');
    vi.useRealTimers();
    expect(Date.now()).toBe(T);
  });

  it('volle Fake-Timer starten am Testtag; useRealTimers gibt echte Timer, nie die echte Uhr', async () => {
    vi.useFakeTimers();
    expect(Date.now()).toBe(T);
    vi.advanceTimersByTime(60_000);
    expect(Date.now()).toBe(T + 60_000);
    vi.useRealTimers();
    await sleep(5);
    expect(Date.now()).toBe(T);
  });

  it('useRealClock: laufende Uhr bis zum Ende des Tests', async () => {
    useRealClock();
    const t0 = Date.now();
    expect(t0).not.toBe(T);
    await sleep(20);
    expect(Date.now()).toBeGreaterThan(t0);
  });

  it('nach einem Test mit echter Uhr steht wieder der Testtag', () => {
    expect(Date.now()).toBe(T);
  });
});

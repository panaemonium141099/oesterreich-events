import { describe, it, expect, vi } from 'vitest';
import {
  warmLandingOnStart, HEALTH_POLL_MAX, WARM_ROUNDS, WARM_ROUND_PAUSE_MS, type WarmDeps,
} from '@/lib/landing/warm-on-start';

/**
 * Jeder Serverstart rendert die Startseite neu, sonst kommt nach einem
 * Container-Neustart (ISR-Guard, Deploy, Reboot) der Vorrender aus dem Build
 * hervor, dessen Saison-Karte im statement timeout leer blieb (06.11.2026).
 */

type Call = { url: string; headers: Record<string, string> };

function deps(
  respond: (url: string, n: number) => number,
  env: Record<string, string | undefined> = { CRON_SECRET: 's3cret', PORT: '3000' },
) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const logs: string[] = [];
  const counts = new Map<string, number>();
  const d: WarmDeps = {
    fetch: async (url, init) => {
      const n = (counts.get(url) ?? 0) + 1;
      counts.set(url, n);
      calls.push({ url, headers: init?.headers ?? {} });
      const status = respond(url, n);
      if (status < 0) throw new Error('fetch failed');
      return { status };
    },
    sleep: async (ms) => { sleeps.push(ms); },
    log: (m) => { logs.push(m); },
    env,
  };
  return { d, calls, sleeps, logs };
}

describe('warmLandingOnStart', () => {
  it('wartet auf /api/health, revalidiert mit dem Secret und holt beide Sprachfassungen zweimal', async () => {
    const { d, calls } = deps((url, n) => (url.endsWith('/api/health') && n < 3 ? 503 : 200));
    const result = await warmLandingOnStart(d);
    expect(result).toEqual({
      outcome: 'warmed', rounds: 1,
      statuses: { revalidate: [200], '/': [200, 200], '/en': [200, 200] },
    });
    const urls = calls.map((c) => c.url.replace('http://127.0.0.1:3000', ''));
    expect(urls).toEqual([
      '/api/health', '/api/health', '/api/health',
      '/api/cron/revalidate-landing', '/', '/', '/en', '/en',
    ]);
    const revalidate = calls.find((c) => c.url.endsWith('/api/cron/revalidate-landing'))!;
    expect(revalidate.headers.Authorization).toBe('Bearer s3cret');
    expect(calls.every((c) => c.headers['User-Agent'] === 'lt-warm-on-start')).toBe(true);
  });

  it('nimmt den Port aus der Umgebung', async () => {
    const { d, calls } = deps(() => 200, { CRON_SECRET: 'x', PORT: '4100' });
    await warmLandingOnStart(d);
    expect(calls[0].url).toBe('http://127.0.0.1:4100/api/health');
  });

  it('ohne CRON_SECRET oder mit LANDING_WARM_ON_START=off passiert nichts', async () => {
    const a = deps(() => 200, { PORT: '3000' });
    expect(await warmLandingOnStart(a.d)).toEqual({ outcome: 'skipped', reason: 'no_secret' });
    expect(a.calls).toEqual([]);
    const b = deps(() => 200, { CRON_SECRET: 'x', LANDING_WARM_ON_START: 'off' });
    expect(await warmLandingOnStart(b.d)).toEqual({ outcome: 'skipped', reason: 'off' });
    expect(b.calls).toEqual([]);
  });

  it('gibt auf, wenn der Server nie antwortet', async () => {
    const { d, calls } = deps(() => -1);
    expect(await warmLandingOnStart(d)).toEqual({ outcome: 'not_reachable', attempts: HEALTH_POLL_MAX });
    expect(calls).toHaveLength(HEALTH_POLL_MAX);
  });

  it('wiederholt die Runde nach einer Pause, wenn ein Render scheitert', async () => {
    // Erster Abruf von `/` fällt um (500: der Render wirft zur Laufzeit bei Timeout), die zweite Runde sitzt.
    const { d, sleeps } = deps((url, n) => (url.endsWith('3000/') && n === 1 ? 500 : 200));
    const result = await warmLandingOnStart(d);
    expect(result).toMatchObject({ outcome: 'warmed', rounds: 2 });
    expect(sleeps.filter((ms) => ms === WARM_ROUND_PAUSE_MS)).toHaveLength(1);
  });

  it('meldet nach der letzten Runde einen Fehlschlag statt zu werfen', async () => {
    const { d } = deps((url) => (url.endsWith('/api/cron/revalidate-landing') ? 401 : 200));
    expect(await warmLandingOnStart(d)).toMatchObject({ outcome: 'failed', rounds: WARM_ROUNDS });
  });

  it('fängt jeden Fehler, der Serverstart hängt nicht daran', async () => {
    const d: WarmDeps = {
      fetch: () => { throw new TypeError('kaputt'); },
      sleep: () => { throw new Error('sleep kaputt'); },
      log: vi.fn(),
      env: { CRON_SECRET: 'x' },
    };
    await expect(warmLandingOnStart(d)).resolves.toMatchObject({ outcome: 'failed' });
  });
});

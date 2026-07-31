/**
 * Rate-Limit-Queue (fn-18 Task 5): rollierendes Fenster, nicht Fixed-Window.
 *
 * Getestet mit virtueller Uhr — kein echtes Warten, deterministisch.
 */
import { describe, it, expect } from 'vitest';
import { RateLimitQueue } from '@/lib/affiliate/rate-limit-queue';

/** Virtuelle Uhr: sleep() springt einfach vorwaerts. */
function virtualClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms;
    },
    advance: (ms: number) => {
      now += ms;
    },
    get value() {
      return now;
    },
  };
}

describe('RateLimitQueue', () => {
  it('laesst `limit` Requests im Fenster sofort durch', async () => {
    const clock = virtualClock();
    const queue = new RateLimitQueue({ limit: 3, windowMs: 1000, now: clock.now, sleep: clock.sleep });

    for (let i = 0; i < 3; i++) await queue.run(async () => i);

    expect(clock.value).toBe(0); // keine Wartezeit
    expect(queue.inFlightWindow).toBe(3);
  });

  it('blockiert den (limit+1)-ten Request bis der aelteste Slot frei wird', async () => {
    const clock = virtualClock();
    const queue = new RateLimitQueue({ limit: 2, windowMs: 1000, now: clock.now, sleep: clock.sleep });

    await queue.run(async () => 'a');
    await queue.run(async () => 'b');
    expect(clock.value).toBe(0);

    await queue.run(async () => 'c');
    // Der aelteste Grant lag bei t=0, faellt bei t=1000 aus dem Fenster.
    expect(clock.value).toBe(1000);
  });

  it('ist rollierend, nicht Fixed-Window (kein Burst an der Fenstergrenze)', async () => {
    const clock = virtualClock();
    const queue = new RateLimitQueue({ limit: 2, windowMs: 1000, now: clock.now, sleep: clock.sleep });

    await queue.run(async () => 1); // t=0
    clock.advance(900);
    await queue.run(async () => 2); // t=900

    // Ein Fixed-Window-Zaehler wuerde bei t=1000 zuruecksetzen und sofort
    // freigeben. Rollierend muss bis t=1000 (aeltester Grant + 1000)
    // gewartet werden.
    await queue.run(async () => 3);
    expect(clock.value).toBe(1000);

    // Der naechste muss auf den Grant von t=900 warten -> t=1900.
    await queue.run(async () => 4);
    expect(clock.value).toBe(1900);
  });

  it('serialisiert parallele Aufrufer (kein doppelt vergebener Slot)', async () => {
    const clock = virtualClock();
    const queue = new RateLimitQueue({ limit: 1, windowMs: 100, now: clock.now, sleep: clock.sleep });

    const order: number[] = [];
    await Promise.all([
      queue.run(async () => {
        order.push(1);
      }),
      queue.run(async () => {
        order.push(2);
      }),
      queue.run(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
    // Zwei Wartezyklen a 100 ms.
    expect(clock.value).toBe(200);
  });

  it('vergiftet die Kette nicht, wenn ein Job wirft', async () => {
    const clock = virtualClock();
    const queue = new RateLimitQueue({ limit: 5, windowMs: 1000, now: clock.now, sleep: clock.sleep });

    await expect(
      queue.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(queue.run(async () => 'ok')).resolves.toBe('ok');
  });

  it('lehnt unsinnige Konfiguration ab', () => {
    expect(() => new RateLimitQueue({ limit: 0, windowMs: 10 })).toThrow();
    expect(() => new RateLimitQueue({ limit: 1, windowMs: 0 })).toThrow();
  });
});

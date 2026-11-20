import { describe, expect, it, vi } from 'vitest';
import { resilient } from '@/lib/app-api/resilient';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('resilient', () => {
  it('liefert frische Antworten durch', async () => {
    const load = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
    const get = resilient(load);
    expect(await get()).toEqual({ value: 'a', stale: false });
    expect(await get()).toEqual({ value: 'b', stale: false });
  });

  it('gibt nach einem Fehlschlag die letzte gelungene Antwort, als alt markiert', async () => {
    const load = vi.fn().mockResolvedValueOnce('gut').mockRejectedValueOnce(new Error('timeout'));
    const get = resilient(load);
    await get();
    expect(await get()).toEqual({ value: 'gut', stale: true });
  });

  it('wirft, wenn es noch keine gelungene Antwort gibt', async () => {
    const get = resilient(vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(get()).rejects.toThrow('timeout');
  });

  it('lädt in der Pause nach einem Fehlschlag nicht noch einmal', async () => {
    const c = clock();
    const load = vi
      .fn()
      .mockResolvedValueOnce('gut')
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('neu');
    const get = resilient(load, { retryAfterMs: 60_000, now: c.now });

    await get();
    await get(); // scheitert
    expect(load).toHaveBeenCalledTimes(2);

    c.advance(59_000);
    expect(await get()).toEqual({ value: 'gut', stale: true });
    expect(load).toHaveBeenCalledTimes(2);

    c.advance(2_000);
    expect(await get()).toEqual({ value: 'neu', stale: false });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('hält die Pause auch ohne letzte Antwort ein', async () => {
    const c = clock();
    const load = vi.fn().mockRejectedValue(new Error('timeout'));
    const get = resilient(load, { retryAfterMs: 60_000, now: c.now });
    await expect(get()).rejects.toThrow('timeout');
    await expect(get()).rejects.toThrow('timeout');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('teilt einen Lauf unter gleichzeitigen Anfragen', async () => {
    let finish: (value: string) => void = () => undefined;
    const load = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const get = resilient(load);
    const both = Promise.all([get(), get(), get()]);
    finish('einmal');
    expect(await both).toEqual([
      { value: 'einmal', stale: false },
      { value: 'einmal', stale: false },
      { value: 'einmal', stale: false },
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

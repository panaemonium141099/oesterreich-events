/**
 * Fetch-Semantik des Deskline-Clients (fn-18, Task 2):
 *  - 429-Throttling verbraucht KEINE regulaeren Retries (separates Budget)
 *  - erschoepftes Throttle-Budget failt die Seite/Region
 *  - Seiten-Deckel schneidet nie still ab — Region failt (E6: ganz ok
 *    oder ganz failed)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchRegionInfrastructures, DESKLINE_PAGE_SIZE } from '@/lib/activities/deskline-client';

type FetchStep =
  | { status: 429; retryAfter?: string }
  | { status: 200; body: unknown }
  | { status: number; body?: string };

function mockFetchSequence(steps: FetchStep[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const fn = vi.fn(async () => {
    const step = steps[Math.min(call++, steps.length - 1)];
    if (step.status === 429) {
      return new Response('slow down', {
        status: 429,
        // Retry-After: 0 -> sofortiger Retry, Tests bleiben schnell.
        headers: { 'Retry-After': (step as { retryAfter?: string }).retryAfter ?? '0' },
      });
    }
    if (step.status === 200) {
      return new Response(JSON.stringify((step as { body: unknown }).body), { status: 200 });
    }
    return new Response((step as { body?: string }).body ?? 'boom', { status: step.status });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function page(data: unknown[], pageNo: number, pageCount: number) {
  return {
    data,
    paging: { pageNo, pageSize: DESKLINE_PAGE_SIZE, pageCount, totalRecordCount: data.length },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchRegionInfrastructures — 429-Handling', () => {
  it('429-Wartezyklen verbrauchen keine regulaeren Retries (mehr 429s als MAX_RETRIES, trotzdem Erfolg)', async () => {
    const fn = mockFetchSequence([
      { status: 429 },
      { status: 429 },
      { status: 429 },
      { status: 429 },
      { status: 200, body: page([{ id: 'x', name: 'X' }], 0, 1) },
    ]);
    const items = await fetchRegionInfrastructures('testregion', 'L1');
    expect(items).toEqual([{ id: 'x', name: 'X' }]);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('erschoepftes Throttle-Budget failt die Region (kein Endlos-Loop)', async () => {
    const fn = mockFetchSequence([{ status: 429 }]); // dauerhaft 429
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /throttle budget exhausted/,
    );
    // 1 Initial-Call + MAX_THROTTLE_RETRIES Wartezyklen-Retries = 11.
    expect(fn).toHaveBeenCalledTimes(11);
  });
});

describe('fetchRegionInfrastructures — Pagination', () => {
  it('holt alle Seiten einer Region', async () => {
    mockFetchSequence([
      { status: 200, body: page([{ id: 'a' }], 0, 2) },
      { status: 200, body: page([{ id: 'b' }], 1, 2) },
    ]);
    const items = await fetchRegionInfrastructures('testregion', 'L1');
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('Seiten-Deckel schneidet NIE still ab — Region failt (E6: ganz ok oder ganz failed)', async () => {
    mockFetchSequence([
      { status: 200, body: page([{ id: 'a' }], 0, 5) },
      { status: 200, body: page([{ id: 'b' }], 1, 5) },
    ]);
    await expect(
      fetchRegionInfrastructures('testregion', 'L1', undefined, { maxPages: 2 }),
    ).rejects.toThrow(/page cap reached \(2\/5 pages\)/);
  });

  it('kaputte Response ohne data-Array failt die Region', async () => {
    mockFetchSequence([{ status: 200, body: { paging: { pageCount: 1 } } }]);
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /malformed response/,
    );
  });

  it('200 mit fehlendem paging-Block failt die Region (nie stilles Ein-Seiten-Truncate)', async () => {
    mockFetchSequence([{ status: 200, body: { data: [{ id: 'a' }] } }]);
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /malformed\/inconsistent paging/,
    );
  });

  it('wiederholte/verrutschte Seite (Echo pageNo != angefragte Seite) failt die Region', async () => {
    mockFetchSequence([
      { status: 200, body: page([{ id: 'a' }], 0, 2) },
      // API liefert fuer die angefragte Seite 1 nochmal Seite 0.
      { status: 200, body: page([{ id: 'a' }], 0, 2) },
    ]);
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /malformed\/inconsistent paging block on page 1/,
    );
  });

  it('server-seitig geclampte pageSize failt die Region (Echo-Check)', async () => {
    mockFetchSequence([
      {
        status: 200,
        body: { data: [{ id: 'a' }], paging: { pageNo: 0, pageSize: 200, pageCount: 1, totalRecordCount: 1 } },
      },
    ]);
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /malformed\/inconsistent paging/,
    );
  });

  it('200 mit inkonsistentem paging (pageCount 0 / non-integer) failt die Region', async () => {
    mockFetchSequence([
      {
        status: 200,
        body: { data: [{ id: 'a' }], paging: { pageNo: 0, pageSize: 400, pageCount: 0, totalRecordCount: 1 } },
      },
    ]);
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /malformed\/inconsistent paging/,
    );

    mockFetchSequence([
      {
        status: 200,
        body: { data: [{ id: 'a' }], paging: { pageNo: 0, pageSize: 400, pageCount: '7', totalRecordCount: 1 } },
      },
    ]);
    await expect(fetchRegionInfrastructures('testregion', 'L1')).rejects.toThrow(
      /malformed\/inconsistent paging/,
    );
  });
});

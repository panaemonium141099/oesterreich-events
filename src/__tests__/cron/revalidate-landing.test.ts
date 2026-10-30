/**
 * GET /api/cron/revalidate-landing (fn-30.7): verlangt den Bearer
 * CRON_SECRET und baut `/` und `/en` neu (Mitternachtswechsel der
 * Tagesausgabe). revalidatePath ist gemockt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { GET } = await import('@/app/api/cron/revalidate-landing/route');

function get(auth?: string) {
  return GET(
    new NextRequest('http://localhost:3000/api/cron/revalidate-landing', {
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

describe('GET /api/cron/revalidate-landing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'geheim');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('401 ohne oder mit falschem Bearer, nichts revalidiert', async () => {
    expect((await get()).status).toBe(401);
    expect((await get('Bearer falsch')).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('401 wenn CRON_SECRET nicht gesetzt ist (fail closed)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await get('Bearer ')).status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('mit Bearer: revalidiert / und /en (und das Seitenmuster /[locale])', async () => {
    const res = await get('Bearer geheim');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.revalidated).toEqual(['/', '/en']);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'page');
  });
});

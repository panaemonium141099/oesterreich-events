import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * fn-18 Task 8 — Server-Loader der ersten Seite von /aktivitaeten.
 * Kritisch ist der Uebergabepunkt an /api/activities: limit+1-Fetch,
 * Cursor NUR wenn es eine Folgeseite gibt, und der Cursor zeigt auf die
 * letzte AUSGELIEFERTE Row (sonst doppelt/verschluckt "Mehr laden").
 */

const limitMock = vi.fn();
const orderMock = vi.fn(() => ({ order: () => ({ limit: limitMock }) }));

vi.mock('next/cache', () => ({
  // unstable_cache ist im Test transparent — getestet wird die Query-Logik.
  unstable_cache: (fn: unknown) => fn,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: orderMock }) }) }),
    }),
  })),
}));

import { loadActivityListPageCached } from '@/lib/activities/list-loaders';
import { decodeActivityCursor } from '@/lib/activities/cursor';

const ID_A = '00000000-0000-0000-0000-00000000000a';
const ID_B = '00000000-0000-0000-0000-00000000000b';
const ID_C = '00000000-0000-0000-0000-00000000000c';

function row(id: string, name: string) {
  return { id, name, slug: name, tags: [], town: null, bundesland: 'wien', setting: null, price_hint: null, images: null };
}

describe('loadActivityListPageCached', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    limitMock.mockReset();
  });

  it('kappt die limit+1-Row und kodiert den Cursor der letzten gelieferten Row', async () => {
    limitMock.mockResolvedValue({ data: [row(ID_A, 'Alm'), row(ID_B, 'Burg'), row(ID_C, 'City')], error: null });

    const page = await loadActivityListPageCached(2);

    expect(limitMock).toHaveBeenCalledWith(3);
    expect(page.items.map((i) => i.name)).toEqual(['Alm', 'Burg']);
    expect(decodeActivityCursor(page.nextCursor)).toEqual({ name: 'Burg', id: ID_B });
  });

  it('liefert nextCursor=null wenn keine Folgeseite existiert und wirft bei DB-Fehlern', async () => {
    limitMock.mockResolvedValue({ data: [row(ID_A, 'Alm')], error: null });
    await expect(loadActivityListPageCached(2)).resolves.toMatchObject({ nextCursor: null });

    limitMock.mockResolvedValue({ data: null, error: { message: 'statement timeout' } });
    // Werfen statt leere Liste: eine leere Uebersichtsseite darf nie eine
    // Stunde im ISR-Cache (und damit im Google-Index) landen.
    await expect(loadActivityListPageCached(2)).rejects.toThrow(/statement timeout/);
  });
});

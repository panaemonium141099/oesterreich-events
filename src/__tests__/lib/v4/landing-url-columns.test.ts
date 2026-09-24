import { describe, it, expect, vi } from 'vitest';

// Jede Abfrage auf `events` mitschneiden; der Chain liefert leere Daten.
const eventSelects: string[] = [];
vi.mock('@supabase/supabase-js', () => {
  const chain = (table: string): unknown => {
    const result = Promise.resolve({ data: [], error: null });
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === 'then') return result.then.bind(result);
        return (...args: unknown[]) => {
          if (prop === 'select' && table === 'events') eventSelects.push(String(args[0]));
          return proxy;
        };
      },
    });
    return proxy;
  };
  return { createClient: () => ({ from: (t: string) => chain(t) }) };
});

import { getLandingData } from '@/lib/v4/get-landing-data';
import { EVENT_URL_COLUMNS } from '@/lib/utils/slugify';

describe('Landing lädt alle Spalten für Event-Links', () => {
  it('jede events-Abfrage enthält EVENT_URL_COLUMNS (sonst 1010-wien/8010-graz-Links)', async () => {
    await getLandingData();
    expect(eventSelects.length).toBeGreaterThan(0);
    for (const cols of eventSelects) {
      const have = new Set(cols.split(',').map((c) => c.trim()));
      for (const need of EVENT_URL_COLUMNS.split(',')) {
        expect(have, `Spalte ${need} fehlt in: ${cols}`).toContain(need);
      }
    }
  });
});

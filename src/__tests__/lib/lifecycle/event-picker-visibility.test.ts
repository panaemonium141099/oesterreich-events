// Abschlussprüfung 2026-10-08: Der Picker der Lifecycle-Mails filterte nicht
// auf sichtbare Events; unter den Top 20 standen zwei verborgene Duplikate.

import { describe, it, expect } from 'vitest';
import { pickLifecycleEvents } from '@/lib/lifecycle/event-picker';

function recordingClient() {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  const chain = new Proxy(builder, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      }
      return (...args: unknown[]) => { calls.push([prop, ...args]); return chain; };
    },
  });
  return { calls, client: { from: (table: string) => { calls.push(['from', table]); return chain; } } };
}

describe('pickLifecycleEvents', () => {
  it('liest nur veröffentlichte Events (keine Duplikate, keine zurückgezogenen)', async () => {
    const { calls, client } = recordingClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pickLifecycleEvents({ supabase: client as any, cohort: 'activation' as any, location: null, now: new Date('2026-10-08T10:00:00Z') } as any);
    expect(calls).toContainEqual(['in', 'publish_status', ['published', 'published_low_confidence']]);
  });
});

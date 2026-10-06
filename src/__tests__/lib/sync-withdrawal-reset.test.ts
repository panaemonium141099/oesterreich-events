/**
 * Ein zurückgezogenes Event (withdrawn_at, siehe src/lib/quality/withdrawal.ts)
 * muss wieder sichtbar werden, sobald seine Quelle es erneut listet. Der
 * Schreibpfad setzt dafür bei jeder Zeile withdrawn_at zurück — zusammen
 * mit last_seen_at, dem Beleg der Sichtung.
 */
import { describe, it, expect } from 'vitest';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const event = {
  source_name: 'test',
  source_id: 'a',
  source_url: 'https://example.at/a',
  title: 'Testkonzert',
  start_date: '2026-11-01T18:00:00.000Z',
  location_name: 'Musikheim',
} as ScrapedEvent;

describe('Schreibpfad hebt den Rückzug auf', () => {
  it('jede geschriebene Zeile setzt withdrawn_at zurück und last_seen_at neu', () => {
    const { row } = toSupabaseRow(event, new Map(), new Map());
    expect(row).toHaveProperty('withdrawn_at', null);
    expect(typeof row.last_seen_at).toBe('string');
  });
});

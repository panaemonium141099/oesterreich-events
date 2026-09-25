/**
 * Wächter für die RPC search_event_ids (Migration 20260925120000).
 *
 * 2026-09-25: /api/events?search=bier lieferte bei identischen Aufrufen 76,
 * dann 102 Events. Die RPC kappte ohne ORDER BY über alle Events inkl.
 * vergangener, die API filterte erst danach. Die RPC muss deshalb die
 * Listenfilter selbst anwenden und deterministisch sortieren, bevor sie kappt.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260925120000_search_event_ids_deterministisch.sql'),
  'utf8',
);

// Jeder RETURN QUERY-Zweig (trgm-Pfad und Kurzbegriff-Pfad) einzeln.
const branches = sql.split('RETURN QUERY').slice(1);

describe('search_event_ids migration', () => {
  it('keeps (q, max_ids) callable via defaults for the new filter params', () => {
    expect(sql).toMatch(/from_date date DEFAULT CURRENT_DATE/);
    expect(sql).toMatch(/countries text\[\] DEFAULT NULL/);
    expect(sql).toMatch(/require_coords boolean DEFAULT false/);
    expect(sql).toMatch(/max_ids integer DEFAULT 50000/);
  });

  it('has both index paths', () => {
    expect(branches).toHaveLength(2);
  });

  it.each([0, 1])('branch %i filters like the list and orders before the cap', (i) => {
    const b = branches[i];
    expect(b).toMatch(/e\.visibility = 'public'/);
    expect(b).toMatch(/e\.publish_status IN \('published', 'published_low_confidence'\)/);
    expect(b).toMatch(/e\.start_date >= from_date/);
    expect(b).toMatch(/e\.country = ANY \(countries\)/);
    expect(b).toMatch(/e\.latitude IS NOT NULL AND e\.longitude IS NOT NULL/);
    // Deterministischer Schnitt in Listenreihenfolge, ORDER BY vor LIMIT
    expect(b).toMatch(/ORDER BY e\.start_date, e\.id\s+LIMIT max_ids/);
  });

  it('prefilters on the exact expression of idx_events_search_concat_trgm', () => {
    const expr =
      "(COALESCE(e.title, '')         || ' ' ||\n" +
      "           COALESCE(e.location_name, '') || ' ' ||\n" +
      "           COALESCE(e.address, '')       || ' ' ||\n" +
      "           COALESCE(e.category, '')) ILIKE";
    expect(branches[0]).toContain(expr);
  });

  it('reloads the PostgREST schema cache and keeps the grants', () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.search_event_ids\(text, integer, date, text\[\], boolean\)\s+TO anon, authenticated, service_role/);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });
});

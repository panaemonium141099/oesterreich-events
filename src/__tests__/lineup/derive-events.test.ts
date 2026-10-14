// Abgeleitete Lineup-Events („Künstler at Festival").
//
// Prod 2026-10-14: jede Nacht scheiterten alle 839 offenen Zeilen an
// events_bundesland_check, weil derive-events festivals.state als Anzeigename
// („Niederösterreich") in die Spalte schrieb. Der Schritt blieb grün.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveFestivalEvents, derivedEventRegion } from '@/lib/lineup/derive-events';
import { lineupStepFailure, type OrchestratorStats } from '@/lib/lineup/orchestrator';

/** Erlaubte Werte laut events_bundesland_check (aus der Migration gelesen). */
const ALLOWED_BUNDESLAND: string[] = (() => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260505100000_district_constraint_and_enum_checks.sql'),
    'utf8',
  );
  const m = sql.match(/events_bundesland_check\s+CHECK \(bundesland IS NULL OR bundesland IN\s*\(([^)]*)\)/);
  if (!m) throw new Error('events_bundesland_check nicht gefunden');
  return m[1].split(',').map(v => v.trim().replace(/'/g, ''));
})();

describe('derivedEventRegion', () => {
  it('kennt die neun Werte der Datenbank-Prüfung', () => {
    expect(ALLOWED_BUNDESLAND).toHaveLength(9);
  });

  it('nimmt ohne Eltern-Event die Gemeinde des Festival-Orts, nicht festivals.state', () => {
    // Nova Rock steht in festivals als Niederösterreich; Nickelsdorf liegt im Burgenland.
    expect(derivedEventRegion({ city: 'Nickelsdorf', state: 'Niederösterreich' }, null))
      .toEqual({ bundesland: 'burgenland', district: 'neusiedl am see' });
    // Mondsee steht als Salzburg da, liegt aber in Oberösterreich.
    expect(derivedEventRegion({ city: 'Mondsee', state: 'Salzburg' }, null))
      .toEqual({ bundesland: 'oberoesterreich', district: 'vöcklabruck' });
  });

  it('fällt ohne eindeutige Gemeinde auf festivals.state zurück, als ID', () => {
    // Die Gemeinde heißt amtlich „Klagenfurt am Wörthersee".
    expect(derivedEventRegion({ city: 'Klagenfurt', state: 'Kärnten' }, null))
      .toEqual({ bundesland: 'kaernten', district: null });
    expect(derivedEventRegion({ city: 'verschiedene Orte', state: 'Niederoesterreich' }, null))
      .toEqual({ bundesland: 'niederoesterreich', district: null });
    expect(derivedEventRegion({ city: null, state: 'Oberösterreich' }, null))
      .toEqual({ bundesland: 'oberoesterreich', district: null });
  });

  it('gibt Wien keinen Gemeindebezirk ohne Adresse', () => {
    expect(derivedEventRegion({ city: 'Wien', state: 'Wien' }, null))
      .toEqual({ bundesland: 'wien', district: null });
  });

  it('liefert für jeden Prod-Wert von festivals.state nur erlaubte Werte oder null', () => {
    // SELECT state, count(*) FROM festivals GROUP BY 1 (Prod 2026-10-14)
    const states = ['Niederösterreich', 'Steiermark', 'Oberösterreich', 'Wien', 'Salzburg', 'Burgenland',
      'Kärnten', 'Tirol', 'Vorarlberg', 'NÖ', 'Niederoesterreich', null];
    for (const state of states) {
      const { bundesland } = derivedEventRegion({ city: 'verschiedene Orte', state }, null);
      if (bundesland !== null) expect(ALLOWED_BUNDESLAND).toContain(bundesland);
      if (state && state !== 'NÖ') expect(bundesland).not.toBeNull();
    }
  });

  it('übernimmt mit Eltern-Event dessen Ortsentscheidung', () => {
    expect(derivedEventRegion(
      { city: 'Graz', state: 'Niederösterreich' },
      { bundesland: 'steiermark', district: 'graz (stadt)' },
    )).toEqual({ bundesland: 'steiermark', district: 'graz (stadt)' });
  });

  it('leitet beim Eltern-Event ohne Bundesland aus dessen Gemeinde ab', () => {
    const parent = {
      bundesland: null,
      district: null,
      postal_code: null,
      location_resolution: { gemeinde: { name: 'Innsbruck', plz: '6020', bundesland: 'tirol', bezirk: 'Innsbruck-Stadt' } },
    };
    expect(derivedEventRegion({ city: 'Innsbruck', state: 'Wien' }, parent as never).bundesland).toBe('tirol');
  });
});

// ── deriveFestivalEvents gegen einen Supabase-Ersatz ─────────────────────

const NOVA_ROCK = {
  id: 'f-1',
  canonical_name: 'Nova Rock',
  slug: 'nova-rock',
  website_url: 'https://www.novarock.at',
  lineup_url: null,
  city: 'Nickelsdorf',
  state: 'Niederösterreich',
  starts_at: '2026-06-11',
  ends_at: '2026-06-14',
  parent_event_id: null,
};

function artistRow(id: string, name: string, festival: Record<string, unknown> = NOVA_ROCK) {
  return { id, festival_id: festival.id, artist_name_raw: name, day_label: null, stage_name: null, derived_event_id: null, festivals: festival };
}

function fakeSupabase(artists: unknown[], upsertError?: string) {
  const upserts: Record<string, unknown>[] = [];
  const backlinks: Record<string, unknown>[] = [];
  const artistsResult = { data: artists, error: null };
  const client = {
    from(table: string) {
      if (table === 'festival_artists') {
        return {
          select: () => ({
            is: () => Object.assign(Promise.resolve(artistsResult), { eq: () => Promise.resolve(artistsResult) }),
          }),
          update: (row: Record<string, unknown>) => {
            backlinks.push(row);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      return {
        upsert: (row: Record<string, unknown>) => {
          upserts.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve(
                upsertError
                  ? { data: null, error: { message: upsertError } }
                  : { data: { id: `ev-${upserts.length}` }, error: null },
              ),
            }),
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, upserts, backlinks };
}

describe('deriveFestivalEvents', () => {
  it('schreibt das Bundesland als ID aus dem Festival-Ort', async () => {
    const { client, upserts, backlinks } = fakeSupabase([artistRow('fa-1', 'Volbeat')]);
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.events_created).toBe(1);
    expect(result.events_backlinked).toBe(1);
    expect(backlinks).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      title: 'Volbeat at Nova Rock',
      bundesland: 'burgenland',
      district: 'neusiedl am see',
      start_date: '2026-06-11',
    });
  });

  it('meldet abgewiesene Upserts als Fehler und verlinkt nichts', async () => {
    const msg = 'new row for relation "events" violates check constraint "events_bundesland_check"';
    const { client, backlinks } = fakeSupabase([artistRow('fa-1', 'Volbeat'), artistRow('fa-2', 'Kraftklub')], msg);
    const result = await deriveFestivalEvents(client);
    expect(result.events_created).toBe(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('events_bundesland_check');
    expect(backlinks).toHaveLength(0);
  });

  it('zählt Festivals ohne Datum als übersprungen, nicht als Fehler', async () => {
    const tba = { ...NOVA_ROCK, id: 'f-2', slug: 'tba-fest', starts_at: null };
    const { client, upserts } = fakeSupabase([artistRow('fa-3', 'Bilderbuch', tba)]);
    const result = await deriveFestivalEvents(client);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(upserts).toHaveLength(0);
  });
});

// ── Pipeline-Schritt ─────────────────────────────────────────────────────

function stats(derive_errors: string[]): OrchestratorStats {
  return {
    festivals_checked: 9, festivals_skipped_no_scraper: 0, festivals_skipped_unchanged: 6, festivals_changed: 0,
    festivals_errored: 3, artists_added: 0, artists_removed: 0, events_derived: 0, events_backlinked: 0,
    derive_errors, derive_skipped: 0, duration_ms: 0,
  };
}

describe('lineupStepFailure', () => {
  it('macht den Schritt bei Schreibfehlern rot, mit Anzahl und Beispiel', () => {
    const reason = lineupStepFailure(stats(['Upsert error for "Volbeat at Nova Rock": check', 'x']));
    expect(reason).toContain('2 abgeleitete Lineup-Events nicht geschrieben');
    expect(reason).toContain('Volbeat at Nova Rock');
  });

  it('bleibt grün ohne Schreibfehler, auch wenn einzelne Lineup-Seiten nicht erreichbar sind', () => {
    expect(lineupStepFailure(stats([]))).toBeNull();
  });
});

describe('Verdrahtung', () => {
  const pipeline = readFileSync(join(process.cwd(), 'src/scripts/scrape-pipeline.ts'), 'utf8');
  const cli = readFileSync(join(process.cwd(), 'src/scripts/scrape-festival-lineups.ts'), 'utf8');
  const workflow = readFileSync(join(process.cwd(), '.github/workflows/scrape-events.yml'), 'utf8');

  it('läuft als Pipeline-Schritt vor Bewertung und Dedup', () => {
    const idx = pipeline.indexOf("runStep('festival_lineups'");
    expect(idx).toBeGreaterThan(-1);
    expect(pipeline).toMatch(/execStep\([^)]*scrape-festival-lineups\.ts/);
    expect(idx).toBeLessThan(pipeline.indexOf("runStep('scoring'"));
    expect(idx).toBeLessThan(pipeline.indexOf("runStep('dedup'"));
  });

  it('meldet den Grund über reportStepReason und endet mit Exit 1', () => {
    expect(cli).toMatch(/reportStepReason\(failure\)/);
    expect(cli).toMatch(/process\.exit\(1\)/);
  });

  it('hat keinen eigenen Workflow-Schritt mit continue-on-error mehr', () => {
    expect(workflow).not.toMatch(/scrape-festival-lineups/);
  });
});

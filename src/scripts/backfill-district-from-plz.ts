#!/usr/bin/env npx tsx
/**
 * Backfill `events.district` aus der PLZ (fn-19 Retrieval-Fix).
 *
 * Problem: Quellen ohne Bezirksfeld (Feratel, Gemeinde-Kalender, Eventim)
 * lassen district=NULL — der Stadt-Filter der Smart-Suche
 * (`district IN (...)`) schließt diese Events komplett aus. Belegt
 * 2026-07-31: Eisenstadt-Hub zeigt 59 Events, Smart-Suche fand 0.
 *
 * Scope: NUR Zukunfts-Events (start_date >= heute) — nur die sind
 * durchsuchbar (Memory: semantic_search_future_only), und der
 * Datums-Index hält die Selects auf der Micro-Instanz schnell.
 * Vergangenes wandert ohnehin ins Archiv. Neue Events bekommen den
 * Bezirk seit diesem Fix direkt im Schreibpfad (supabase-sync.ts).
 *
 * Mapping: PLZ → kanonischer Bezirk aus src/lib/plz-district.ts
 * (ALL_GEMEINDEN + district-normalizer — identisch zum Schreibpfad).
 *
 * Batching nach CLAUDE.md: Selects paged (limit 1000), Updates in
 * id-Chunks ≤200 (PostgREST .in() läuft über den Query-String).
 * Idempotent: der Select filtert district IS NULL — bereits gefüllte
 * Zeilen tauchen im nächsten Lauf nicht mehr auf.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-district-from-plz.ts            # dry run
 *   npx tsx src/scripts/backfill-district-from-plz.ts --apply    # schreiben
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { districtFromPlz } from '../lib/plz-district';

// ─── env bootstrap (Muster backfill-plz-from-coords.ts) ───────────────
try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  });
} catch { /* no .env.local is fine */ }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes('--apply');
const SELECT_PAGE = 1000;
const UPDATE_CHUNK = 200;

/** Alle 9 kanonischen Bundesland-IDs — pro Bundesland iterieren, damit
 *  der Composite-Index idx_events_bundesland_start_date greift (der
 *  erste Wurf mit ORDER BY id über den Gesamtbestand lief auf der
 *  Micro-Instanz in den Statement-Timeout). Kein ORDER BY, kein Offset:
 *  im Apply-Modus verschwinden gefüllte Zeilen von selbst aus dem
 *  Filter; nicht-mappbare IDs werden übersprungen (Set). */
const BUNDESLAENDER = [
  'burgenland', 'kaernten', 'niederoesterreich', 'oberoesterreich',
  'salzburg', 'steiermark', 'tirol', 'vorarlberg', 'wien',
];

async function main() {
  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  let scanned = 0;
  let mappable = 0;
  let written = 0;
  const perDistrict = new Map<string, number>();
  const unknownPlz = new Map<string, number>();

  for (const bl of BUNDESLAENDER) {
    const seenUnmappable = new Set<string>();
    while (true) {
      const { data, error } = await supabase
        .from('events')
        .select('id, postal_code, bundesland')
        .eq('bundesland', bl)
        .is('district', null)
        .not('postal_code', 'is', null)
        .gte('start_date', todayIso)
        .limit(SELECT_PAGE);
      if (error) {
        console.error(`select failed (${bl}):`, error.message);
        process.exit(1);
      }
      const rows = (data ?? []).filter(r => !seenUnmappable.has(r.id));
      if (rows.length === 0) break;
      scanned += rows.length;

      const byDistrict = new Map<string, string[]>();
      for (const row of rows) {
        const district = districtFromPlz(row.postal_code, row.bundesland);
        if (!district) {
          seenUnmappable.add(row.id);
          unknownPlz.set(row.postal_code, (unknownPlz.get(row.postal_code) ?? 0) + 1);
          continue;
        }
        mappable++;
        perDistrict.set(district, (perDistrict.get(district) ?? 0) + 1);
        const ids = byDistrict.get(district) ?? [];
        ids.push(row.id);
        byDistrict.set(district, ids);
      }

      if (!APPLY) break; // Dry-Run: eine Seite pro Bundesland als Stichprobe

      for (const [district, ids] of byDistrict) {
        for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
          const chunk = ids.slice(i, i + UPDATE_CHUNK);
          // Statement-Timeouts sind auf der Micro-Instanz Lastwellen-
          // Lotterie (erster Lauf starb bei 'imst') — 3 Versuche mit
          // Backoff, dann Chunk überspringen statt Gesamtabbruch
          // (idempotent: der nächste Lauf holt ihn nach).
          let ok = false;
          for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
            const { error: upErr } = await supabase
              .from('events')
              .update({ district })
              .in('id', chunk);
            if (!upErr) {
              ok = true;
            } else {
              console.error(`update failed (${district}, Versuch ${attempt}):`, upErr.message);
              await new Promise(r => setTimeout(r, attempt * 5000));
            }
          }
          if (ok) {
            written += chunk.length;
          } else {
            chunk.forEach(id => seenUnmappable.add(id));
          }
        }
      }
      if (byDistrict.size === 0) break; // nur noch Unmappbare übrig
    }
    console.log(`  [${bl}] bisher: ${mappable} mappbar, ${written} geschrieben`);
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN (1 Seite/Bundesland)'}: ${scanned} Zeilen geprüft, ${mappable} mappbar, ${written} geschrieben`);
  const top = [...perDistrict.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('Top-Bezirke:', top.map(([d, n]) => `${d}=${n}`).join(', '));
  const topUnknown = [...unknownPlz.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topUnknown.length > 0) {
    console.log('Unbekannte PLZ (Top):', topUnknown.map(([p, n]) => `${p}×${n}`).join(', '));
  }
}

main().then(() => process.exit(0));

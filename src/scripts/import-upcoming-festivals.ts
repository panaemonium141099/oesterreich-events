/**
 * Kuratierte kommende Festival-Ausgaben → Supabase.
 *
 * Liest data/festivals-upcoming.json (Recherche-Stand, eine Ausgabe je
 * Festival) und schreibt
 *   • festivals:        Termin, Ort, Website, Ticketlink, Preis, Beschreibung,
 *                       Bild, date_status (Upsert über slug; neue Festivals
 *                       werden angelegt)
 *   • festival_artists: das Lineup der kommenden Ausgabe (ersetzt das alte,
 *                       sobald die Seed-Datei eines liefert; bei Jahrgangs-
 *                       wechsel ohne neues Lineup werden die Vorjahres-Acts
 *                       entfernt, damit die Seite keine 2026er-Acts zu einem
 *                       2027er-Termin zeigt)
 *
 * Die Seed-Datei wird vor dem ersten Schreibzugriff komplett validiert
 * (src/lib/festivals/upcoming.ts); ein einziger Verstoß bricht den Lauf ab.
 *
 * Aufruf:
 *   npm run import:festivals -- [--dry-run] [--fetch-images] [--slug <slug>]
 *
 * --fetch-images: Einträge ohne image_url bekommen das og:image ihrer Website,
 *                 sofern es eine echte Bilddatei ab 600 px Breite ist. Belegte
 *                 Bild-URLs werden ebenfalls geprüft und bei 404/zu klein
 *                 verworfen (Festival fällt dann aufs Kategorie-Bild zurück).
 *
 * Braucht NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateSeedEntry,
  toFestivalRow,
  toLineupRows,
  type UpcomingFestivalSeed,
} from '../lib/festivals/upcoming';
import { fetchOgImage, probeImage } from '../lib/festivals/og-image';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_PATH = resolve(process.cwd(), 'data/festivals-upcoming.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fetchImages = args.includes('--fetch-images');
const onlySlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

function log(msg: string): void {
  console.log(`[import:festivals] ${msg}`);
}

interface ExistingRow {
  id: string;
  slug: string;
  starts_at: string | null;
}

async function loadExisting(supabase: SupabaseClient, slugs: string[]): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  // PostgREST trägt .in() im Query-String: Listen auf ≤200 Elemente chunken.
  for (let i = 0; i < slugs.length; i += 150) {
    const chunk = slugs.slice(i, i + 150);
    const { data, error } = await supabase
      .from('festivals')
      .select('id, slug, starts_at')
      .in('slug', chunk);
    if (error) throw new Error(`festivals lesen: ${error.message}`);
    for (const r of (data ?? []) as ExistingRow[]) map.set(r.slug, r);
  }
  return map;
}

/** Bild-URL prüfen bzw. aus der Website holen. Gibt die finale URL zurück. */
async function resolveImage(e: UpcomingFestivalSeed): Promise<{ url: string | null; note: string }> {
  if (e.image_url) {
    const probe = await probeImage(e.image_url);
    if (probe.ok) return { url: e.image_url, note: `belegt (${probe.width ?? '?'}px)` };
    log(`  ${e.slug}: Bild verworfen (${probe.reason}): ${e.image_url}`);
  }
  if (!e.website_url) return { url: null, note: 'keine Website' };
  const og = await fetchOgImage(e.website_url);
  if (!og) return { url: null, note: 'kein og:image' };
  const probe = await probeImage(og);
  if (!probe.ok) {
    log(`  ${e.slug}: og:image verworfen (${probe.reason}): ${og}`);
    return { url: null, note: `og:image unbrauchbar (${probe.reason})` };
  }
  return { url: og, note: `og:image (${probe.width ?? '?'}px)` };
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY erforderlich');
  }
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  let seeds = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as UpcomingFestivalSeed[];
  if (!Array.isArray(seeds)) throw new Error('Seed-Datei muss ein Array sein');
  if (onlySlug) seeds = seeds.filter(s => s.slug === onlySlug);
  log(`${seeds.length} Einträge aus ${SEED_PATH}${dryRun ? ' (DRY-RUN)' : ''}`);

  // ── Validierung: alles oder nichts ──
  const problems: string[] = [];
  const seenSlugs = new Set<string>();
  for (const e of seeds) {
    for (const err of validateSeedEntry(e, today)) problems.push(`${e.slug ?? '?'}: ${err}`);
    if (seenSlugs.has(e.slug)) problems.push(`${e.slug}: doppelter Slug`);
    seenSlugs.add(e.slug);
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    throw new Error(`${problems.length} Verstöße in der Seed-Datei — nichts geschrieben`);
  }

  // ── Bilder ──
  if (fetchImages) {
    log('Bilder prüfen / og:image holen …');
    let changed = false;
    for (const e of seeds) {
      const before = e.image_url;
      const { url, note } = await resolveImage(e);
      if (url !== before) {
        e.image_url = url;
        changed = true;
      }
      log(`  ${e.slug}: ${note}`);
    }
    if (changed) {
      // Ergebnis zurück in die Seed-Datei (auch im Dry-Run: lokale Datei,
      // nicht die DB), damit der nächste Lauf ohne
      // Netz auskommt und die Datei den gelieferten Stand dokumentiert.
      writeFileSync(SEED_PATH, JSON.stringify(seeds, null, 2) + '\n', 'utf8');
      log('Seed-Datei mit geprüften Bild-URLs aktualisiert');
    }
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const existing = await loadExisting(supabase, seeds.map(s => s.slug));

  let created = 0, updated = 0, lineupsWritten = 0, lineupsCleared = 0, withDate = 0;
  for (const e of seeds) {
    const row = toFestivalRow(e, nowIso);
    const prev = existing.get(e.slug);
    const lineupRows = toLineupRows(e.lineup);
    const editionChanged = !!prev?.starts_at && !!row.starts_at && prev.starts_at.slice(0, 4) !== row.starts_at.slice(0, 4);
    if (row.starts_at) withDate++;

    const action = prev ? 'update' : 'neu';
    log(`${action.padEnd(6)} ${e.slug}  ${row.starts_at ?? 'tba'}..${row.ends_at ?? ''}  ${row.date_status}  acts=${lineupRows.length}${editionChanged ? '  (neuer Jahrgang)' : ''}`);
    if (dryRun) { prev ? updated++ : created++; continue; }

    const upsertRow = {
      ...row,
      ...(prev ? {} : {
        registry_source: 'lasstreffen Recherche 2026-10',
        direct_lineup_candidate: false,
        lineup_status: 'unknown' as const,
      }),
      ...(lineupRows.length > 0 ? {
        lineup_status: 'fetched' as const,
        lineup_fetch_mode: 'manual' as const,
        lineup_last_checked_at: nowIso,
      } : {}),
      updated_at: nowIso,
    };
    const { data: saved, error: upErr } = await supabase
      .from('festivals')
      .upsert(upsertRow, { onConflict: 'slug' })
      .select('id')
      .single();
    if (upErr || !saved) throw new Error(`${e.slug}: upsert fehlgeschlagen: ${upErr?.message ?? 'keine Zeile'}`);
    prev ? updated++ : created++;
    const festivalId = (saved as { id: string }).id;

    // ── Lineup ──
    if (lineupRows.length > 0 || editionChanged) {
      // Backlinks auf abgeleitete Events ("Act at Festival") sauber lösen:
      // delete_derived_event räumt Notifications/Saved mit ab.
      const { data: old, error: oldErr } = await supabase
        .from('festival_artists')
        .select('id, derived_event_id')
        .eq('festival_id', festivalId);
      if (oldErr) throw new Error(`${e.slug}: festival_artists lesen: ${oldErr.message}`);
      for (const o of (old ?? []) as Array<{ id: string; derived_event_id: string | null }>) {
        if (!o.derived_event_id) continue;
        const { error: rpcErr } = await supabase.rpc('delete_derived_event', { p_event_id: o.derived_event_id });
        if (rpcErr) log(`  ${e.slug}: derived event ${o.derived_event_id} nicht gelöscht: ${rpcErr.message}`);
      }
      const { error: delErr } = await supabase.from('festival_artists').delete().eq('festival_id', festivalId);
      if (delErr) throw new Error(`${e.slug}: festival_artists löschen: ${delErr.message}`);
      if (lineupRows.length > 0) {
        const { error: insErr } = await supabase
          .from('festival_artists')
          .insert(lineupRows.map(r => ({ ...r, festival_id: festivalId })));
        if (insErr) throw new Error(`${e.slug}: festival_artists einfügen: ${insErr.message}`);
        lineupsWritten++;
      } else {
        lineupsCleared++;
        const { error: stErr } = await supabase
          .from('festivals')
          .update({ lineup_status: 'unknown', lineup_last_checked_at: nowIso })
          .eq('id', festivalId);
        if (stErr) throw new Error(`${e.slug}: lineup_status zurücksetzen: ${stErr.message}`);
      }
    }
  }

  log(`Fertig: ${created} neu, ${updated} aktualisiert, ${withDate} mit Termin, ${lineupsWritten} Lineups geschrieben, ${lineupsCleared} Vorjahres-Lineups entfernt${dryRun ? ' (DRY-RUN, nichts geschrieben)' : ''}`);
}

main().catch(err => {
  console.error('[import:festivals] FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});

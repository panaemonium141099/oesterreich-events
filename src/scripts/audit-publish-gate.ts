/**
 * Bestandsprüfung gegen den zentralen Freigabevertrag.
 *
 * Läuft `evaluateAdmission()` über die aktuell VERÖFFENTLICHTEN künftigen
 * Events und meldet, welche davon der Vertrag nicht mehr durchlassen
 * würde. Der Eingang ist ab fn-24 abgesichert (supabase-sync.ts) — dieses
 * Skript räumt auf, was vor der Absicherung durchgerutscht ist.
 *
 * Es LÖSCHT NICHTS. Betroffene Zeilen bekommen `publish_status =
 * 'needs_review'`; sie bleiben in der DB und im Admin sichtbar und können
 * durch bessere Quelldaten jederzeit wieder freigegeben werden.
 * `duplicate` und andere nicht-berechnete Status werden nicht angefasst.
 *
 * Usage:
 *   npx tsx src/scripts/audit-publish-gate.ts                 # Dry-Run (Default)
 *   npx tsx src/scripts/audit-publish-gate.ts --apply         # schreibt needs_review
 *   npx tsx src/scripts/audit-publish-gate.ts --limit 5000    # nur die ersten N
 *   npx tsx src/scripts/audit-publish-gate.ts --source meetup.com
 *
 * Der Dry-Run schreibt zusätzlich
 * `data/classifier-audit/publish-gate-<datum>.json` mit jeder betroffenen
 * Zeile (alt → neu, Gründe, öffentliche URL), damit die Änderung vor dem
 * Anwenden vergleichbar ist.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  evaluateAdmission,
  type AdmissionCorrection,
  type AdmissionReason,
} from '../lib/quality/admission';
import { bundeslandFromPolygon } from '../lib/eventim/bundesland-from-geo';
import { getBundeslandFromPLZ } from '../lib/plzCoordinates';

// .env.local laden (tsx tut das nicht von selbst).
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
} catch { /* auf Umgebungsvariablen verlassen */ }

const APPLY = process.argv.includes('--apply');
const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const LIMIT = Number(argValue('--limit') ?? '0') || Infinity;
const SOURCE = argValue('--source');

// Klein halten: die Supabase-Micro-Instanz läuft bei breiten Scans über
// `events` (~280k Zeilen) ins Statement-Timeout (MASTERPLAN §10.1).
const PAGE = 500;

/** Statuswerte, die dieses Skript überhaupt anfassen darf. */
const TOUCHABLE = new Set(['published', 'published_low_confidence']);

interface Row {
  id: string;
  source_name: string | null;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoding_confidence: string | null;
  publish_status: string | null;
}

const SELECT =
  'id,source_name,title,slug,start_date,end_date,location_name,address,postal_code,' +
  'bundesland,country,latitude,longitude,geocoding_confidence,publish_status';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const today = new Date().toISOString().slice(0, 10);
  console.log(
    `Freigabevertrag gegen Bestand — ${APPLY ? 'ANWENDEN' : 'DRY-RUN'}` +
      `${SOURCE ? `, nur source_name=${SOURCE}` : ''}\n`,
  );

  const reasonCounts: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const affected: Array<{
    id: string;
    source_name: string | null;
    title: string;
    start_date: string;
    location_name: string | null;
    bundesland: string | null;
    latitude: number | null;
    longitude: number | null;
    geocoding_confidence: string | null;
    from_status: string | null;
    to_status: string;
    reasons: AdmissionReason[];
    corrections: AdmissionCorrection[];
    /** Bei use_coordinate_region: das per Polygon+PLZ belegte Bundesland. */
    corrected_bundesland?: string;
    url: string | null;
  }> = [];

  // Auflösbare Widersprüche: das Event bleibt publik, nur die widerlegte
  // Angabe wird entfernt bzw. korrigiert.
  const correctable: Array<{
    id: string;
    corrections: AdmissionCorrection[];
    corrected_bundesland?: string;
    /** Vorher-Werte — machen den Lauf aus dem Report heraus umkehrbar. */
    before: {
      latitude: number | null;
      longitude: number | null;
      bundesland: string | null;
      geocoding_confidence: string | null;
    };
    title: string;
    location_name: string | null;
    source_name: string | null;
  }> = [];
  const correctionCounts: Record<string, number> = {};

  let scanned = 0;
  let cursor = '';
  let pages = 0;
  let retries = 0;
  let incomplete = false;
  const MAX_RETRIES = 5;

  // Keyset-Pagination über die id — stabil, auch wenn `--apply` die
  // Filtermenge während des Laufs verkleinert.
  for (;;) {
    let q = supabase
      .from('events')
      .select(SELECT)
      .gte('start_date', today)
      .in('publish_status', [...TOUCHABLE])
      .order('id', { ascending: true })
      .limit(PAGE);
    if (cursor) q = q.gt('id', cursor);
    if (SOURCE) q = q.eq('source_name', SOURCE);

    const { data, error } = await q;
    if (error) {
      // Ein Timeout darf den Lauf nicht abbrechen — kurz warten und
      // dieselbe Seite erneut versuchen (cursor unverändert). Aber NICHT
      // endlos: eine Seite, die dauerhaft ins Statement-Timeout läuft,
      // würde sonst eine Endlosschleife erzeugen.
      retries++;
      console.error(`\nFetch-Fehler (Seite ${pages}, Versuch ${retries}/${MAX_RETRIES}): ${error.message}`);
      if (retries >= MAX_RETRIES) {
        console.error('Zu viele Fehlversuche — Lauf ist UNVOLLSTÄNDIG, breche ab.');
        incomplete = true;
        break;
      }
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    retries = 0;
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      const verdict = evaluateAdmission(
        {
          title: row.title,
          start_date: row.start_date,
          end_date: row.end_date,
          location_name: row.location_name,
          address: row.address,
          postal_code: row.postal_code,
          bundesland: row.bundesland,
          country: row.country,
          latitude: row.latitude,
          longitude: row.longitude,
        },
        { regionOf: bundeslandFromPolygon, plzRegionOf: getBundeslandFromPLZ },
      );

      if (verdict.corrections.length > 0) {
        for (const c of verdict.corrections) correctionCounts[c] = (correctionCounts[c] ?? 0) + 1;
        correctable.push({
          id: row.id,
          corrections: verdict.corrections,
          corrected_bundesland: verdict.correctedBundesland,
          before: {
            latitude: row.latitude,
            longitude: row.longitude,
            bundesland: row.bundesland,
            geocoding_confidence: row.geocoding_confidence,
          },
          title: row.title,
          location_name: row.location_name,
          source_name: row.source_name,
        });
      }

      if (verdict.decision === 'admit') continue;

      // `reject`-Gründe (z. B. rückwärts laufendes Intervall) führen im
      // Bestand ebenfalls zu needs_review — gelöscht wird hier nichts.
      for (const r of verdict.reasons) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
      const src = row.source_name ?? 'unbekannt';
      bySource[src] = (bySource[src] ?? 0) + 1;

      affected.push({
        id: row.id,
        source_name: row.source_name,
        title: row.title,
        start_date: row.start_date,
        location_name: row.location_name,
        bundesland: row.bundesland,
        latitude: row.latitude,
        longitude: row.longitude,
        geocoding_confidence: row.geocoding_confidence,
        from_status: row.publish_status,
        to_status: 'needs_review',
        reasons: verdict.reasons,
        corrections: verdict.corrections,
        corrected_bundesland: verdict.correctedBundesland,
        url: row.slug ? `https://lasstreffen.at/events/${row.slug}` : null,
      });
    }

    cursor = rows[rows.length - 1].id;
    pages++;
    process.stdout.write(
      `\r  geprüft: ${scanned}, quarantäne: ${affected.length}, korrigierbar: ${correctable.length}`,
    );
    if (rows.length < PAGE) break;
    if (scanned >= LIMIT) break;
  }
  process.stdout.write('\n\n');

  // ── Report ────────────────────────────────────────────────────────
  const pct = (n: number) => ((n / Math.max(1, scanned)) * 100).toFixed(2);
  console.log(`Geprüft:      ${scanned} veröffentlichte künftige Events`);
  console.log(`Quarantäne:   ${affected.length} (${pct(affected.length)} %) — verlieren die Veröffentlichung`);
  console.log(`Korrigierbar: ${correctable.length} (${pct(correctable.length)} %) — bleiben publik, widerlegte Angabe wird entfernt\n`);

  if (Object.keys(correctionCounts).length > 0) {
    console.log('Korrekturen:');
    for (const [c, n] of Object.entries(correctionCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(6)}  ${c}`);
    }
    console.log('');
  }

  console.log('Quarantäne nach Grund:');
  for (const [reason, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${reason}`);
  }
  console.log('\nNach Quelle (Top 15):');
  for (const [src, n] of Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(6)}  ${src}`);
  }

  const outDir = join(process.cwd(), 'data', 'classifier-audit');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `publish-gate-${today}.json`);
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        scanned,
        incomplete,
        reasonCounts,
        correctionCounts,
        bySource,
        affected,
        correctable,
      },
      null,
      2,
    ),
  );
  console.log(`\nDetails: ${outFile}`);

  if (incomplete) {
    console.log(
      '\nACHTUNG: Der Lauf ist unvollständig (Abbruch nach wiederholten DB-Fehlern).\n' +
        'Die Zahlen oben decken nur den geprüften Teil ab.',
    );
  }

  if (!APPLY) {
    console.log('\nDry-Run — nichts geschrieben. Mit --apply anwenden.');
    return;
  }

  // ── Anwenden ──────────────────────────────────────────────────────
  // Zuerst die Korrekturen: sie halten Events publik und entfernen nur die
  // widerlegte Angabe. Danach erst die Quarantäne.
  if (correctable.length > 0) {
    console.log(`\nWende ${correctable.length} Korrekturen an …`);
    let fixed = 0;
    let fixFailed = 0;
    for (const c of correctable) {
      const patch: Record<string, unknown> = {};
      if (c.corrections.includes('drop_coordinates')) {
        // Kein falscher Pin mehr. Die Herkunftsfelder müssen mit gelöscht
        // werden, sonst behauptet die Zeile eine Genauigkeit ohne Koordinate.
        patch.latitude = null;
        patch.longitude = null;
        patch.geocoding_confidence = null;
        patch.geocoding_source = null;
      }
      if (c.corrections.includes('use_coordinate_region') && c.corrected_bundesland) {
        patch.bundesland = c.corrected_bundesland;
      }
      if (Object.keys(patch).length === 0) continue;
      // supabase-js wirft NICHT bei Schreibfehlern — Result prüfen.
      const { error } = await supabase.from('events').update(patch).eq('id', c.id);
      if (error) {
        console.error(`  ${c.id}: ${error.message}`);
        fixFailed++;
      } else {
        fixed++;
      }
      if (fixed % 50 === 0) process.stdout.write(`\r  ${fixed}/${correctable.length}`);
    }
    console.log(`\r  ${fixed} korrigiert, ${fixFailed} fehlgeschlagen.`);
    if (fixFailed > 0) process.exitCode = 1;
  }

  console.log(`\nSetze ${affected.length} Zeilen auf needs_review …`);
  let updated = 0;
  let failed = 0;
  const CHUNK = 100;
  for (let i = 0; i < affected.length; i += CHUNK) {
    const ids = affected.slice(i, i + CHUNK).map(a => a.id);
    // supabase-js wirft NICHT bei Schreibfehlern — der Fehler steht im
    // Result-Objekt und muss geprüft werden, sonst meldet das Skript
    // Erfolg, ohne etwas geschrieben zu haben.
    const { error } = await supabase
      .from('events')
      .update({ publish_status: 'needs_review' })
      .in('id', ids)
      // Doppelte Absicherung gegen Races: nur berührbare Status ändern.
      .in('publish_status', [...TOUCHABLE]);
    if (error) {
      console.error(`  Chunk ${i}: ${error.message}`);
      failed += ids.length;
    } else {
      updated += ids.length;
    }
    process.stdout.write(`\r  ${updated}/${affected.length}`);
  }
  console.log(`\n\nFertig: ${updated} aktualisiert, ${failed} fehlgeschlagen.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * Restore Coordinates — Reads a coord-backup JSON file and restores event coordinates.
 *
 * Used as rollback mechanism for the fix-geocoding migration.
 *
 * Usage:
 *   npx tsx src/scripts/restore-coords.ts data/coord-backup-2026-04-04.json
 *   npx tsx src/scripts/restore-coords.ts data/coord-backup-2026-04-04.json --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// ─── Auth: service role key ONLY ───────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('This script requires the service role key. The anon key is NOT accepted.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── CLI args ──────────────────────────────────────────────────────────────
const backupFilePath = process.argv[2];
const isDryRun = process.argv.includes('--dry-run');

if (!backupFilePath) {
  console.error('Usage: npx tsx src/scripts/restore-coords.ts <backup-file.json> [--dry-run]');
  console.error('Example: npx tsx src/scripts/restore-coords.ts data/coord-backup-2026-04-04.json');
  process.exit(1);
}

if (!fs.existsSync(backupFilePath)) {
  console.error(`ERROR: Backup file not found: ${backupFilePath}`);
  process.exit(1);
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface BackupEntry {
  id: string;
  old_latitude: number | null;
  old_longitude: number | null;
  old_geocoding_confidence: string | null;
  old_geocoding_source: string | null;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nRestore Coordinates — ${isDryRun ? 'DRY RUN' : 'LIVE MODE'}`);
  console.log('='.repeat(60));
  console.log(`  Backup file: ${backupFilePath}`);

  const raw = fs.readFileSync(backupFilePath, 'utf-8');
  const entries: BackupEntry[] = JSON.parse(raw);
  console.log(`  Entries in backup: ${entries.length}`);

  if (entries.length === 0) {
    console.log('  Nothing to restore.');
    return;
  }

  // Validate structure
  const sample = entries[0];
  if (!('id' in sample) || !('old_latitude' in sample)) {
    console.error('ERROR: Backup file does not have expected format (missing id or old_latitude)');
    process.exit(1);
  }

  const BATCH_SIZE = 100;
  let restored = 0;
  let errors = 0;
  const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    if (!isDryRun) {
      const promises = batch.map(entry =>
        supabase
          .from('events')
          .update({
            latitude: entry.old_latitude,
            longitude: entry.old_longitude,
            geocoding_confidence: entry.old_geocoding_confidence,
            geocoding_source: entry.old_geocoding_source,
          })
          .eq('id', entry.id)
      );

      const results = await Promise.all(promises);
      const batchErrors = results.filter(r => r.error);
      if (batchErrors.length > 0) {
        console.error(`  Batch ${batchNum}: ${batchErrors.length} errors`);
        errors += batchErrors.length;
      }
    }

    restored += batch.length;
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} — ${restored}/${entries.length} restored...\r`);
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('RESTORE REPORT');
  console.log('='.repeat(60));
  console.log(`  Total entries:  ${entries.length}`);
  console.log(`  Restored:       ${restored}`);
  console.log(`  Errors:         ${errors}`);

  if (isDryRun) {
    console.log(`\n  DRY RUN — no changes applied. Run without --dry-run to restore.`);
  } else {
    console.log(`\n  Restore complete.`);
  }
}

main().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});

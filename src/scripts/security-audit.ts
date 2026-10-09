// src/scripts/security-audit.ts
//
// Nächtlicher Wächter: Gibt es in public SECURITY-DEFINER-Funktionen, die
// schreiben und für anon ausführbar sind? Dann kann jeder mit dem öffentlichen
// Anon-Key Events verstecken/freischalten (Befund 2026-10-08: neun solche
// Funktionen nach dem Umzug auf Hetzner, Migrationsdateien und Prod wichen ab).
// Prüft den ECHTEN Prod-Zustand über die RPC audit_public_write_rpcs()
// (Migration 20261008120000). Fund → Exit 1 → Pipeline-Schritt rot → Alarm.
//
// Usage: npx tsx src/scripts/security-audit.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { reportStepReason } from '@/lib/pipeline/step-reason';

try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0 && !process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
  }
} catch { /* ignore */ }

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc('audit_public_write_rpcs');
  if (error) throw new Error(`audit_public_write_rpcs: ${error.message}`);
  const open = (data ?? []) as Array<{ function_signature: string }>;
  console.log('=== Security-Audit ===');
  console.log(`  Für anon/authenticated ausführbare schreibende SECURITY-DEFINER-Funktionen: ${open.length}`);
  for (const f of open) console.log(`    - ${f.function_signature}`);
  if (open.length > 0) {
    console.log('\n!!! ALARM: anon oder authenticated (jede Registrierung) kann über diese Funktionen schreiben. REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated (Muster: supabase/migrations/20261008120000_*.sql).');
    reportStepReason(`anon/authenticated darf schreiben über: ${open.map(f => f.function_signature).join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

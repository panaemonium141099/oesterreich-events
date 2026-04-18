/**
 * Install a Google Service-Account JSON into .env.local as a single-line
 * `GOOGLE_INDEXING_API_SA_KEY=...` entry, with the private_key's real
 * newlines properly escaped as literal `\n` so env-var parsers don't
 * choke. Avoids the "DECODER routines::unsupported" trap you get when
 * raw newlines survive into the private_key and Node's crypto refuses
 * to parse the PEM.
 *
 * Usage:
 *   npx tsx src/scripts/install-google-sa.ts path/to/your-service-account.json
 *
 * Safe to run repeatedly — replaces any existing line for the same
 * env-var name.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_VAR_NAME = 'GOOGLE_INDEXING_API_SA_KEY';
const ENV_FILE = join(process.cwd(), '.env.local');

function fail(msg: string): never {
  console.error('\n❌ ' + msg);
  process.exit(1);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  fail('Usage: npx tsx src/scripts/install-google-sa.ts <path-to-service-account.json>');
}
if (!existsSync(jsonPath)) {
  fail(`File not found: ${jsonPath}`);
}

const raw = readFileSync(jsonPath, 'utf-8');

let parsed: Record<string, unknown>;
try {
  parsed = JSON.parse(raw) as Record<string, unknown>;
} catch (err) {
  fail(`Not valid JSON: ${err instanceof Error ? err.message : err}`);
}

if (
  parsed.type !== 'service_account' ||
  typeof parsed.client_email !== 'string' ||
  typeof parsed.private_key !== 'string' ||
  typeof parsed.token_uri !== 'string'
) {
  fail('JSON does not look like a Google service account (missing type/client_email/private_key/token_uri).');
}

// JSON.stringify will escape all newlines in private_key as \n automatically.
// This gives us a clean single-line value that .env.local loaders can eat.
const singleLineJson = JSON.stringify(parsed);

// Build the env-var line.
const line = `${ENV_VAR_NAME}=${singleLineJson}`;

// Merge into existing .env.local.
let existing = '';
if (existsSync(ENV_FILE)) {
  existing = readFileSync(ENV_FILE, 'utf-8');
}

const lines = existing.split('\n');
let replaced = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith(`${ENV_VAR_NAME}=`)) {
    lines[i] = line;
    replaced = true;
    break;
  }
}
if (!replaced) {
  if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
  lines.push(line);
}

writeFileSync(ENV_FILE, lines.join('\n'), 'utf-8');

console.log(`\n✓ ${replaced ? 'Updated' : 'Added'} ${ENV_VAR_NAME} in .env.local`);
console.log(`  client_email: ${parsed.client_email}`);
console.log(`  project_id:   ${parsed.project_id ?? '(not set)'}`);
console.log(`  private_key:  ${(parsed.private_key as string).length} chars, starts with ${JSON.stringify((parsed.private_key as string).slice(0, 30))}`);
console.log('\nTest the setup now:');
console.log('  npm run submit-indexing -- --google-only --limit 3');

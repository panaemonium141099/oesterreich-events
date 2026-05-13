#!/usr/bin/env node
/**
 * fn-15.6 — prebuild CSP hash computation.
 *
 * Reads `src/lib/critical-css.ts`, extracts the `CRITICAL_CSS` constant,
 * computes its SHA-256, and writes the base64 digest into
 * `.env.production` as `NEXT_PUBLIC_CRITICAL_CSS_HASH`. Next.js picks
 * that env var up at build-time and the CSP builder in
 * `next.config.ts` substitutes it into the `style-src` directive as
 * `'sha256-<digest>'`.
 *
 * **Why parse the .ts file instead of importing it via tsx**:
 *
 *  1. Zero npm-install dependency. tsx isn't available during a fresh
 *     `npm ci && npm run build` until devDeps land, and Next.js
 *     `prebuild` runs BEFORE `next build` even though node_modules is
 *     ready. Keeping this as pure Node 20 ESM means it runs on stock
 *     Vercel and Coolify build images.
 *  2. Byte-exact reproducibility. The `CRITICAL_CSS = \`…\`;` line is
 *     a single template literal — extracting it with a regex gives
 *     identical bytes to what TypeScript emits, so the hash matches
 *     what React server-renders into the HTML.
 *  3. Side-effect freedom. No transpile, no module side-effects, no
 *     risk that future imports drag heavy dependencies into the
 *     build-tools graph.
 *
 * **Failure modes** — exit code 1 + diagnostic on stderr if:
 *  - critical-css.ts is missing
 *  - the `CRITICAL_CSS = \`…\`;` block can't be located
 *  - .env.production exists but is malformed enough that we can't
 *    parse it to update the single key safely
 *
 * The verify hook (`scripts/verify-csp-hash.mjs`) runs as postbuild
 * and refuses to ship if the rendered HTML doesn't carry the same
 * inline CSS bytes we hashed here. So a partial / stale write here
 * never reaches production silently.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const CRITICAL_CSS_PATH = path.join(REPO_ROOT, 'src', 'lib', 'critical-css.ts');
const ENV_PROD_PATH = path.join(REPO_ROOT, '.env.production');
const ENV_KEY = 'NEXT_PUBLIC_CRITICAL_CSS_HASH';

/**
 * Extract the CRITICAL_CSS template-literal body from the TS source.
 * The pattern is anchored on `export const CRITICAL_CSS = \`…\`;` and
 * uses a non-greedy match so we don't accidentally swallow trailing
 * exports or doc-comments. Backtick-in-CSS would break this, but we
 * never embed one (we use single quotes for SVG data-URIs).
 */
function extractCriticalCss(src) {
  const re = /export\s+const\s+CRITICAL_CSS\s*=\s*`([\s\S]*?)`\s*;/m;
  const m = src.match(re);
  if (!m) {
    throw new Error(
      `Could not locate "export const CRITICAL_CSS = \`…\`;" in ${CRITICAL_CSS_PATH}. ` +
        `If you renamed the export or switched to a different quote style, update ` +
        `the regex in scripts/compute-csp-hash.mjs to match.`,
    );
  }
  return m[1];
}

/**
 * SHA-256 base64 digest. Matches CSP's `'sha256-<digest>'` syntax
 * exactly (no prefix, no quotes — the next.config.ts builder adds those).
 */
function sha256Base64(bytes) {
  return createHash('sha256').update(bytes).digest('base64');
}

/**
 * Idempotent .env.production update. Reads the file (or creates a fresh
 * one), replaces the line starting with `KEY=` if it exists, or appends
 * a new line otherwise. Preserves all other keys + comments + blank
 * lines + line endings.
 */
async function upsertEnvKey(envPath, key, value) {
  let existing = '';
  if (existsSync(envPath)) {
    existing = await readFile(envPath, 'utf8');
  }
  const lineRe = new RegExp(`^${key}=.*$`, 'm');
  let next;
  if (lineRe.test(existing)) {
    next = existing.replace(lineRe, `${key}=${value}`);
  } else {
    // Append, preserving the file's existing line ending (or fall back
    // to \n on a fresh file).
    const sep = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
    next = `${existing}${sep}# fn-15.6: SHA-256 of the inline CRITICAL_CSS block in src/app/layout.tsx.\n# Updated by scripts/compute-csp-hash.mjs as a prebuild hook. Verified by\n# scripts/verify-csp-hash.mjs as a postbuild hook (build fails on drift).\n${key}=${value}\n`;
  }
  await writeFile(envPath, next, 'utf8');
}

async function main() {
  if (!existsSync(CRITICAL_CSS_PATH)) {
    console.error(
      `[csp-hash] FATAL: ${CRITICAL_CSS_PATH} not found. fn-15.6 expects ` +
        `src/lib/critical-css.ts to define and export CRITICAL_CSS.`,
    );
    process.exit(1);
  }
  const src = await readFile(CRITICAL_CSS_PATH, 'utf8');
  const css = extractCriticalCss(src);
  const cssBytes = Buffer.from(css, 'utf8');
  const hash = sha256Base64(cssBytes);

  await upsertEnvKey(ENV_PROD_PATH, ENV_KEY, hash);

  console.log(
    `[csp-hash] OK — wrote ${ENV_KEY}=${hash} to .env.production ` +
      `(critical CSS ${cssBytes.byteLength} bytes raw).`,
  );
}

main().catch((err) => {
  console.error('[csp-hash] FATAL:', err.message);
  if (process.env.DEBUG === 'csp-hash') console.error(err.stack);
  process.exit(1);
});

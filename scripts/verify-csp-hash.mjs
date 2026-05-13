#!/usr/bin/env node
/**
 * fn-15.6 — postbuild CSP hash verification.
 *
 * After `next build` finishes, the static HTML for the landing route
 * lives at `.next/server/app/index.html` (and `.next/server/app/index.body`
 * for the streamed body chunk). This script:
 *
 *  1. Re-reads `src/lib/critical-css.ts` and computes the SHA-256 just
 *     like the prebuild hook did.
 *  2. Recursively scans `.next/server/app/**\/*.html` for any
 *     `<style data-critical-css>…</style>` block.
 *  3. For each block, recomputes the SHA-256 of the inline body and
 *     compares against the expected hash.
 *
 * If any block's hash differs from the expected one, the script exits
 * with code 1 and a diagnostic. Two intentional non-failure paths:
 *
 *  - If no `data-critical-css` block is found at all, that means the
 *    landing layout doesn't render the inline `<style>` and there's
 *    nothing to lock down — we log a warning and exit 0. (Useful
 *    during the initial fn-15.6 rollout if the layout hasn't been
 *    updated yet.)
 *  - If `.next/server/app` doesn't exist (e.g. someone ran the script
 *    without a prior `next build`), we log a warning and exit 0.
 *
 * Everything else is fail-fast: a hash mismatch means the deployed
 * HTML would carry `<style>` bytes that the CSP's `'sha256-<…>'`
 * wouldn't whitelist, breaking the landing render entirely.
 *
 * Implementation notes:
 *  - No external deps. Pure Node 20 ESM, same as compute-csp-hash.mjs.
 *  - Uses the same template-literal extraction regex so the two
 *    scripts can never drift apart.
 *  - The HTML scan is done via String.indexOf — not a DOM parser —
 *    because the Next.js minifier emits the `<style>` block with
 *    deterministic delimiters and we want byte-identical extraction.
 *    A DOM parser would re-encode entities and corrupt the hash.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const CRITICAL_CSS_PATH = path.join(REPO_ROOT, 'src', 'lib', 'critical-css.ts');
const APP_BUILD_DIR = path.join(REPO_ROOT, '.next', 'server', 'app');
// fn-15.6 marker — the layout renders `<style data-critical-css>…</style>`
// so this scan is robust even if Next.js shuffles other inline styles
// (font-face, third-party widgets) into the HTML. The attribute is
// stripped from CSP's hash check (CSP hashes the text content only).
const STYLE_OPEN_RE = /<style\s+data-critical-css[^>]*>/;
const STYLE_CLOSE = '</style>';

function extractCriticalCss(src) {
  const re = /export\s+const\s+CRITICAL_CSS\s*=\s*`([\s\S]*?)`\s*;/m;
  const m = src.match(re);
  if (!m) {
    throw new Error(
      `Could not locate "export const CRITICAL_CSS = \`…\`;" in ${CRITICAL_CSS_PATH}.`,
    );
  }
  return m[1];
}

function sha256Base64(bytes) {
  return createHash('sha256').update(bytes).digest('base64');
}

/**
 * Recursively walk a directory yielding absolute paths of files
 * matching `predicate`. Async iterator so we can stream and stop
 * early if needed without ballooning memory on big build outputs.
 */
async function* walk(dir, predicate) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(full, predicate);
    } else if (ent.isFile() && predicate(full)) {
      yield full;
    }
  }
}

/**
 * Find every `<style data-critical-css>…</style>` block in `html` and
 * return their inner-text bodies (verbatim — we hash byte-for-byte).
 * Returns an array because the same HTML can theoretically carry more
 * than one block; in practice the layout emits exactly one.
 */
function extractInlineCriticalBlocks(html) {
  const out = [];
  let cursor = 0;
  while (cursor < html.length) {
    const openMatch = STYLE_OPEN_RE.exec(html.slice(cursor));
    if (!openMatch) break;
    const openAbs = cursor + openMatch.index;
    const bodyStart = openAbs + openMatch[0].length;
    const closeAbs = html.indexOf(STYLE_CLOSE, bodyStart);
    if (closeAbs === -1) {
      // Malformed HTML — bail. Should never happen with Next.js output.
      break;
    }
    out.push(html.slice(bodyStart, closeAbs));
    cursor = closeAbs + STYLE_CLOSE.length;
  }
  return out;
}

async function main() {
  if (!existsSync(CRITICAL_CSS_PATH)) {
    console.error(`[csp-verify] FATAL: ${CRITICAL_CSS_PATH} missing.`);
    process.exit(1);
  }
  if (!existsSync(APP_BUILD_DIR)) {
    console.warn(
      `[csp-verify] WARN: ${APP_BUILD_DIR} not found — did you run "next build"? ` +
        `Skipping verification (exit 0).`,
    );
    return;
  }

  const src = await readFile(CRITICAL_CSS_PATH, 'utf8');
  const expectedCss = extractCriticalCss(src);
  const expectedHash = sha256Base64(Buffer.from(expectedCss, 'utf8'));

  let htmlScanned = 0;
  let blocksFound = 0;
  const mismatches = [];

  for await (const htmlPath of walk(APP_BUILD_DIR, (p) => p.endsWith('.html'))) {
    htmlScanned++;
    const html = await readFile(htmlPath, 'utf8');
    const blocks = extractInlineCriticalBlocks(html);
    if (blocks.length === 0) continue;
    for (const body of blocks) {
      blocksFound++;
      const actualHash = sha256Base64(Buffer.from(body, 'utf8'));
      if (actualHash !== expectedHash) {
        mismatches.push({
          file: path.relative(REPO_ROOT, htmlPath),
          expectedHash,
          actualHash,
          actualBytes: Buffer.byteLength(body, 'utf8'),
          expectedBytes: Buffer.byteLength(expectedCss, 'utf8'),
        });
      }
    }
  }

  // fn-15.6 round 2 (codex re-review): zero-blocks-found is now a HARD
  // FAILURE. Previously this returned 0 with a warning, which let a
  // regression to <style data-critical-css> in layout.tsx silently ship
  // an unprotected (CSP-blocked) production. The layout MUST always
  // emit the marked block — verify it does.
  if (blocksFound === 0) {
    console.error(
      `[csp-verify] FATAL: scanned ${htmlScanned} HTML file(s), found 0 ` +
        `<style data-critical-css> block(s). The CSP header references ` +
        `sha256-${expectedHash} for style-src, so the inline critical-CSS ` +
        `<style> in layout.tsx is REQUIRED — otherwise the landing paints ` +
        `unstyled (CSP blocks every style source). Check that ` +
        `src/app/layout.tsx still renders <style data-critical-css>.`,
    );
    process.exit(1);
  }

  if (mismatches.length > 0) {
    console.error(
      `[csp-verify] FATAL: ${mismatches.length} hash mismatch(es) found ` +
        `among ${blocksFound} block(s) across ${htmlScanned} HTML file(s):`,
    );
    for (const m of mismatches) {
      console.error(`  - ${m.file}`);
      console.error(`      expected sha256-${m.expectedHash} (${m.expectedBytes} bytes)`);
      console.error(`      actual   sha256-${m.actualHash} (${m.actualBytes} bytes)`);
    }
    console.error(
      `[csp-verify] The CSP header references sha256-${expectedHash} for style-src, ` +
        `but the rendered HTML inline-style would hash to something different — ` +
        `the browser would refuse to apply it and the landing would paint unstyled. ` +
        `Re-run "node scripts/compute-csp-hash.mjs" and rebuild.`,
    );
    process.exit(1);
  }

  // fn-15.6 round 2 (codex re-review): also verify that the routes-manifest
  // CSP response header actually references the same hash. If next.config.ts
  // somehow ships a CSP without the hash (e.g. env-loading regression), the
  // inline <style> would be CSP-blocked at runtime even though both Worker
  // and HTML check out. routes-manifest.json is generated by `next build` —
  // .next/routes-manifest.json — and contains the resolved headers per route.
  const manifestPath = path.join(REPO_ROOT, '.next', 'routes-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const cspHeaders = [];
      // Headers entries shape: { source, headers: [{key, value}, ...], regex }
      for (const entry of manifest.headers ?? []) {
        for (const h of entry.headers ?? []) {
          if (h.key === 'Content-Security-Policy') {
            cspHeaders.push({ source: entry.source, value: h.value });
          }
        }
      }
      if (cspHeaders.length === 0) {
        console.error(
          `[csp-verify] FATAL: routes-manifest.json contains no ` +
            `Content-Security-Policy header. next.config.ts headers() may have ` +
            `failed to register CSP — without it, ` +
            `style-src has no whitelist for the inline <style>.`,
        );
        process.exit(1);
      }
      const expected = `sha256-${expectedHash}`;
      const missingHash = cspHeaders.filter((h) => !h.value.includes(expected));
      if (missingHash.length > 0) {
        console.error(
          `[csp-verify] FATAL: ${missingHash.length}/${cspHeaders.length} CSP header(s) ` +
            `in routes-manifest.json do NOT contain the expected ` +
            `style-src 'sha256-${expectedHash}'.`,
        );
        for (const h of missingHash) {
          console.error(`  - source="${h.source}"`);
          console.error(`    csp=${h.value.slice(0, 200)}…`);
        }
        console.error(
          `[csp-verify] The CSP-hash JSON artifact may not have reached ` +
            `next.config.ts at build time. Verify .csp-hash.json exists and ` +
            `loadCriticalCssHash() in next.config.ts reads it correctly.`,
        );
        process.exit(1);
      }
      console.log(
        `[csp-verify] OK — routes-manifest.json: ${cspHeaders.length} CSP header(s) ` +
          `all contain style-src 'sha256-${expectedHash}'.`,
      );
    } catch (err) {
      console.warn(
        `[csp-verify] WARN: routes-manifest.json present but unparseable: ${err.message}. ` +
          `Skipping CSP header check.`,
      );
    }
  } else {
    console.warn(
      `[csp-verify] WARN: ${manifestPath} not found — skipping CSP header check.`,
    );
  }

  console.log(
    `[csp-verify] OK — ${blocksFound} <style data-critical-css> block(s) ` +
      `across ${htmlScanned} HTML file(s) all hash to sha256-${expectedHash}.`,
  );
}

main().catch((err) => {
  console.error('[csp-verify] FATAL:', err.message);
  if (process.env.DEBUG === 'csp-verify') console.error(err.stack);
  process.exit(1);
});

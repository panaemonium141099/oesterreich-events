#!/usr/bin/env node
/**
 * Generates email-safe PNG copies of the lasstreffen.at logo.
 *
 * Strategy: render the exact same wordmark+Pin lockup the React component
 * (src/components/Brand/Logo.tsx) produces, but as static HTML, then
 * puppeteer-screenshot it at 2× device pixel ratio for a sharp retina PNG.
 *
 * Output:
 *   public/email/logo-light.png  — dark wordmark + rust pin (for light email bg)
 *   public/email/logo-dark.png   — cream wordmark + coral pin (for dark headers)
 *
 * These get referenced from email templates as
 *   https://lasstreffen.at/email/logo-light.png
 * which works in every mail client (Gmail, Outlook, Apple Mail, Yahoo, …).
 *
 * Run: `node scripts/generate-email-logo.mjs` (uses local Chrome via puppeteer-core)
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'public', 'email');
await mkdir(outDir, { recursive: true });

// ── Inline HTML that mirrors Logo.tsx exactly ────────────────────────────
//
// Pin SVG path verbatim from src/components/Brand/Pin.tsx so the shape is
// pixel-identical to the live brand mark.

function logoHtml(variant) {
  const isDark = variant === 'dark';
  const inkColor = isDark ? '#ffffff' : '#1a1410';
  const pinColor = isDark ? '#f87171' : '#c8553d';
  const dotColor = isDark ? '#0a0a0c' : '#ffffff';
  const bg = isDark ? '#0a0a0c' : 'transparent';
  const fontSize = 56; // big render so the 2× shot stays sharp at any display size
  const pinSize = fontSize * 0.5;

  return `<!doctype html><html><head>
    <meta charset="utf-8" />
    <style>
      html, body { margin:0; padding:0; background:${bg}; }
      .wrap { padding: 12px 16px; display: inline-block; background:${bg}; }
      .lockup {
        font-family: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
        font-size: ${fontSize}px;
        font-weight: 800;
        letter-spacing: -0.05em;
        color: ${inkColor};
        line-height: 1;
        display: inline-flex;
        align-items: baseline;
        white-space: nowrap;
      }
      .pin-wrap { display:inline-block; transform:translateY(0.06em); margin: 0 0.04em; }
    </style>
  </head><body>
    <div class="wrap">
      <span class="lockup" aria-label="lasstreffen.at">lasstreffen<span class="pin-wrap" aria-hidden="true">
        <svg width="${pinSize}" height="${pinSize * 1.25}" viewBox="0 0 24 30" style="display:inline-block;vertical-align:baseline;">
          <path d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z" fill="${pinColor}" />
          <circle cx="12" cy="11.5" r="4" fill="${dotColor}" />
        </svg>
      </span>at</span>
    </div>
  </body></html>`;
}

// ── Render via puppeteer-core + system Chrome ────────────────────────────

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = candidates.find(existsSync);
if (!executablePath) {
  console.error('✗ No local Chrome/Edge found.');
  process.exit(1);
}

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({ headless: true, executablePath });

try {
  for (const variant of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 200, deviceScaleFactor: 2 });
    await page.setContent(logoHtml(variant), { waitUntil: 'load' });

    const el = await page.$('.wrap');
    const outPath = path.join(outDir, `logo-${variant}.png`);
    await el.screenshot({ path: outPath, omitBackground: variant === 'light' });
    console.log(`✓ ${variant.padEnd(6)} → ${path.relative(repoRoot, outPath)}`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('\nDone. Files served at https://lasstreffen.at/email/logo-{light,dark}.png after next deploy.');

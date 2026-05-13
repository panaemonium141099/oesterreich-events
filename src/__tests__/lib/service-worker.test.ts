/**
 * fn-15.10 — structural smoke test for /public/sw.js.
 *
 * The actual Workbox runtime is exercised by manual DevTools verification
 * (see task evidence). This file pins the contract that the SW source
 * carries the acceptance-critical wires:
 *
 *   - Workbox 7 imported from the official CDN.
 *   - stale-while-revalidate strategy for /_next/image/* with a 30-day
 *     ExpirationPlugin (60 * 60 * 24 * 30 seconds).
 *   - cache-first strategy for /_next/static/, /fonts/, /category-images/.
 *   - A 'message' listener that calls self.skipWaiting() when the page
 *     sends {type: 'SKIP_WAITING'} (hybrid-banner update path).
 *   - Web-Push handlers preserved verbatim from the pre-fn-15.10 SW.
 *
 * A regression on any of these would silently break the Pillar 10
 * acceptance criteria; failing here on every test run flags it.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SW_PATH = path.resolve(process.cwd(), 'public', 'sw.js');

describe('fn-15.10 service worker', () => {
  it('imports SELF-HOSTED Workbox from /workbox/workbox-sw.js (codex round-3: no third-party CDN dependency)', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    expect(src).toMatch(/importScripts\(\s*['"]\/workbox\/workbox-sw\.js['"]/);
    // CDN importScripts call MUST be gone — having it back would re-
    // introduce the third-party-SLA dependency codex flagged in round-2
    // review. We allow the string in comments (historical context).
    expect(src).not.toMatch(/importScripts\([^)]*storage\.googleapis\.com[^)]*\)/);
  });

  it('wraps Workbox bootstrap in try/catch so Web-Push survives Workbox load failure', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    expect(src).toMatch(/try\s*\{[\s\S]*importScripts\(\s*['"]\/workbox\/workbox-sw\.js['"]/);
    // workboxLoaded boolean gate is what protects push handlers from
    // crashing if Workbox itself failed to evaluate.
    expect(src).toMatch(/workboxLoaded\s*=\s*true/);
    expect(src).toMatch(/if\s*\(\s*workboxLoaded\s*\)/);
  });

  it('vendors every Workbox module the SW actually uses (no lazy-CDN fallback)', async () => {
    const { existsSync } = await import('node:fs');
    const workboxDir = path.resolve(process.cwd(), 'public', 'workbox');
    // Modules referenced in public/sw.js — every one MUST be self-hosted
    // because Workbox lazy-loads them on first wb.<module> access. A
    // missing module = SW evaluation throws = Web-Push handlers die too.
    const required = [
      'workbox-sw.js',
      'workbox-core.prod.js',
      'workbox-routing.prod.js',
      'workbox-strategies.prod.js',
      'workbox-expiration.prod.js',
      'workbox-cacheable-response.prod.js',
    ];
    for (const file of required) {
      expect(existsSync(path.join(workboxDir, file)), `missing ${file}`).toBe(true);
    }
  });

  it('configures Workbox modulePathPrefix to /workbox/ so lazy-loaded modules resolve same-origin', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    expect(src).toMatch(/modulePathPrefix:\s*['"]\/workbox\/['"]/);
  });

  it('caches /_next/image with stale-while-revalidate and 30-day TTL', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    // Route matcher pins /_next/image
    expect(src).toMatch(/url\.pathname\.startsWith\(['"]\/_next\/image['"]\)/);
    // SWR strategy class
    expect(src).toMatch(/StaleWhileRevalidate/);
    // 30 days = 60 * 60 * 24 * 30 seconds
    expect(src).toMatch(/60\s*\*\s*60\s*\*\s*24\s*\*\s*30/);
  });

  it('caches /_next/static and /static-like roots with cache-first', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    expect(src).toMatch(/CacheFirst/);
    expect(src).toMatch(/url\.pathname\.startsWith\(['"]\/_next\/static\/['"]\)/);
    expect(src).toMatch(/url\.pathname\.startsWith\(['"]\/static\/['"]\)/);
  });

  it('honours hybrid-banner skipWaiting via postMessage (NOT install-time skipWaiting on every update)', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    // Message handler must check for SKIP_WAITING
    expect(src).toMatch(/event\.data\.type\s*===\s*['"]SKIP_WAITING['"]/);
    // install handler should NOT call skipWaiting unconditionally — it
    // guards on `!self.registration.active` (first install only).
    expect(src).toMatch(/!self\.registration\.active/);
  });

  it('serves /offline.html as the navigation fallback', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    expect(src).toMatch(/['"]\/offline\.html['"]/);
    expect(src).toMatch(/request\.mode\s*===\s*['"]navigate['"]/);
  });

  it('preserves the Web-Push handlers from the pre-fn-15.10 SW', async () => {
    const src = await readFile(SW_PATH, 'utf8');
    expect(src).toMatch(/addEventListener\(['"]push['"]/);
    expect(src).toMatch(/addEventListener\(['"]notificationclick['"]/);
    expect(src).toMatch(/showNotification/);
  });
});

describe('fn-15.10 /public/offline.html', () => {
  it('exists and carries an explicit offline status badge', async () => {
    const html = await readFile(path.resolve(process.cwd(), 'public', 'offline.html'), 'utf8');
    expect(html).toMatch(/<title>Offline/i);
    // German-language copy, matches the banner wording style on landing.
    expect(html.toLowerCase()).toContain('offline');
    // Manual retry path — the page must let the user re-attempt the
    // navigation without typing the URL again.
    expect(html).toMatch(/location\.reload\(\)/);
  });
});

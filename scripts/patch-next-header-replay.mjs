#!/usr/bin/env node
/**
 * prebuild: Next.js-Bug "doppelter Location-Header bei ISR-MISS" patchen.
 *
 * Befund 2026-09-24 (curl direkt gegen nextjs-app:3000 auf Hetzner):
 * Jede Event-Detailseite, die per permanentRedirect() auf ihren
 * kanonischen Pfad umleitet, schickt beim ersten Aufruf (x-nextjs-cache:
 * MISS) den Header ZWEIMAL:
 *
 *   location: /events/6800-bregenz/2026-09-26/...
 *   location: /events/6800-bregenz/2026-09-26/...
 *
 * Ursache in next/dist/(esm/)build/templates/app-page.js (16.2.1, auch
 * noch 16.3.6): app-render setzt `location` per res.setHeader() UND legt
 * ihn in metadata.headers ab; danach spielt das Template die Cache-Header
 * mit res.appendHeader() erneut auf dieselbe Response. Bei HIT ist die
 * Response leer, dort passt es; bei MISS entsteht das Duplikat. fetch()
 * und viele Crawler fassen doppelte Header zu "a, a" zusammen, folgen
 * dieser Adresse und landen auf einer 404 (GSC: "Nicht gefunden").
 *
 * Fix: vor dem appendHeader einen Header überspringen, der schon mit
 * identischem Wert auf der Response liegt. Arrays (set-cookie) bleiben
 * unangetastet. Idempotent; bricht den Build ab, wenn eine künftige
 * Next-Version den Code so geändert hat, dass das Muster fehlt. Dann
 * prüfen, ob Next den Bug selbst behoben hat, und das Skript entfernen.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MARKER = '/* lasstreffen:dedupe-replayed-headers */';

const NEEDLE =
  "for (let [key, value] of Object.entries(headers)){\n" +
  "                    if (typeof value === 'undefined') continue;";

export function patchSource(src) {
  if (src.includes(MARKER)) return { src, changed: false };
  if (!src.includes(NEEDLE)) return null;
  const replacement =
    NEEDLE +
    `\n                    ${MARKER} if (!Array.isArray(value) && typeof res.getHeader === 'function' && String(res.getHeader(key)) === String(value)) continue;`;
  return { src: src.split(NEEDLE).join(replacement), changed: true };
}

function main() {
  const root = process.cwd();
  const targets = [
    'node_modules/next/dist/esm/build/templates/app-page.js',
    'node_modules/next/dist/build/templates/app-page.js',
  ];
  let failed = false;
  for (const rel of targets) {
    const file = resolve(root, rel);
    if (!existsSync(file)) {
      console.error(`[patch-next-header-replay] fehlt: ${rel}`);
      failed = true;
      continue;
    }
    const result = patchSource(readFileSync(file, 'utf8'));
    if (!result) {
      console.error(
        `[patch-next-header-replay] Muster nicht gefunden in ${rel}. ` +
          'Next.js wurde vermutlich aktualisiert: prüfen, ob der doppelte ' +
          'Location-Header noch auftritt, dann Skript anpassen oder entfernen.',
      );
      failed = true;
      continue;
    }
    if (result.changed) writeFileSync(file, result.src);
    console.log(`[patch-next-header-replay] ${result.changed ? 'gepatcht' : 'bereits gepatcht'}: ${rel}`);
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('patch-next-header-replay.mjs')) {
  main();
}

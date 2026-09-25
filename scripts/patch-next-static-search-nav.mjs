#!/usr/bin/env node
/**
 * prebuild: Next.js-Bug „Navigation auf statische Seite behält alte Query“
 * patchen.
 *
 * Befund 2026-09-25 (Prod, Browser): Auf /entdecken?saison=herbst (oder
 * ?search=wein) führt ein Klick auf „Entdecken“ (/entdecken ohne Query)
 * nirgendwohin. Next stellt keine Anfrage, schreibt per replaceState die
 * ALTE URL zurück, die Liste bleibt auf Herbst. Erst ein Reload hilft.
 *
 * Ursache in next/dist/(esm/)client/components/segment-cache/navigation.js
 * (16.2.1, unverändert in 16.2.12 und 16.3.6): /entdecken ist statisch
 * vorgerendert und hängt nicht von der Query ab (RSC "q":"", renderedSearch
 * leer). Den Route-Cache-Eintrag dafür legt Next mit der kanonischen URL der
 * ERSTEN Anfrage an, samt deren Query. navigateUsingPrefetchedRouteTree
 * übernimmt `route.canonicalUrl` unverändert als Ziel-URL; ein Link auf
 * /entdecken trifft den Eintrag und landet wieder auf ?saison=herbst.
 *
 * Fix: Hängt die Route nicht von der Query ab (renderedSearch leer) und
 * zeigt ihre kanonische URL auf denselben Pfad, gilt die Query der
 * angeforderten URL. Weiterleitungen auf einen anderen Pfad bleiben
 * unberührt. Idempotent; bricht den Build ab, wenn das Muster in einer
 * künftigen Next-Version fehlt. Dann prüfen, ob Next den Bug behoben hat,
 * und das Skript entfernen.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MARKER = '/* lasstreffen:static-route-keeps-requested-search */';

const NEEDLE = '    const canonicalUrl = route.canonicalUrl + url.hash;\n    const renderedSearch = route.renderedSearch;';

const REPLACEMENT =
  `    ${MARKER}\n` +
  '    const canonicalUrl = (function () {\n' +
  '        const cached = new URL(route.canonicalUrl, url.origin);\n' +
  "        if (route.renderedSearch === '' && cached.pathname === url.pathname) cached.search = url.search;\n" +
  '        return cached.pathname + cached.search + url.hash;\n' +
  '    })();\n' +
  '    const renderedSearch = route.renderedSearch;';

export function patchSource(src) {
  if (src.includes(MARKER)) return { src, changed: false };
  const normalized = src.replace(/\r\n/g, '\n');
  if (!normalized.includes(NEEDLE)) return null;
  return { src: normalized.split(NEEDLE).join(REPLACEMENT), changed: true };
}

function main() {
  const root = process.cwd();
  const targets = [
    'node_modules/next/dist/esm/client/components/segment-cache/navigation.js',
    'node_modules/next/dist/client/components/segment-cache/navigation.js',
  ];
  let failed = false;
  for (const rel of targets) {
    const file = resolve(root, rel);
    if (!existsSync(file)) {
      console.error(`[patch-next-static-search-nav] fehlt: ${rel}`);
      failed = true;
      continue;
    }
    const result = patchSource(readFileSync(file, 'utf8'));
    if (!result) {
      console.error(
        `[patch-next-static-search-nav] Muster nicht gefunden in ${rel}. ` +
          'Next.js wurde vermutlich aktualisiert: prüfen, ob /entdecken?x=1 → ' +
          'Link auf /entdecken noch auf der alten Query hängen bleibt, dann ' +
          'Skript anpassen oder entfernen.',
      );
      failed = true;
      continue;
    }
    if (result.changed) writeFileSync(file, result.src);
    console.log(`[patch-next-static-search-nav] ${result.changed ? 'gepatcht' : 'bereits gepatcht'}: ${rel}`);
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('patch-next-static-search-nav.mjs')) {
  main();
}

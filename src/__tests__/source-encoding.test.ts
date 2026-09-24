import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Befund 2026-09-24: src/lib/artist-matching.ts war doppelt kodiert
// („ – " stand als "â€“" im Code). Die Gedankenstrich-Trennung und die
// Bürgermusik-Erkennung konnten nie treffen; Fans bekamen Benachrichtigungen
// für Tribute-Shows. Dieser Test findet solche Zeichenfolgen in Quelldateien.

// Absichtlich: Reparaturtabelle für kaputt kodierte Deskline-Texte und ihre Tests.
const ERLAUBT = new Set([
  'src/lib/activities/fingerprint.ts',
  'src/__tests__/lib/activities/fingerprint.test.ts',
  'src/__tests__/lib/activities/ingest-transform.test.ts',
  'src/__tests__/source-encoding.test.ts',
]);

// UTF-8 als Windows-1252 gelesen: "â€" (Anführungszeichen, Striche), "Ã" + Umlaut-Rest.
const MOJIBAKE = new RegExp('â€|â”|Ã[¤¶¼Ÿ„–œ©¨ ]');

function dateien(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) dateien(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(f)) out.push(p);
  }
  return out;
}

describe('Quelltext-Kodierung', () => {
  it('keine doppelt kodierten Zeichen (Mojibake) im Quelltext', () => {
    const root = process.cwd();
    const treffer = dateien(join(root, 'src'))
      .map(p => relative(root, p).split(sep).join('/'))
      .filter(p => !ERLAUBT.has(p))
      .filter(p => MOJIBAKE.test(readFileSync(join(root, p), 'utf8')));
    expect(treffer).toEqual([]);
  });
});

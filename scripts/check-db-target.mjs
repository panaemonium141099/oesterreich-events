#!/usr/bin/env node
/**
 * Guard: verhindert, dass lokal oder im Build versehentlich gegen die alte
 * Supabase-Cloud-Instanz gearbeitet wird.
 *
 * Warum es das gibt: Am 2026-09-06 wurde eine Analyse der Event-Uhrzeiten
 * gegen `booljdtrktpotsenbnut.supabase.co` gefahren, weil die lokale
 * `.env.local` nach dem Cutover (2026-08-31) noch auf die Cloud zeigte. Die
 * Instanz antwortete brav mit einem eingefrorenen Datenstand — das Ergebnis
 * (32,5 % Platzhalter-Uhrzeiten) war schlicht falsch, der echte Prod-Wert
 * lag bei 23,7 %. Ein stiller Fehler dieser Art ist teurer als ein lauter:
 * die alte DB *antwortet*, sie ist nur nicht mehr die Wahrheit.
 *
 * Seit dem Cutover ist die Quelle der Wahrheit die self-hosted Instanz auf
 * dem Hetzner-Server, erreichbar über https://api.lasstreffen.at.
 *
 * Läuft als `predev` / `prebuild`.
 *
 * WICHTIG: npm-Scripts bekommen die `.env*`-Dateien NICHT in `process.env` —
 * die lädt Next.js erst im eigenen Prozess. Ein Guard, der nur `process.env`
 * liest, wäre also genau dort blind, wo der Fehler passiert ist. Deshalb
 * parst er die Env-Dateien zusätzlich selbst.
 *
 * Bewusst NICHT in Vitest eingehängt: die Test-Suite stubt Fantasie-URLs wie
 * `https://test.supabase.co`, die nie eine echte Verbindung aufbauen.
 */

import { readFileSync, existsSync } from 'node:fs';

/** Projekt-Ref der stillgelegten Cloud-Instanz. */
const DEAD_PROJECT_REF = 'booljdtrktpotsenbnut';

const VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'];

/** Reihenfolge wie bei Next.js: spätere Einträge gewinnen nicht, erste Fundstelle zählt. */
const ENV_FILES = ['.env.local', '.env.production.local', '.env.production', '.env'];

/** Minimaler `KEY=VALUE`-Parser — bewusst ohne Dependency. */
function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Alle Fundstellen sammeln: echte Prozess-Env + jede Env-Datei. */
const sources = [{ label: 'Umgebungsvariable', values: process.env }];
for (const file of ENV_FILES) {
  const values = readEnvFile(file);
  if (Object.keys(values).length > 0) sources.push({ label: file, values });
}

const problems = [];

for (const { label, values } of sources) {
  for (const name of VARS) {
    const value = values[name];
    if (!value) continue;

    if (value.includes(DEAD_PROJECT_REF)) {
      problems.push(
        `${label} → ${name} zeigt auf die STILLGELEGTE Cloud-Instanz.\n` +
          `    Diese DB antwortet noch, liefert aber einen eingefrorenen Stand von vor dem Cutover.`
      );
    } else if (/\.supabase\.(co|in)(\/|$|:)/.test(value)) {
      problems.push(
        `${label} → ${name} zeigt auf eine gehostete Supabase-Instanz (${value}).\n` +
          `    Dieses Projekt läuft seit 2026-08-31 vollständig self-hosted.`
      );
    }
  }
}

if (problems.length > 0) {
  console.error('\n\x1b[31m✖ Falsches Datenbank-Ziel\x1b[0m\n');
  for (const p of problems) console.error(`  - ${p}\n`);
  console.error('  Richtig ist die self-hosted Instanz auf dem Hetzner-Server:\n');
  console.error('    NEXT_PUBLIC_SUPABASE_URL=https://api.lasstreffen.at\n');
  console.error('  Aktuelle Keys stehen auf dem Server in /opt/app/.env.master.');
  console.error('  Die Cloud-Keys funktionieren dort NICHT — und umgekehrt.\n');
  process.exit(1);
}

// Kein Fund: still bleiben. Ein fehlendes NEXT_PUBLIC_SUPABASE_URL ist hier
// kein Fehler — darüber beschwert sich der Supabase-Client selbst, und ein
// harter Abbruch würde Lint-/Typecheck-Builds ohne Env unnötig blockieren.

/**
 * Regenerate `docs/TAXONOMY.md` §3 (Tags-Ebene B) from the code-side
 * single-source-of-truth in `src/lib/category-classifier/enrichment-taxonomy.ts`.
 *
 * Why this script exists (fn-14.3 Step 0)
 * ────────────────────────────────────────
 * Two divergent vocabularies were in the repo:
 *   - `enrichment-taxonomy.ts` (runtime validator, used by `validateEnrichment`)
 *     emits values with German diacritics: `paare`, `günstig`, `ganztägig`,
 *     `mehrtägig`, etc.
 *   - `docs/TAXONOMY.md` §3 (human-facing reference)
 *     uses ASCII slugs: `fuer-paare`, `guenstig`, `ganztaegig`, `mehrtaegig`,
 *     plus tag names that don't even exist in the code list (`fuer-familien`,
 *     `fuer-singles`, `kinderfreundlich`, `kunsthandwerkermesse`, etc.).
 *
 * If the AI prompt were templated from the doc, the runtime validator would
 * silently drop every non-matching value — entire enrichment passes would
 * lose their facets without anyone noticing.
 *
 * Decision (per fn-14 epic spec): code is authoritative. The doc is
 * regenerated from code. This script regenerates §3 only — the prose
 * around it (philosophy, decision rules, examples) is hand-written and
 * remains untouched.
 *
 * Mechanism
 * ─────────
 * 1. Read the current `docs/TAXONOMY.md`.
 * 2. Find the `## 3. Tags` heading and the next `## 4.` heading.
 * 3. Replace the body in between with a freshly built block that lists
 *    EVERY value from each code-side tuple, grouped by axis.
 * 4. Write the file back. Idempotent — re-running with no code changes
 *    produces a byte-identical file.
 *
 * Usage
 *   tsx src/scripts/regen-taxonomy-doc.ts          # regenerate
 *   tsx src/scripts/regen-taxonomy-doc.ts --check  # exit 1 if drift detected
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  TAGS,
  AUDIENCES,
  VIBES,
  OCCASIONS,
  SETTINGS,
  PRICE_FLAGS,
  PRICE_TIERS,
  DURATION_TYPES,
  LANGUAGES,
  PRIMARY_CATEGORIES,
} from '../lib/category-classifier/enrichment-taxonomy';

const DOC_PATH = join(process.cwd(), 'docs', 'TAXONOMY.md');

const SECTION_START_RE = /^## 3\. Tags.*$/m;
const SECTION_END_RE = /^## 4\. /m;

const HEADER_NOTE =
  '<!-- AUTO-GENERATED from src/lib/category-classifier/enrichment-taxonomy.ts. ' +
  'Do not edit by hand — run `tsx src/scripts/regen-taxonomy-doc.ts` to regenerate. -->';

function fenceList(values: readonly string[]): string {
  // One value per line, exactly as it lives in the code constant. The
  // runtime validator does case-insensitive comparison for most enums but
  // primary_category is case-sensitive (German titles), so we mirror the
  // code casing here verbatim.
  return ['```', ...values, '```'].join('\n');
}

function buildSection(): string {
  const lines: string[] = [];

  lines.push('## 3. Tags (Ebene B) — 6 Achsen');
  lines.push('');
  lines.push(HEADER_NOTE);
  lines.push('');
  lines.push('Jedes Event bekommt:');
  lines.push('');
  lines.push('- 1 `primary_category` aus der Liste in §2 (eine von 11 + Fallback `Sonstiges`)');
  lines.push('- 0–5 `secondary_tags` (Aktivitäts-Tags, Genre-Tags) aus §3.6');
  lines.push('- 0–3 `vibe_tags` aus §3.2');
  lines.push('- 0–3 `audience_tags` aus §3.1');
  lines.push('- 0–3 `occasion_tags` aus §3.3');
  lines.push('- beliebig viele `setting`-Tags (§3.5) und `price_flags` (§3.4)');
  lines.push('- 1 `price_tier` aus §3.4 + 1 `duration_type` aus §3.5 + 1 `language` aus §3.7');
  lines.push('');
  lines.push('Jeder Wert in den unten stehenden Listen ist gleichzeitig ein erlaubter');
  lines.push('Output-Wert für den AI-Validator (`validateEnrichment` in');
  lines.push('`src/lib/category-classifier/enrichment-taxonomy.ts`). Werte außerhalb');
  lines.push('dieser Listen werden silent gedroppt.');

  // ── 3.1 Audience ───────────────────────────────────────────────────
  lines.push('');
  lines.push('### 3.1 Audience-Tags (Zielgruppe)');
  lines.push('');
  lines.push('Wer fühlt sich angesprochen? (`audience` array, 0–3 Werte)');
  lines.push('');
  lines.push(fenceList(AUDIENCES));

  // ── 3.2 Vibe ───────────────────────────────────────────────────────
  lines.push('');
  lines.push('### 3.2 Vibe-Tags (Stimmung)');
  lines.push('');
  lines.push('Wie fühlt sich das Event an? (`vibe` array, 0–3 Werte)');
  lines.push('');
  lines.push(fenceList(VIBES));

  // ── 3.3 Occasion ───────────────────────────────────────────────────
  lines.push('');
  lines.push('### 3.3 Occasion-Tags (Anlass)');
  lines.push('');
  lines.push('Wofür ist das Event "gut"? (`occasion_tags` array, 0–3 Werte)');
  lines.push('');
  lines.push(fenceList(OCCASIONS));

  // ── 3.4 Price ──────────────────────────────────────────────────────
  lines.push('');
  lines.push('### 3.4 Price-Tier + Price-Flags');
  lines.push('');
  lines.push('Genau **ein** `price_tier`:');
  lines.push('');
  lines.push(fenceList(PRICE_TIERS));
  lines.push('');
  lines.push('Bedeutung: `gratis`=0€ · `günstig`=bis 15€ · `mittel`=15–50€ ·');
  lines.push('`premium`=über 50€ · `unbekannt`=nicht ableitbar (selten — siehe Default-Regel im Prompt).');
  lines.push('');
  lines.push('Beliebig viele `price_flags`:');
  lines.push('');
  lines.push(fenceList(PRICE_FLAGS));

  // ── 3.5 Setting / Format ───────────────────────────────────────────
  lines.push('');
  lines.push('### 3.5 Setting / Format / Zeit-Tags');
  lines.push('');
  lines.push('Format und Ort des Events. (`setting` array, 0–3 Werte)');
  lines.push('');
  lines.push(fenceList(SETTINGS));
  lines.push('');
  lines.push('Genau **ein** `duration_type`:');
  lines.push('');
  lines.push(fenceList(DURATION_TYPES));
  lines.push('');
  lines.push('Bedeutung: `kurz`<2h · `abend`=2–5h · `ganztag` · `mehrtägig` ·');
  lines.push('`dauerausstellung` · `nacht-bis-morgen`=22h–6h · `24-stunden` · `48-stunden`.');

  // ── 3.6 Activity / Tags ────────────────────────────────────────────
  lines.push('');
  lines.push('### 3.6 Activity-Tags (`tags` Array, 0–5 Werte)');
  lines.push('');
  lines.push('Konkrete Aktivitäts-/Genre-Labels. Wichtigste Achse für Embedding-Matching.');
  lines.push('');
  lines.push(fenceList(TAGS));

  // ── 3.7 Language ───────────────────────────────────────────────────
  lines.push('');
  lines.push('### 3.7 Language');
  lines.push('');
  lines.push('Genau **ein** `language`:');
  lines.push('');
  lines.push(fenceList(LANGUAGES));

  // ── 3.8 Primary categories ─────────────────────────────────────────
  lines.push('');
  lines.push('### 3.8 Primary Category (referenz, siehe §2 für Beschreibung)');
  lines.push('');
  lines.push('Genau **eine** `primary_category` (case-sensitive):');
  lines.push('');
  lines.push(fenceList(PRIMARY_CATEGORIES));

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

function regen(checkOnly: boolean): void {
  const original = readFileSync(DOC_PATH, 'utf8');
  const startMatch = SECTION_START_RE.exec(original);
  if (!startMatch) {
    console.error(`Could not find "## 3. Tags" heading in ${DOC_PATH}`);
    process.exit(1);
  }
  const after = original.slice(startMatch.index);
  const endMatch = SECTION_END_RE.exec(after);
  if (!endMatch) {
    console.error(`Could not find "## 4." heading after "## 3." in ${DOC_PATH}`);
    process.exit(1);
  }

  const before = original.slice(0, startMatch.index);
  const afterSection = after.slice(endMatch.index);

  const generated = buildSection();
  const next = before + generated + afterSection;

  if (checkOnly) {
    if (next === original) {
      console.log('docs/TAXONOMY.md §3 is up to date with enrichment-taxonomy.ts');
      process.exit(0);
    }
    console.error(
      'docs/TAXONOMY.md §3 has drifted from src/lib/category-classifier/enrichment-taxonomy.ts.\n' +
      'Run `tsx src/scripts/regen-taxonomy-doc.ts` to regenerate.',
    );
    process.exit(1);
  }

  if (next === original) {
    console.log('docs/TAXONOMY.md §3 already matches enrichment-taxonomy.ts — no write.');
    return;
  }
  writeFileSync(DOC_PATH, next, 'utf8');
  console.log(`docs/TAXONOMY.md §3 regenerated from enrichment-taxonomy.ts (${TAGS.length} tags, ${AUDIENCES.length} audiences, ${VIBES.length} vibes, ${OCCASIONS.length} occasions, ${SETTINGS.length} settings, ${PRICE_FLAGS.length} price-flags, ${PRIMARY_CATEGORIES.length} primary categories).`);
}

const checkOnly = process.argv.includes('--check');
regen(checkOnly);

/**
 * Split a combined festival-research JSON into the two persistence files:
 *   data/manual-lineups.json   →  consumed by import-manual-lineups.ts
 *   data/festival-overrides.json  →  consumed at runtime by src/lib/festivals/enrich.ts
 *
 * Input shape (data/festival-research-<date>.json):
 *   {
 *     "festival-slug": {
 *       "lineup": [ {"name": "...", "billing": "headliner"|"support"|"unknown"} ],
 *       "imageUrl": "https://..." | null,
 *       "description": "..." | null,
 *       "priceText": "..." | null,
 *       "_notes": "..."
 *     }
 *   }
 *
 * Usage:
 *   npx tsx src/scripts/split-festival-research.ts <input-json>
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: split-festival-research <input-json>');
  process.exit(1);
}
const abs = resolve(process.cwd(), inputPath);
if (!existsSync(abs)) {
  console.error(`Not found: ${abs}`);
  process.exit(1);
}

interface ResearchEntry {
  lineup?: { name: string; billing?: string }[];
  imageUrl?: string | null;
  description?: string | null;
  priceText?: string | null;
  _notes?: string;
}

const raw = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, ResearchEntry | unknown>;

// ── 1. manual-lineups.json: grouped by billing ──
type LineupShape = Record<string, string[] | Record<string, string[]>>;
const lineups: LineupShape = {};
const VALID_BILLINGS = new Set(['headliner', 'sub_headliner', 'support', 'opener', 'unknown']);

for (const [slug, entry] of Object.entries(raw)) {
  if (slug.startsWith('_')) continue;
  if (!entry || typeof entry !== 'object') continue;
  const e = entry as ResearchEntry;
  if (!Array.isArray(e.lineup) || e.lineup.length === 0) {
    lineups[slug] = [];
    continue;
  }
  // Group by billing — produces the rich object shape when ≥1 known billing exists,
  // flat string[] otherwise (treated as 'unknown' by the importer).
  const grouped: Record<string, string[]> = {};
  for (const act of e.lineup) {
    if (!act || typeof act !== 'object' || typeof act.name !== 'string') continue;
    const clean = act.name.trim();
    if (!clean) continue;
    const billing = (act.billing && VALID_BILLINGS.has(act.billing)) ? act.billing : 'unknown';
    (grouped[billing] ??= []).push(clean);
  }
  const billings = Object.keys(grouped);
  if (billings.length === 1 && billings[0] === 'unknown') {
    lineups[slug] = grouped.unknown;
  } else {
    lineups[slug] = grouped;
  }
}

// ── 2. festival-overrides.json: image/description/price ──
interface OverrideShape {
  [slug: string]: { imageUrl?: string | null; description?: string | null; priceText?: string | null };
}
const overrides: OverrideShape = {};
overrides._comment = {} as unknown as { imageUrl?: string | null }; // placeholder, we strip later
delete overrides._comment;

for (const [slug, entry] of Object.entries(raw)) {
  if (slug.startsWith('_')) continue;
  if (!entry || typeof entry !== 'object') continue;
  const e = entry as ResearchEntry;
  const o: { imageUrl?: string | null; description?: string | null; priceText?: string | null } = {};
  if (typeof e.imageUrl === 'string' && e.imageUrl.startsWith('http')) o.imageUrl = e.imageUrl;
  if (typeof e.description === 'string' && e.description.trim().length >= 20) o.description = e.description.trim();
  if (typeof e.priceText === 'string' && e.priceText.trim()) o.priceText = e.priceText.trim();
  if (Object.keys(o).length > 0) overrides[slug] = o;
}

// ── Write outputs ──
const LINEUP_PATH = resolve(process.cwd(), 'data/manual-lineups.json');
const OVERRIDE_PATH = resolve(process.cwd(), 'data/festival-overrides.json');

// Preserve _comment in overrides file
const existingOverrides = existsSync(OVERRIDE_PATH)
  ? (JSON.parse(readFileSync(OVERRIDE_PATH, 'utf8')) as Record<string, unknown>)
  : {};
const comment = existingOverrides._comment;
const finalOverrides: Record<string, unknown> = comment ? { _comment: comment, ...overrides } : overrides;

writeFileSync(LINEUP_PATH, JSON.stringify(lineups, null, 2) + '\n', 'utf8');
writeFileSync(OVERRIDE_PATH, JSON.stringify(finalOverrides, null, 2) + '\n', 'utf8');

const lineupSlugsWithActs = Object.entries(lineups).filter(([, v]) => {
  if (Array.isArray(v)) return v.length > 0;
  return Object.values(v).some(arr => arr.length > 0);
}).length;
const overrideSlugs = Object.keys(overrides).length;

console.log(`Wrote ${LINEUP_PATH} (${lineupSlugsWithActs}/${Object.keys(lineups).length} slugs with at least one act)`);
console.log(`Wrote ${OVERRIDE_PATH} (${overrideSlugs} slugs with override data)`);

/**
 * Reclassify events' primary `category` based on the AI-enriched `tags`.
 *
 * Context: enrich-openai.ts added multi-dim tags (volksmusik, blasmusik,
 * techno, kirtag, etc.) but never touched the main `category` column —
 * that stayed wherever the rule-based classifier put it during scraping.
 * Result: a "Tamburicaabend" gets tagged ['volksmusik', 'blasmusik'] but
 * still shows as category='Sport' because the word "Sportplatz" appeared
 * in the event text.
 *
 * This script fixes that, deterministically, offline, free:
 *   1. Walk every event with enrichment_version set
 *   2. Tally tag votes per category using TAG_TO_CATEGORY below
 *   3. If the winning category differs from current AND has ≥2 tag votes
 *      AND no tie — overwrite `category`
 *   4. Mark the write with `category_source='enrichment'` so we can
 *      distinguish these from rule-based / AI-based classifications
 *
 * Respects `category_locked` (manual overrides never touched).
 * Idempotent; re-running on already-correct events is a no-op.
 *
 * Usage:
 *   npm run reclassify-from-tags -- --dry-run       # preview, no writes
 *   npm run reclassify-from-tags                    # commit
 *   npm run reclassify-from-tags -- --limit 500     # batch test
 */

import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const envPath = join(process.cwd(), '.env.local');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i).trim();
    const v = t.substring(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* absent */ }

import { createClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────────
// Tag → Category mapping
// Built from the closed TAGS vocabulary in enrichment-taxonomy.ts.
// Each tag routes to ONE category. Ambiguous tags (e.g. 'outdoor-
// festival' which could be Musik OR Nightlife) go to the broader
// bucket — Musik wins over Nightlife when the tag describes a format
// not a genre.
// ──────────────────────────────────────────────────────────────────

const TAG_TO_CATEGORY: Record<string, string> = {
  // ── Musik (acoustic / genre-based / live bands) ──
  klassik: 'Musik', oper: 'Musik', operette: 'Musik', ballett: 'Musik',
  kammermusik: 'Musik', chor: 'Musik', orgel: 'Musik',
  jazz: 'Musik', bigband: 'Musik', swing: 'Musik',
  pop: 'Musik', rock: 'Musik', indie: 'Musik', alternative: 'Musik',
  metal: 'Musik', punk: 'Musik', grunge: 'Musik', ska: 'Musik',
  reggae: 'Musik', 'hip-hop': 'Musik', rap: 'Musik', 'r-n-b': 'Musik',
  soul: 'Musik', funk: 'Musik', disco: 'Musik', schlager: 'Musik',
  country: 'Musik', folk: 'Musik', 'singer-songwriter': 'Musik',
  latin: 'Musik', balkan: 'Musik', weltmusik: 'Musik',
  volksmusik: 'Musik', blasmusik: 'Musik', heurigenmusik: 'Musik',
  'alpine-musik': 'Musik', 'austro-pop': 'Musik', 'dialekt-rap': 'Musik',
  'live-band': 'Musik', 'acoustic-session': 'Musik',
  'jam-session': 'Musik', karaoke: 'Musik',
  'outdoor-festival': 'Musik', 'indoor-festival': 'Musik',
  'multi-stage-festival': 'Musik',

  // ── Nightlife (electronic genres + rave formats) ──
  techno: 'Nightlife', house: 'Nightlife', trance: 'Nightlife',
  dnb: 'Nightlife', dubstep: 'Nightlife', hardstyle: 'Nightlife',
  hardcore: 'Nightlife', breakbeat: 'Nightlife', 'bass-music': 'Nightlife',
  'ambient-chill': 'Nightlife', electro: 'Nightlife',
  'disco-electronic': 'Nightlife',
  'minimal-techno': 'Nightlife', 'melodic-techno': 'Nightlife',
  hardtechno: 'Nightlife', schranz: 'Nightlife',
  'industrial-techno': 'Nightlife', 'detroit-techno': 'Nightlife',
  'deep-techno': 'Nightlife', 'acid-techno': 'Nightlife',
  'dub-techno': 'Nightlife',
  'deep-house': 'Nightlife', 'tech-house': 'Nightlife',
  'progressive-house': 'Nightlife', 'afro-house': 'Nightlife',
  'melodic-house': 'Nightlife', 'acid-house': 'Nightlife',
  'disco-house': 'Nightlife', 'future-house': 'Nightlife',
  'afro-tech': 'Nightlife', 'chicago-house': 'Nightlife',
  'uk-house': 'Nightlife', 'minimal-house': 'Nightlife',
  psytrance: 'Nightlife', goa: 'Nightlife',
  'progressive-trance': 'Nightlife', 'uplifting-trance': 'Nightlife',
  'hard-trance': 'Nightlife', 'vocal-trance': 'Nightlife',
  'dark-psytrance': 'Nightlife', 'forest-psytrance': 'Nightlife',
  'full-on': 'Nightlife',
  'drum-and-bass': 'Nightlife', 'liquid-dnb': 'Nightlife',
  neurofunk: 'Nightlife', jungle: 'Nightlife', 'jump-up': 'Nightlife',
  'dnb-rollers': 'Nightlife', 'dancefloor-dnb': 'Nightlife',
  'deep-dnb': 'Nightlife', 'minimal-dnb': 'Nightlife',
  riddim: 'Nightlife', brostep: 'Nightlife', 'future-bass': 'Nightlife',
  'trap-edm': 'Nightlife', 'uk-garage': 'Nightlife', '2-step': 'Nightlife',
  'speed-garage': 'Nightlife', bassline: 'Nightlife', grime: 'Nightlife',
  rawstyle: 'Nightlife', gabber: 'Nightlife', 'uk-hardcore': 'Nightlife',
  uptempo: 'Nightlife', frenchcore: 'Nightlife', terror: 'Nightlife',
  speedcore: 'Nightlife', 'happy-hardcore': 'Nightlife',
  'nu-disco': 'Nightlife', 'italo-disco': 'Nightlife',
  synthwave: 'Nightlife', vaporwave: 'Nightlife',
  electroclash: 'Nightlife', electroswing: 'Nightlife',
  idm: 'Nightlife', leftfield: 'Nightlife',
  rave: 'Nightlife', 'open-air-rave': 'Nightlife',
  afterhour: 'Nightlife', 'warehouse-party': 'Nightlife',
  'free-party': 'Nightlife', 'tekno-party': 'Nightlife',
  'boiler-room': 'Nightlife', 'club-night': 'Nightlife',
  'silent-disco': 'Nightlife', 'boat-party': 'Nightlife',
  'rooftop-party': 'Nightlife', 'daytime-rave': 'Nightlife',
  '24h-rave': 'Nightlife', 'underground-party': 'Nightlife',
  'dj-set': 'Nightlife',

  // ── Kultur ──
  theater: 'Kultur', kabarett: 'Kultur', lesung: 'Kultur',
  musical: 'Kultur', ausstellung: 'Kultur', vortrag: 'Kultur',
  film: 'Kultur', kino: 'Kultur', 'performance-art': 'Kultur',
  improtheater: 'Kultur', comedy: 'Kultur',

  // ── Sport ──
  wandern: 'Sport', laufen: 'Sport', radfahren: 'Sport',
  mountainbike: 'Sport', ski: 'Sport', langlauf: 'Sport',
  snowboard: 'Sport', schwimmen: 'Sport', klettern: 'Sport',
  yoga: 'Sport', fitness: 'Sport', turnier: 'Sport',
  fussball: 'Sport', eishockey: 'Sport', tennis: 'Sport',
  reiten: 'Sport', wassersport: 'Sport',

  // ── Märkte ──
  christkindlmarkt: 'Märkte', ostermarkt: 'Märkte', flohmarkt: 'Märkte',
  bauernmarkt: 'Märkte', wochenmarkt: 'Märkte',
  kunsthandwerk: 'Märkte', designmarkt: 'Märkte', antikmarkt: 'Märkte',

  // ── Wein & Kulinarik ──
  weinfest: 'Wein & Kulinarik', biermesse: 'Wein & Kulinarik',
  heuriger: 'Wein & Kulinarik', verkostung: 'Wein & Kulinarik',
  'kulinarik-tour': 'Wein & Kulinarik',
  genussmesse: 'Wein & Kulinarik', 'street-food': 'Wein & Kulinarik',
  brunch: 'Wein & Kulinarik',

  // ── Feste & Brauchtum ──
  kirtag: 'Feste & Brauchtum', kirchweih: 'Feste & Brauchtum',
  zeltfest: 'Feste & Brauchtum', dorffest: 'Feste & Brauchtum',
  sommerfest: 'Feste & Brauchtum', pfarrfest: 'Feste & Brauchtum',
  schützenfest: 'Feste & Brauchtum', almabtrieb: 'Feste & Brauchtum',
  maibaumfest: 'Feste & Brauchtum', sonnwendfeier: 'Feste & Brauchtum',
  dämmerschoppen: 'Feste & Brauchtum', frühschoppen: 'Feste & Brauchtum',
  tracht: 'Feste & Brauchtum', perchten: 'Feste & Brauchtum',
  krampuslauf: 'Feste & Brauchtum', erntedank: 'Feste & Brauchtum',
  fasching: 'Feste & Brauchtum', ball: 'Feste & Brauchtum',

  // ── Religion ──
  gottesdienst: 'Religion', wallfahrt: 'Religion',
  prozession: 'Religion', meditation: 'Religion', retreat: 'Religion',
  andacht: 'Religion', pilgern: 'Religion',

  // ── Familie ──
  'kinder-workshop': 'Familie', puppentheater: 'Familie',
  'familien-picknick': 'Familie', kinderkino: 'Familie',
  spielfest: 'Familie', ferienprogramm: 'Familie',
  geburtstag: 'Familie', kindertheater: 'Familie',

  // ── Bildung ──
  seminar: 'Bildung', workshop: 'Bildung', kurs: 'Bildung',
  sprachkurs: 'Bildung', lecture: 'Bildung',

  // ── Wirtschaft ──
  messe: 'Wirtschaft', konferenz: 'Wirtschaft',
  networking: 'Wirtschaft', 'startup-pitch': 'Wirtschaft',
  'tech-meetup': 'Wirtschaft', branchentreff: 'Wirtschaft',

  // ── Natur ──
  naturführung: 'Natur', vogelbeobachtung: 'Natur',
  'geführte-wanderung': 'Natur', astronomie: 'Natur',
  'ökologie-event': 'Natur',

  // ── Gesundheit ──
  gesundheitsmesse: 'Gesundheit', wellness: 'Gesundheit',
  achtsamkeit: 'Gesundheit', selbsthilfegruppe: 'Gesundheit',
};

// ──────────────────────────────────────────────────────────────────
// Core logic
// ──────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  title: string;
  tags: string[] | null;
  category: string | null;
  category_locked: boolean | null;
}

/**
 * Score every category by the number of tags that map to it, return the
 * winner. Tie-break: if two categories have the same count, return null
 * (ambiguous — don't overwrite).
 */
function voteCategory(tags: string[]): { winner: string | null; score: number; runnerUp: number } {
  const votes = new Map<string, number>();
  for (const t of tags) {
    const cat = TAG_TO_CATEGORY[t];
    if (!cat) continue;
    votes.set(cat, (votes.get(cat) ?? 0) + 1);
  }
  if (votes.size === 0) return { winner: null, score: 0, runnerUp: 0 };

  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [winner, score] = sorted[0];
  const runnerUp = sorted[1]?.[1] ?? 0;
  // Require clear winner — reject ties
  if (score === runnerUp) return { winner: null, score, runnerUp };
  return { winner, score, runnerUp };
}

// ──────────────────────────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────────────────────────

interface Opts {
  dryRun: boolean;
  limit: number | null;
  minVotes: number;
}

function parseArgs(): Opts {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };
  return {
    dryRun: args.includes('--dry-run'),
    limit: get('--limit') ? parseInt(get('--limit')!, 10) : null,
    minVotes: get('--min-votes') ? parseInt(get('--min-votes')!, 10) : 2,
  };
}

async function main() {
  const opts = parseArgs();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log(`\nReclassify from tags`);
  console.log(`  Dry-run:   ${opts.dryRun}`);
  console.log(`  Min votes: ${opts.minVotes} (fewer tag matches → skip)`);
  console.log(`  Limit:     ${opts.limit ?? 'none'}`);
  console.log('─'.repeat(60));

  // Pull all enriched events with non-empty tags
  let query = supabase
    .from('events')
    .select('id, title, tags, category, category_locked')
    .not('tags', 'is', null)
    .not('enrichment_version', 'is', null)
    .neq('category_locked', true);
  if (opts.limit) query = query.limit(opts.limit);

  const { data: rows, error } = await query;
  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }
  if (!rows || rows.length === 0) { console.log('No events to process.'); return; }

  console.log(`Loaded ${rows.length} enriched events.\n`);

  const stats = {
    processed: 0,
    noVotesFromTags: 0,
    insufficientVotes: 0,
    tieSkipped: 0,
    alreadyCorrect: 0,
    reclassified: 0,
    perCategory: new Map<string, number>(), // "from → to" key
  };

  for (const row of rows as EventRow[]) {
    stats.processed += 1;
    const tags = row.tags ?? [];
    if (tags.length === 0) { stats.noVotesFromTags += 1; continue; }

    const { winner, score, runnerUp } = voteCategory(tags);
    if (!winner) {
      if (score === 0) stats.noVotesFromTags += 1;
      else stats.tieSkipped += 1;
      continue;
    }
    if (score < opts.minVotes) { stats.insufficientVotes += 1; continue; }

    if (winner === row.category) {
      stats.alreadyCorrect += 1;
      continue;
    }

    // Reclassify
    const key = `${row.category ?? '∅'} → ${winner}`;
    stats.perCategory.set(key, (stats.perCategory.get(key) ?? 0) + 1);
    stats.reclassified += 1;

    const preview = `[${row.id.slice(0, 8)}] ${row.title.slice(0, 50).padEnd(52)} ${row.category ?? '∅'} → ${winner}  (votes ${score}/${runnerUp})`;
    if (opts.dryRun) {
      console.log(`  DRY ${preview}`);
    } else {
      const { error: upErr } = await supabase
        .from('events')
        .update({ category: winner, category_source: 'enrichment' })
        .eq('id', row.id);
      if (upErr) {
        console.error(`  ✗ ${preview}\n      update failed: ${upErr.message}`);
        stats.reclassified -= 1;
      } else {
        console.log(`  ✓ ${preview}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Processed:           ${stats.processed}`);
  console.log(`Already correct:     ${stats.alreadyCorrect}`);
  console.log(`Reclassified:        ${stats.reclassified}${opts.dryRun ? ' (dry-run, no writes)' : ''}`);
  console.log(`Tags match nothing:  ${stats.noVotesFromTags}`);
  console.log(`Insufficient votes:  ${stats.insufficientVotes}`);
  console.log(`Tie skipped:         ${stats.tieSkipped}`);

  if (stats.perCategory.size > 0) {
    console.log('\nTop transitions:');
    const sorted = [...stats.perCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [key, count] of sorted) {
      console.log(`  ${String(count).padStart(5)}  ${key}`);
    }
  }
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });

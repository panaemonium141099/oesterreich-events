/**
 * Viator-Matching + Stammdaten/Preis-Refresh fuer poi_activities
 * (fn-18 Task 5).
 *
 *   npx tsx src/scripts/match-viator.ts --dry-run --limit 50   # Trockenlauf + Report
 *   npx tsx src/scripts/match-viator.ts --match                # nur neue Matches
 *   npx tsx src/scripts/match-viator.ts --refresh              # nur Preise/Stammdaten
 *   npx tsx src/scripts/match-viator.ts                        # beides (Default)
 *
 * Flags:
 *   --match      nur Matching-Phase
 *   --refresh    nur Refresh-Phase (taeglicher Cron-Default in Kombi mit --match)
 *   --dry-run    kein DB-Write, aber voller Report (Viator-Requests laufen)
 *   --limit N    max. N Aktivitaeten pro Phase (Default 500 Match / 2000 Refresh)
 *   --sample N   N Beispiel-Matches im Report ausgeben (Default 20 —
 *                das ist die Stichprobe aus dem Acceptance-Kriterium)
 *
 * Env: VIATOR_API_KEY (GitHub-Actions-Secret UND Vercel-Env — getrennte
 * Stores!), NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * OHNE VIATOR_API_KEY laeuft das Script durch und meldet "deaktiviert" —
 * es wirft NICHT (der Client liefert dann leere Ergebnisse).
 *
 * WICHTIG (Viator-ToS): Die hier gespeicherten Produktdaten duerfen nur
 * ueber die noindex-Route /api/activities/[id]/booking client-seitig
 * ausgeliefert werden — nie in ISR-HTML, Sitemaps oder Exporte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createActivityStoreClient } from '@/lib/activities/activity-store';
import {
  COMMERCIAL_TAGS,
  NAME_THRESHOLD,
  AMBIGUITY_MARGIN,
  buildSearchTerm,
  pickBestMatch,
  type MatchRejection,
  type MatchableActivity,
} from '@/lib/affiliate/match';
import {
  createViatorClient,
  deeplinkFromEnv,
  isViatorConfigured,
  toAffiliateProduct,
  type ViatorClient,
  type ViatorProduct,
} from '@/lib/affiliate/viator-client';
import { parseAffiliateProduct } from '@/lib/affiliate/viator-types';

// .env.local laden (Next laedt automatisch, tsx nicht) — Muster
// import-activities.ts.
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    if (!process.env[key]) process.env[key] = trimmed.substring(eqIdx + 1).trim();
  }
} catch {
  /* rely on the real environment */
}

const TABLE = 'poi_activities';
const DEFAULT_MATCH_LIMIT = 500;
const DEFAULT_REFRESH_LIMIT = 2000;
const PAGE_SIZE = 500;

const hasFlag = (name: string) => process.argv.includes(name);
function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function intArg(name: string, fallback: number): number {
  const raw = argValue(name);
  const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

interface ActivityRow extends MatchableActivity {
  id: string;
  slug: string;
  name: string;
  town: string | null;
  tags: string[] | null;
  affiliate_product: unknown;
}

/* ------------------------------------------------------------------ */
/* Phase 1: Matching                                                   */
/* ------------------------------------------------------------------ */

interface MatchReport {
  considered: number;
  matched: number;
  rejections: Record<string, number>;
  samples: Array<{ slug: string; name: string; town: string | null; product: string; title: string; score: number }>;
}

async function fetchMatchCandidates(
  supabase: SupabaseClient,
  limit: number,
): Promise<ActivityRow[]> {
  const rows: ActivityRow[] = [];
  for (let offset = 0; rows.length < limit; offset += PAGE_SIZE) {
    const take = Math.min(PAGE_SIZE, limit - rows.length);
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, slug, name, town, tags, affiliate_product')
      // Anzeige-Bedingung: visible AND NOT is_closed (Migration :168).
      .eq('visible', true)
      .eq('is_closed', false)
      .is('affiliate_product', null)
      .not('town', 'is', null)
      // Tag-Gate schon in der DB — spart Rows und Viator-Requests.
      .overlaps('tags', COMMERCIAL_TAGS as string[])
      .order('id', { ascending: true })
      .range(offset, offset + take - 1);

    if (error) throw new Error(`[match-viator] Kandidaten-Query: ${error.message}`);
    const page = (data ?? []) as unknown as ActivityRow[];
    rows.push(...page);
    if (page.length < take) break;
  }
  return rows;
}

async function runMatching(
  supabase: SupabaseClient,
  client: ViatorClient,
  opts: { limit: number; dryRun: boolean; sample: number },
): Promise<MatchReport> {
  const report: MatchReport = { considered: 0, matched: 0, rejections: {}, samples: [] };
  const candidates = await fetchMatchCandidates(supabase, opts.limit);
  console.log(`[match-viator] Matching: ${candidates.length} Kandidaten`);

  for (const activity of candidates) {
    report.considered++;

    const products = await client.searchProducts({ searchTerm: buildSearchTerm(activity), limit: 5 });
    const result = pickBestMatch(
      activity,
      products.map((p) => ({
        productCode: p.productCode,
        title: p.title,
        locationText: p.locationText,
      })),
    );

    if (!result.ok) {
      const reason: MatchRejection = result.reason;
      report.rejections[reason] = (report.rejections[reason] ?? 0) + 1;
      continue;
    }

    const product = products.find((p) => p.productCode === result.decision.candidate.productCode);
    if (!product) {
      report.rejections['no-candidates'] = (report.rejections['no-candidates'] ?? 0) + 1;
      continue;
    }

    const now = new Date().toISOString();
    const affiliate = toAffiliateProduct(product, {
      url: deeplinkFromEnv(product),
      matchedAt: now,
      refreshedAt: now,
    });

    if (!opts.dryRun) {
      const { error } = await supabase
        .from(TABLE)
        .update({ affiliate_product: affiliate, updated_at: now })
        .eq('id', activity.id);
      if (error) {
        console.warn(`[match-viator] Update ${activity.slug} fehlgeschlagen: ${error.message}`);
        continue;
      }
    }

    report.matched++;
    if (report.samples.length < opts.sample) {
      report.samples.push({
        slug: activity.slug,
        name: activity.name,
        town: activity.town,
        product: product.productCode,
        title: product.title ?? '',
        score: Number(result.decision.score.toFixed(3)),
      });
    }
  }

  return report;
}

/* ------------------------------------------------------------------ */
/* Phase 2: Stammdaten-/Preis-Refresh                                  */
/* ------------------------------------------------------------------ */

async function fetchRefreshRows(supabase: SupabaseClient, limit: number): Promise<ActivityRow[]> {
  const rows: ActivityRow[] = [];
  for (let offset = 0; rows.length < limit; offset += PAGE_SIZE) {
    const take = Math.min(PAGE_SIZE, limit - rows.length);
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, slug, name, town, tags, affiliate_product')
      .not('affiliate_product', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + take - 1);

    if (error) throw new Error(`[match-viator] Refresh-Query: ${error.message}`);
    const page = (data ?? []) as unknown as ActivityRow[];
    rows.push(...page);
    if (page.length < take) break;
  }
  return rows;
}

async function runRefresh(
  supabase: SupabaseClient,
  client: ViatorClient,
  opts: { limit: number; dryRun: boolean },
): Promise<{ checked: number; updated: number; dropped: number }> {
  const rows = await fetchRefreshRows(supabase, opts.limit);
  console.log(`[match-viator] Refresh: ${rows.length} Produkte`);
  let updated = 0;
  let dropped = 0;

  for (const row of rows) {
    const existing = parseAffiliateProduct(row.affiliate_product);
    if (!existing) continue;

    const fresh: ViatorProduct | null = await client.getProduct(existing.product_code);
    const now = new Date().toISOString();

    if (!fresh) {
      // Produkt existiert nicht mehr (404) -> Angebot entfernen. Ein
      // toter Deeplink ist schlimmer als gar keine Box.
      if (!opts.dryRun) {
        const { error } = await supabase
          .from(TABLE)
          .update({ affiliate_product: null, updated_at: now })
          .eq('id', row.id);
        if (error) console.warn(`[match-viator] Drop ${row.slug}: ${error.message}`);
      }
      dropped++;
      continue;
    }

    // Preis kann aus /products/{code} fehlen — dann kurzlebigen
    // "ab"-Preis aus /availability/schedules nachziehen.
    let priceFrom = fresh.priceFrom;
    let currency = fresh.currency;
    if (priceFrom == null) {
      const price = await client.getPriceFrom(existing.product_code);
      if (price) {
        priceFrom = price.price;
        currency = price.currency;
      }
    }

    const next = toAffiliateProduct(
      { ...fresh, priceFrom, currency },
      {
        url: deeplinkFromEnv(fresh),
        // matched_at bleibt der Erst-Match-Zeitpunkt.
        matchedAt: existing.matched_at || now,
        refreshedAt: now,
      },
    );

    if (!opts.dryRun) {
      const { error } = await supabase
        .from(TABLE)
        .update({ affiliate_product: next, updated_at: now })
        .eq('id', row.id);
      if (error) {
        console.warn(`[match-viator] Refresh ${row.slug}: ${error.message}`);
        continue;
      }
    }
    updated++;
  }

  return { checked: rows.length, updated, dropped };
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const dryRun = hasFlag('--dry-run');
  const onlyMatch = hasFlag('--match');
  const onlyRefresh = hasFlag('--refresh');
  const doMatch = onlyMatch || !onlyRefresh;
  const doRefresh = onlyRefresh || !onlyMatch;
  const sample = intArg('--sample', 20);

  if (!isViatorConfigured()) {
    // Kein Abbruch mit Fehlercode: Die GH-Action soll gruen bleiben,
    // solange der Key noch nicht gesetzt ist (Task-Vorgabe).
    console.warn('[match-viator] VIATOR_API_KEY fehlt — nichts zu tun (Client deaktiviert).');
    return;
  }

  const client = createViatorClient();
  const supabase = createActivityStoreClient();

  console.log(
    `[match-viator] Start (dryRun=${dryRun}, match=${doMatch}, refresh=${doRefresh}, ` +
      `nameThreshold=${NAME_THRESHOLD}, ambiguityMargin=${AMBIGUITY_MARGIN})`,
  );

  if (doRefresh) {
    const result = await runRefresh(supabase, client, {
      limit: intArg('--limit', DEFAULT_REFRESH_LIMIT),
      dryRun,
    });
    console.log(
      `[match-viator] Refresh fertig: ${result.updated}/${result.checked} aktualisiert, ` +
        `${result.dropped} entfernt (Produkt weg)`,
    );
  }

  if (doMatch) {
    const report = await runMatching(supabase, client, {
      limit: intArg('--limit', DEFAULT_MATCH_LIMIT),
      dryRun,
      sample,
    });
    console.log(
      `[match-viator] Matching fertig: ${report.matched}/${report.considered} zugeordnet`,
    );
    console.log('[match-viator] Ablehnungsgruende:', JSON.stringify(report.rejections));
    // Stichprobe fuer die manuelle Pruefung (Acceptance-Kriterium):
    console.log('[match-viator] Stichprobe (manuell pruefen!):');
    for (const s of report.samples) {
      console.log(
        `  ${s.score.toFixed(3)}  ${s.name} (${s.town ?? '-'})  ->  ${s.title} [${s.product}]  /aktivitaet/${s.slug}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[match-viator] FEHLER:', error);
    process.exit(1);
  });
